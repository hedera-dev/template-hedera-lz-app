<h1 align="center">LayerZero on Hedera: OFT → OVault (Hedera ↔ Base)</h1>

Progressive tutorial for Hedera developers. Start with a simple OFT transfer, then layer in OVault (Hedera hub, Base spoke). Testnet-only with Simple Worker mocks; swap to production DVNs/executors for mainnet.

## Requirements

- `Node.js` - ` >=18.16.0`
- `pnpm` (recommended) - or another package manager of your choice (npm, yarn)
- `forge` (optional) - `>=0.2.0` for testing, and if not using Hardhat for compilation

## Setup

1. Copy `.env.example` into a new `.env`
2. Add your [Hedera Portal](https://hubs.ly/Q03Vgc6j0) or existing deployer address/account to the `.env`
3. If using an existing account, fund it with the native tokens of the chains you want to deploy to e.g. the [Hedera Faucet](https://hubs.ly/Q03Vgcf00). This example by default will deploy to the following chains' testnets: **Hedera** and **Base**.

## Build

### Compiling your contracts

This project supports both `hardhat` and `forge` compilation. By default, the `compile` command will execute both:

```bash
pnpm compile
```

If you prefer one over the other, you can use the tooling-specific commands:

```bash
pnpm compile:forge
pnpm compile:hardhat
```

## Chapter 1: Hello OFT (Hedera ↔ Base)

1. **Deploy Simple Workers (mocks) on both chains**

```bash
pnpm hardhat lz:deploy --tags SimpleDVNMock
pnpm hardhat lz:deploy --tags SimpleExecutorMock
```

2. **Deploy the OFT (MyAssetOFT) on both chains**

```bash
pnpm hardhat lz:deploy --tags MyOFT --network hedera-testnet
pnpm hardhat lz:deploy --tags MyOFT --network base-sepolia
```

3. **Wire OFT for Simple Workers**

```bash
pnpm hardhat lz:oapp:wire --oapp-config config/layerzero.asset.config.ts
```

4. **Send tokens cross-chain (Base → Hedera or reverse)**

```bash
pnpm hardhat lz:oft:send --src-eid 40245 --dst-eid 40285 --amount 1 --to <EVM_ADDRESS> \
  --oapp-config config/layerzero.asset.config.ts --simple-workers
```

If a message is pending, run on the destination chain:

```bash
pnpm hardhat lz:simple-workers:process-receive --src-eid 40245 --dst-eid 40285 \
  --src-oapp <SRC_OFT_ADDR> --nonce <NONCE> --to-address <RECIPIENT> --amount 1
```

**What you learned:** endpoints, wiring, quoting/sending, manual processing with Simple Workers.

## Chapter 2: OVault (Hedera hub, Base spoke)

Architecture: Hedera hosts the vault, adapter, composer, and an asset OFT. Base hosts the share OFT (and asset OFT). Example flow: user pays on Base and receives vault shares on Hedera.

1. **Config**: `devtools/deployConfig.ts` already sets Hedera hub, Base spoke. Adjust names/symbols if needed.

2. **Deploy OVault stack**

```bash
# Hedera (vault + adapter + composer + asset OFT)
pnpm hardhat lz:deploy --tags ovault --network hedera-testnet
# Base (share OFT + asset OFT)
pnpm hardhat lz:deploy --tags ovault --network base-sepolia
```

3. **Wire OVault messaging (Simple Workers)**

```bash
pnpm hardhat lz:oapp:wire --oapp-config config/layerzero.asset.config.ts
pnpm hardhat lz:oapp:wire --oapp-config config/layerzero.share.config.ts
```

4. **OVault operations**

- Pay on Base, receive shares on Hedera (asset → share):

```bash
pnpm hardhat lz:ovault:send --src-eid 40245 --dst-eid 40285 --amount 1 --to <EVM_ADDRESS> \
  --token-type asset --simple-workers
```

- Redeem shares on Hedera back to assets (share → asset):

```bash
pnpm hardhat lz:ovault:send --src-eid 40285 --dst-eid 40245 --amount 1 --to <EVM_ADDRESS> \
  --token-type share --simple-workers
```

If a message is pending, process on the destination chain with the Simple Worker tasks (same as Chapter 1).

## Project layout

- `contracts/` – MyAssetOFT, MyShareOFT, MyShareOFTAdapter, MyOVaultComposer, MyERC4626
- `deploy/` – ovault deploy + SimpleDVNMock/SimpleExecutorMock/DestinationExecutorMock
- `devtools/` – `deployConfig.ts` (Hedera hub/Base spoke) and helpers
- `config/` – LayerZero configs for assets/shares (Simple Worker ready)
- `tasks/` – `lz:oft:send`, `lz:ovault:send`, Simple Worker helpers
- `deployments/` – generated deployment artifacts per chain (Base Sepolia, Hedera testnet)

## Notes

- Testnets often lack default DVNs/executors, so we deploy Simple Worker mocks to exercise the flows. For mainnet, use the official contracts from LayerZero: https://docs.layerzero.network/v2/deployments/deployed-contracts?stages=mainnet
- Gas values in configs are defaults; profile and tune for your contracts.
- To change hub/spoke or add chains, update `devtools/deployConfig.ts` and regenerate wiring.
