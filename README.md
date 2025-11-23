<h1 align="center">Hedera-to-EVM Omnichain Fungible Token (OFT) Example</h1>

<p align="center">Template project for a cross-chain token (<a href="https://docs.layerzero.network/v2/concepts/applications/oft-standard">OFT</a>) powered by the LayerZero protocol. This example's config involves connecting EVM chains, like Hedera, to other EVM chains.</p>

## Table of Contents

- [Prerequisite Knowledge](#prerequisite-knowledge)
- [Requirements](#requirements)
- [Scaffold this example](#scaffold-this-example)
- [Setup](#setup)
- [Build](#build)
  - [Compiling your contracts](#compiling-your-contracts)
- [Deploy](#deploy)
- [Simple Workers (For Testnets Without Default Workers)](#simple-workers-for-testnets-without-default-workers)
  - [When to Use Simple Workers](#when-to-use-simple-workers)
  - [Deploying Simple Workers](#deploying-simple-workers)
  - [Configuring Simple Workers](#configuring-simple-workers)
  - [Using Simple Workers](#using-simple-workers)
  - [Simple Workers Architecture](#simple-workers-architecture)
  - [Important Limitations](#important-limitations)
  - [Troubleshooting Simple Workers](#troubleshooting-simple-workers)
- [Enable Messaging](#enable-messaging)
- [Sending OFTs](#sending-ofts)
- [Next Steps](#next-steps)
- [Production Deployment Checklist](#production-deployment-checklist)
  - [Profiling `lzReceive` and `lzCompose` Gas Usage](#profiling-lzreceive-and-lzcompose-gas-usage)
  - [Available Commands](#available-commands)
    - [`lzReceive`](#lzreceive)
    - [`lzCompose`](#lzcompose)
  - [Usage Examples](#usage-examples)
  - [Notes](#notes)
- [Appendix](#appendix)
  - [Running Tests](#running-tests)
  - [Adding other chains](#adding-other-chains)
  - [Using Multisigs](#using-multisigs)
  - [LayerZero Hardhat Helper Tasks](#layerzero-hardhat-helper-tasks)
    - [Manual Configuration](#manual-configuration)
    - [Contract Verification](#contract-verification)
    - [Troubleshooting](#troubleshooting)

## Prerequisite Knowledge

- [What is an OFT (Omnichain Fungible Token) ?](https://docs.layerzero.network/v2/concepts/applications/oft-standard)
- [What is an OApp (Omnichain Application) ?](https://docs.layerzero.network/v2/concepts/applications/oapp-standard)

## Requirements

- `Node.js` - ` >=18.16.0`
- `pnpm` (recommended) - or another package manager of your choice (npm, yarn)
- `forge` (optional) - `>=0.2.0` for testing, and if not using Hardhat for compilation

## Scaffold this example

Create your local copy of this example:

```bash
git clone https://github.com/hedera-dev/template-hedera-lz-app
cd template-hedera-lz-app
pnpm install
```

## Setup

1. Copy `.env.example` into a new `.env`
2. Add your [Hedera Portal](https://hubs.ly/Q03Vgc6j0) or existing deployer address/account to the `.env`
3. If using an existing account, fund it with the native tokens of the chains you want to deploy to e.g. the [Hedera Faucet](https://hubs.ly/Q03Vgcf00). This example by default will deploy to the following chains' testnets: **Hedera** and **Base**.

## Build

### Compiling your contracts

<!-- TODO: consider moving this section to Appendix, since for Hardhat, the deploy task wil auto-run compile -->

This project supports both `hardhat` and `forge` compilation. By default, the `compile` command will execute both:

```bash
pnpm compile
```

If you prefer one over the other, you can use the tooling-specific commands:

```bash
pnpm compile:forge
pnpm compile:hardhat
```

## Deploy

To deploy the OFT contracts to your desired blockchains, run the following command:

```bash
pnpm hardhat lz:deploy --tags MyOFT
```

Select all the chains you want to deploy the OFT to.

## Simple Workers (For Testnets Without Default Workers)

> :warning: **Development Only**: Simple Workers are mock implementations for testing on testnets. They should **NEVER** be used in production as they provide no security or service guarantees. For mainnet use the LayerZero worker addresses.

### What Are Simple Workers?

Simple Workers consist of:

- **SimpleDVNMock**: A minimal DVN that allows manual message verification
- **SimpleExecutorMock**: A mock executor that charges zero fees and enables manual message execution

### Deploying Simple Workers

Deploy the Simple Workers:

```bash
# Deploy SimpleDVNMock
pnpm hardhat lz:deploy --tags SimpleDVNMock

# Deploy SimpleExecutorMock
pnpm hardhat lz:deploy --tags SimpleExecutorMock
```

### Configuring Simple Workers

You can now use custom DVNs and Executors with the standard `lz:oapp:wire` command by adding them to your metadata configuration.

1. **Get your deployed addresses** from the deployment files:
   - SimpleDVNMock: `./deployments/<network-name>/SimpleDVNMock.json`
   - SimpleExecutorMock: `./deployments/<network-name>/SimpleExecutorMock.json`

2. **Update your `layerzero.simple-worker.config.ts`** to include your deployed Simple Workers:
   - **SECTION 4**: Add your Simple Worker addresses:

```typescript
// In layerzero.simple-worker.config.ts, SECTION 4: CUSTOM EXECUTOR AND DVN ADDRESSES
const customExecutorsByEid: Record<number, { address: string }> = {
  [EndpointId.BASESEP_V2_TESTNET]: { address: "0x..." }, // From deployments/base-sepolia/SimpleExecutorMock.json
  [EndpointId.HEDERA_V2_TESTNET]: { address: "0x..." }, // From deployments/hedera-testnet/SimpleExecutorMock.json
};

const customDVNsByEid: Record<number, { address: string }> = {
  [EndpointId.BASESEP_V2_TESTNET]: { address: "0x..." }, // From deployments/base-sepolia/SimpleDVNMock.json
  [EndpointId.HEDERA_V2_TESTNET]: { address: "0x..." }, // From deployments/hedera-testnet/SimpleDVNMock.json
};
```

3. **Wire normally** using the custom configuration:

```bash
pnpm hardhat lz:oapp:wire --oapp-config layerzero.simple-worker.config.ts
```

This command will automatically:

- Detect pathways without DVN configurations in your LayerZero config
- Configure SimpleDVNMock and SimpleExecutorMock for those pathways
- Set both send and receive configurations on the appropriate chains
- Skip pathways that already have DVN configurations

> :information_source: The command only configures pathways with empty DVN arrays, preserving any existing configurations.

### Sending OFTs with Simple Workers

When sending OFTs with Simple Workers, add the `--simple-workers` flag to enable the manual verification and execution flow:

```bash
# Hedera Testnet -> Base Sepolia
pnpm hardhat lz:oft:send --src-eid 40285 --dst-eid 40245 --amount 1 --to <RECIPIENT> --simple-workers

# Base Sepolia -> Hedera Testnet
pnpm hardhat lz:oft:send --src-eid 40245 --dst-eid 40285 --amount 1 --to <RECIPIENT> --simple-workers
```

With the `--simple-workers` flag, the task will:

1. Send the OFT transaction as normal
2. Automatically trigger the manual verification process on the destination chain
3. Execute the message delivery through the Simple Workers

### Simple Workers Architecture

The manual verification flow involves three steps on the destination chain:

1. **Verify**: SimpleDVNMock verifies the message payload
2. **Commit**: SimpleDVNMock commits the verification to the ULN
3. **Execute**: SimpleExecutorMock executes the message delivery

Without the `--simple-workers` flag, you would need to manually call these steps using the provided tasks:

- `lz:oapp:wire:simple-workers` - Configure Simple Workers for all pathways without DVN configurations
- `lz:simple-dvn:verify` - Verify the message with SimpleDVNMock
- `lz:simple-dvn:commit` - Commit the verification to ULN
- `lz:simple-workers:commit-and-execute` - Execute the message delivery
- `lz:simple-workers:skip` - Skip a stuck message (permanent action!)

### Important Limitations

- **Zero Fees**: Simple Workers charge no fees, breaking the economic security model
- **No Real Verification**: Messages are manually verified without actual validation
- **Testnet Only**: These mocks provide no security and must never be used on mainnet
- **Manual Process**: Requires manual intervention or the `--simple-workers` flag for automation

### Troubleshooting Simple Workers

#### Ordered Message Delivery

LayerZero enforces ordered message delivery per channel (source → destination). Messages must be processed in the exact order they were sent. If a message fails or is skipped, all subsequent messages on that channel will be blocked.

**Common Error: "InvalidNonce"**

```
warn: Lazy inbound nonce is not equal to inboundNonce + 1. You will run into an InvalidNonce error.
```

This means there are pending messages that must be processed first.

#### Recovery Options

When a message is stuck, you have two options:

**Option 1: Process the Pending Message**

```bash
# Find the pending nonce from the error message, then:
npx hardhat lz:simple-dvn:verify --src-eid <SRC_EID> --dst-eid <DST_EID> --nonce <PENDING_NONCE> --src-oapp <SRC_OAPP> --to-address <RECIPIENT> --amount <AMOUNT>
npx hardhat lz:simple-workers:commit-and-execute --src-eid <SRC_EID> --dst-eid <DST_EID> --nonce <PENDING_NONCE> ...
```

**Option 2: Skip the Message** (Cannot be undone!)

```bash
# Skip a stuck message on the destination chain
npx hardhat lz:simple-workers:skip --src-eid <SRC_EID> --src-oapp <SRC_OAPP> --nonce <NONCE_TO_SKIP> --receiver <RECEIVER_OAPP>
```

> :warning: **Skipping is permanent!** Once skipped, the message cannot be recovered. The tokens/value in that message will be permanently lost.

#### RPC Failures During Processing

If your RPC connection fails during `--simple-workers` processing:

1. The outbound message may already be sent but not verified/executed
2. You'll see detailed recovery information in the error output
3. You must handle this nonce before sending new messages
4. Either wait for RPC limits to reset and complete processing, or skip the message

#### Example: Multiple Pending Messages

If nonce 6 fails because nonce 4 is pending:

1. First process or skip nonce 4
2. Then process or skip nonce 5
3. Finally, you can process nonce 6

Remember: All messages must be handled in order!

## Enable Messaging

The OFT standard builds on top of the OApp standard, which enables generic message-passing between chains. After deploying the OFT on the respective chains, you enable messaging by running the [wiring](https://docs.layerzero.network/v2/concepts/glossary#wire--wiring) task.

> :information_source: This example uses the [Simple Config Generator](https://docs.layerzero.network/v2/tools/simple-config), which is recommended over manual configuration.

This example provides two configuration files:

1. **`layerzero.config.ts`** - The standard configuration using LayerZero's default DVNs and Executors (recommended for most deployments)
2. **`layerzero.simple-worker.config.ts`** - A template for using custom DVNs and Executors (useful for testnets without default workers or advanced custom setups)

### Using the Standard Configuration (Default)

For most deployments, use the standard configuration:

```bash
pnpm hardhat lz:oapp:wire --oapp-config layerzero.config.ts
```

The `layerzero.config.ts` file is organized into clear sections:

- Contract definitions
- Gas options
- Pathway configuration using LayerZero's default workers

### Using Custom Workers Configuration

If you need custom DVNs and Executors (e.g., for testnets without default workers or custom security requirements), use:

```bash
pnpm hardhat lz:oapp:wire --oapp-config layerzero.simple-worker.config.ts
```

The `layerzero.simple-worker.config.ts` file is organized into clear sections:

- **SECTION 1**: Contract definitions (YOU MUST EDIT)
- **SECTION 2**: Gas options (YOU MAY NEED TO EDIT)
- **SECTION 3**: Metadata configuration (MOSTLY BOILERPLATE)
- **SECTION 4**: Custom executor/DVN addresses (YOU MUST EDIT if using custom workers)
- **SECTION 5**: Pathway configuration (YOU MUST EDIT)
- **SECTION 6**: Export configuration

Submit all the transactions to complete wiring. After all transactions confirm, your OApps are wired and can send messages to each other.

### Using Custom Executors and DVNs

> :information_source: For testnets without default workers, see the [Simple Workers section](#simple-workers-for-testnets-without-default-workers) above.

For production deployments or advanced use cases, you can deploy and configure your own custom Executors and DVNs. This is useful when:

- You need specific fee structures or execution logic
- You want full control over message verification and execution
- You're building a custom security stack

To use custom executors and DVNs:

1. **Deploy your custom contracts** on each chain
2. **Use the `layerzero.simple-worker.config.ts` template**:
   - **SECTION 1**: Define your contracts
   - **SECTION 4**: Add your custom executor/DVN addresses
   - **SECTION 5**: Reference them by name in pathways
3. **Wire normally** with `pnpm hardhat lz:oapp:wire --oapp-config layerzero.simple-worker.config.ts`

> :warning: **Important**: Custom executors and DVNs must be deployed on each chain where they're needed. The same canonical name can resolve to different addresses on different chains.

> :book: **For detailed instructions**, see the [Custom Workers Configuration Guide](./CUSTOM_WORKERS_GUIDE.md) which shows exactly what to modify in your configuration.

> :information_source: **Note**: For production, review **SECTION 2** in `layerzero.simple-worker.config.ts` to adjust gas limits based on your contract's actual usage.

## Next Steps

Now that you've gone through a simplified walkthrough, here are what you can do next.

- If you are planning to deploy to production, go through the [Production Deployment Checklist](#production-deployment-checklist).
- Read on [DVNs / Security Stack](https://docs.layerzero.network/v2/concepts/modular-security/security-stack-dvns)
- Read on [Message Execution Options](https://docs.layerzero.network/v2/concepts/technical-reference/options-reference)

## Production Deployment Checklist

<!-- TODO: move to docs page, then just link -->

Before deploying, ensure the following:

- (required) if you previously uncommented the testnet mint line in `contracts/MyOFT.sol`, ensure it is commented out for production
- (recommended) you have profiled the gas usage of `lzReceive` on your destination chains
<!-- TODO: mention https://docs.layerzero.network/v2/developers/evm/technical-reference/integration-checklist#set-security-and-executor-configurations after it has been updated to reference the CLI -->

### Profiling `lzReceive` and `lzCompose` Gas Usage

The optimal values you should specify for the `gas` parameter in the LZ Config depends on the destination chain, and requires profiling. This section walks through how to estimate the optimal `gas` value.

This guide explains how to use the `pnpm` commands to estimate gas usage for LayerZero's `lzReceive` and `lzCompose` functions. These commands wrap Foundry scripts for easier invocation and allow you to pass the required arguments dynamically.

### Available Commands

1. **`gas:lzReceive`**

   This command profiles the `lzReceive` function for estimating gas usage across multiple runs.

   ```json
   "gas:lzReceive": "forge script scripts/GasProfiler.s.sol:GasProfilerScript --via-ir --sig 'run_lzReceive(string,address,uint32,address,uint32,address,bytes,uint256,uint256)'"
   ```

2. **`gas:lzCompose`**

   This command profiles the `lzCompose` function for estimating gas usage across multiple runs.

   ```json
   "gas:lzCompose": "forge script scripts/GasProfiler.s.sol:GasProfilerScript --via-ir --sig 'run_lzCompose(string,address,uint32,address,uint32,address,address,bytes,uint256,uint256)'"
   ```

### Usage Examples

#### `lzReceive`

To estimate the gas for the `lzReceive` function:

```bash
pnpm gas:lzReceive
  <rpcUrl> \
  <endpointAddress> \
  <srcEid> \
  <sender> \
  <dstEid> \
  <receiver> \
  <message> \
  <msg.value> \
  <numOfRuns>
```

Where:

- `rpcUrl`: The RPC URL for the target blockchain (e.g., Hedera, Base etc.).
- `endpointAddress`: The deployed LayerZero EndpointV2 contract address.
- `srcEid`: The source endpoint ID (uint32).
- `sender`: The sender's address (OApp).
- `dstEid`: The destination endpoint ID (uint32).
- `receiver`: The address intended to receive the message (OApp).
- `message`: The message payload as a `bytes` array.
- `msg.value`: The amount of Ether sent with the message (in wei).
- `numOfRuns`: The number of test runs to execute.

#### `lzCompose`

To estimate the gas for the `lzCompose` function:

```bash
pnpm gas:lzCompose
  <rpcUrl> \
  <endpointAddress> \
  <srcEid> \
  <sender> \
  <dstEid> \
  <receiver> \
  <composer> \
  <composeMsg> \
  <msg.value> \
  <numOfRuns>
```

Where:

- `rpcUrl`: The RPC URL for the target blockchain (e.g. Hedera, Base, etc.).
- `endpointAddress`: The deployed LayerZero EndpointV2 contract address.
- `srcEid`: The source endpoint ID (uint32).
- `sender`: The originating OApp address.
- `dstEid`: The destination endpoint ID (uint32).
- `receiver`: The address intended to receive the message (OApp).
- `composer`: The LayerZero Composer contract address.
- `composeMsg`: The compose message payload as a `bytes` array.
- `msgValue`: The amount of Ether sent with the message (in wei).
- `numOfRuns`: The number of test runs to execute.

#### Notes

- Modify `numOfRuns` based on the level of accuracy or performance you require for gas profiling.
- Log outputs will provide metrics such as the **average**, **median**, **minimum**, and **maximum** gas usage across all successful runs.

This approach simplifies repetitive tasks and ensures consistent testing across various configurations.
