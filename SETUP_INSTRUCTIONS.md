# LayerZero on Hedera: A Developer Tutorial

Build cross-chain applications using LayerZero on Hedera. This tutorial takes you from simple token transfers to a fully automated ETF vault that interacts with DeFi protocols.

## What You'll Learn


| Chapter | Topic             | What You'll Build                                                   |
| ------- | ----------------- | ------------------------------------------------------------------- |
| 1       | Cross-Chain OFT   | Send native ETH from Base to Hedera as an HTS token                 |
| 2       | Cross-Chain Vault | ERC4626 vault with omnichain deposits and redemptions               |
| 3       | ETF Strategy      | Auto-investing vault that swaps into a 50/50 HBAR + HUSTLERS basket |


## Prerequisites

- Node.js 18+
- pnpm
- Private key with testnet funds on both Base Sepolia and Hedera Testnet
- Basic understanding of Solidity and LayerZero concepts

## Architecture Overview

```
BASE (Spoke)                           HEDERA (Hub)
┌─────────────────┐                   ┌─────────────────────────┐
│ MyNativeOFT     │◄──── LayerZero ──►│ MyHTSConnector          │ Ch.1
│ Adapter         │                   │ (wraps ETH as HTS)      │
└─────────────────┘                   └─────────────────────────┘

┌─────────────────┐                   ┌─────────────────────────┐
│ MyShareOFT      │◄──── LayerZero ──►│ MyERC4626 + Adapter     │ Ch.2
│ (share tokens)  │                   │ + OVaultComposer        │
└─────────────────┘                   └─────────────────────────┘

┌─────────────────┐                   ┌─────────────────────────┐
│ MyShareOFT      │◄──── LayerZero ──►│ MyERC4626Strategy       │ Ch.3
│ (share tokens)  │                   │ + HederaEtfStrategy     │
└─────────────────┘                   │ (50/50 HBAR + HUSTLERS) │
                                      └─────────────────────────┘
```

## Quick Start

```bash
# Install dependencies
pnpm install

# Set up environment
cp .env.example .env
cp packages/nextjs/.env.example packages/nextjs/.env.local
# Edit .env and packages/nextjs/.env.local with required values

# Compile contracts
pnpm hardhat:compile
```

---

## Chapter 1: Cross-Chain OFT

**Goal:** Send native ETH from Base Sepolia to Hedera, where it becomes a wrapped HTS token.

### Contracts


| Contract             | Chain  | Purpose                                     |
| -------------------- | ------ | ------------------------------------------- |
| `MyNativeOFTAdapter` | Base   | Locks native ETH, sends cross-chain message |
| `MyHTSConnector`     | Hedera | Mints HTS-wrapped ETH on receive            |


### Step 1: Deploy the OFT Contracts

```bash
pnpm hardhat lz:deploy --tags chapter1-asset
```

This deploys:

- `MyNativeOFTAdapter` on Base Sepolia
- `MyHTSConnector` on Hedera Testnet

### Step 2: Deploy Mock DVN and Executor

For testnet, we use mock workers to simulate LayerZero's DVN and Executor:

```bash
pnpm hardhat lz:deploy --tags SimpleDVNMock
pnpm hardhat lz:deploy --tags SimpleExecutorMock
```

### Step 3: Wire the OFT Mesh

Connect the contracts so they can send messages to each other:

```bash
pnpm hardhat lz:oapp:wire --oapp-config config/layerzero.asset.config.ts
```

### Step 4: Send Tokens Cross-Chain

**Base → Hedera:** Send 0.01 ETH from Base to Hedera:

```bash
pnpm hardhat lz:oft:send \
  --src-eid 40245 \
  --dst-eid 40285 \
  --amount 0.05 \
  --to 0xYOUR_ADDRESS \
  --simple-workers
```

**Hedera → Base:** Send HTS-wrapped ETH back to Base as native ETH:

```bash
pnpm hardhat lz:oft:send \
  --src-eid 40285 \
  --dst-eid 40245 \
  --amount 0.01 \
  --to 0xYOUR_ADDRESS \
  --simple-workers
```

> **Note:** The task automatically handles HTS token approval via the Hedera precompile. Ensure you have HTS-wrapped WETH tokens on Hedera (from a previous Base → Hedera transfer) and that the `MyNativeOFTAdapter` on Base has sufficient locked ETH to unlock.
**Endpoint IDs:**

- Base Sepolia: `40245`
- Hedera Testnet: `40285`

### Verify Success

Check both block explorers to confirm the transfer:

- [Base Sepolia Explorer](https://sepolia.basescan.org)
- [HashScan (Hedera)](https://hashscan.io/testnet)

---

## Chapter 2: Cross-Chain Vault

**Goal:** Build an ERC4626 vault on Hedera where users can deposit from any chain and receive share tokens.

### Contracts


| Contract            | Chain  | Purpose                                       |
| ------------------- | ------ | --------------------------------------------- |
| `MyERC4626`         | Hedera | Tokenized vault (holds assets, issues shares) |
| `MyShareOFTAdapter` | Hedera | Enables cross-chain share transfers           |
| `MyOVaultComposer`  | Hedera | Handles deposit/redeem + cross-chain routing  |
| `MyShareOFT`        | Base   | Represents vault shares on Base               |


### Step 1: Deploy Vault Contracts

```bash
pnpm hardhat lz:deploy --tags ovault
```

### Step 2: Wire the Share Mesh

```bash
pnpm hardhat lz:oapp:wire --oapp-config config/layerzero.share.config.ts
```

### Step 3: Cross-Chain Deposit (Base → Hedera)

Deposit assets from Base, receive shares on Hedera:

```bash
pnpm hardhat lz:ovault:send \
  --src-eid 40245 \
  --dst-eid 40285 \
  --amount 0.001 \
  --to 0xYOUR_ADDRESS \
  --token-type asset \
  --simple-workers
```

### Step 4: Local Deposit (Hedera → Hedera)

Deposit directly on the hub chain:

```bash
pnpm hardhat lz:ovault:send \
  --src-eid 40285 \
  --dst-eid 40285 \
  --amount 0.001 \
  --to 0xYOUR_ADDRESS \
  --token-type asset \
  --simple-workers
```

---

## Chapter 3: ETF Strategy Vault

**Goal:** Create an auto-investing vault that swaps deposited WETH into a 50/50 basket of HBAR and HUSTLERS tokens via SaucerSwap.

### Contracts


| Contract                    | Chain  | Purpose                                 |
| --------------------------- | ------ | --------------------------------------- |
| `MyERC4626Strategy`         | Hedera | Vault with auto-invest on deposit       |
| `HederaEtfStrategy`         | Hedera | Swaps WETH → 50% HBAR + 50% HUSTLERS    |
| `MyShareOFTAdapterStrategy` | Hedera | Share adapter for strategy vault        |
| `MyOVaultComposerStrategy`  | Hedera | Cross-chain composer for strategy vault |


### Step 1: Set Up Liquidity Pools

First, deploy the HUSTLERS test token and create SaucerSwap pools:

```bash
# Deploy HUSTLERS token (address saved to env/addresses.testnet.json)
pnpm hardhat lz:setup:deploy-hustlers

# Create WETH/HBAR and WETH/HUSTLERS pools on SaucerSwap
pnpm hardhat lz:setup:create-pools --network hedera-testnet
```

### Step 2: Deploy Strategy Contracts

```bash
pnpm hardhat lz:deploy --tags chapter3
```

### Step 3: Wire the Strategy Share Mesh

```bash
pnpm hardhat lz:oapp:wire --oapp-config config/layerzero.share.strategy.config.ts
```

### Step 4: Set Strategy Ownership (Required Before Sending)

`MyERC4626Strategy` calls `HederaEtfStrategy.invest(...)` during deposit, and `invest` is `onlyOwner`.
Before sending your first Chapter 3 deposit, transfer `HederaEtfStrategy` ownership to `MyERC4626Strategy`.

```bash
# Export .env vars variables in the terminal context:
source .env
# Resolve addresses from deployment artifacts (prevents manual address mix-ups)
export STRATEGY_ADDRESS=$(node -p "require('./deployments/hedera-testnet/HederaEtfStrategy.json').address")
export VAULT_STRATEGY_ADDRESS=$(node -p "require('./deployments/hedera-testnet/MyERC4626Strategy.json').address")

# Optional sanity check
cast call "$STRATEGY_ADDRESS" "owner()(address)" --rpc-url $RPC_URL_HEDERA_TESTNET

# Required: strategy owner must be the strategy vault
cast send "$STRATEGY_ADDRESS" \
  "transferOwnership(address)" "$VAULT_STRATEGY_ADDRESS" \
  --rpc-url $RPC_URL_HEDERA_TESTNET \
  --private-key $PRIVATE_KEY

# Verify
cast call "$STRATEGY_ADDRESS" "owner()(address)" --rpc-url $RPC_URL_HEDERA_TESTNET
```

Address guardrails:
- `STRATEGY_ADDRESS` = `HederaEtfStrategy` (not composer, not OFT)
- `VAULT_STRATEGY_ADDRESS` = `MyERC4626Strategy` (not `MyERC4626`)

### Step 5: Deposit with Auto-Invest

Send assets from Base, triggering auto-invest into the 50/50 basket:

```bash
pnpm hardhat lz:ovault:send \
  --src-eid 40245 \
  --dst-eid 40285 \
  --amount 0.001 \
  --to 0xYOUR_ADDRESS \
  --token-type asset \
  --composer-contract MyOVaultComposerStrategy \
  --vault-contract MyERC4626Strategy \
  --simple-workers \
  --lz-compose-gas 7000000 \
  --share-oapp-config config/layerzero.share.strategy.config.ts
```

## Frontend Runtime (After Deploy/Wire)

After completing contract deployment and wiring, regenerate frontend contract bindings and run the app:

```bash
# Rebuild deployed contracts mapping from hardhat deployments/*
pnpm next:gen-contracts

# Start the frontend
pnpm next:dev
```

Then open `http://localhost:3000`.

For operational frontend checks and relayer notes, see `RUNBOOK.md`.

---

## Project Structure

```
├── packages/
│   ├── hardhat/
│   │   ├── contracts/
│   │   │   ├── MyHTSConnector.sol          # Ch.1 - HTS-wrapped ETH on Hedera
│   │   │   ├── MyNativeOFTAdapter.sol      # Ch.1 - Native ETH adapter on Base
│   │   │   ├── MyERC4626.sol               # Ch.2 - Basic vault
│   │   │   ├── MyShareOFT.sol              # Ch.2/3 - Share token (Base)
│   │   │   ├── MyShareOFTAdapter.sol       # Ch.2 - Share adapter (Hedera)
│   │   │   ├── MyOVaultComposer.sol        # Ch.2 - Cross-chain composer
│   │   │   ├── MyERC4626Strategy.sol       # Ch.3 - Auto-invest vault
│   │   │   ├── HederaEtfStrategy.sol       # Ch.3 - 50/50 basket strategy
│   │   │   ├── MyShareOFTAdapterStrategy.sol # Ch.3 - Strategy share adapter
│   │   │   ├── MyOVaultComposerStrategy.sol  # Ch.3 - Strategy composer
│   │   │   ├── hts/                        # Hedera Token Service contracts
│   │   │   └── mocks/                      # Test mocks (DVN, Executor)
│   │   ├── deploy/                         # Hardhat deployment scripts
│   │   ├── devtools/                       # Deployment configuration
│   │   ├── tasks/                          # Hardhat tasks for sending tokens
│   │   └── config/                         # LayerZero mesh configs
│   └── nextjs/                             # Frontend app
│
├── config/                                 # Root wire entrypoints (re-export from packages/hardhat/config)
│   ├── layerzero.asset.config.ts
│   ├── layerzero.share.config.ts
│   └── layerzero.share.strategy.config.ts
│
├── deployments/                            # Generated deployment artifacts per chain
└── hardhat.config.ts                       # Root hardhat entrypoint (loads packages/hardhat config)
```

## Configuration

### Deployment Config (`packages/hardhat/devtools/deployConfig.ts`)

Controls which contracts deploy on which chains:

```typescript
// Hub chain (Hedera) - deploys vault, adapters, composers
const HUB_EID = EndpointId.HEDERA_V2_TESTNET

// Spoke chains (Base) - deploys ShareOFT
const SPOKE_EIDS = [EndpointId.BASESEP_V2_TESTNET]
```

### LayerZero Mesh Configs (`packages/hardhat/config/`)

Each config file defines a "mesh" - a pair of contracts that can communicate:

```typescript
// layerzero.asset.config.ts - Asset OFT mesh
export default createMeshConfig({
    hedera: { contractName: 'MyHTSConnector' },
    base: { contractName: 'MyNativeOFTAdapter' },
})
```

## Common Issues

### "Transaction reverted: HTS association failed"

The contract needs to be associated with the HTS token before receiving it. This is handled automatically by the contracts, but ensure you have enough HBAR for the association fee.
### "Hedera → Base bridge fails" / "Insufficient liquidity"

The `MyNativeOFTAdapter` on Base uses a lock/unlock model. To bridge back from Hedera:
1. The adapter must have enough locked ETH (from previous Base→Hedera transfers)
2. Your account needs HTS-wrapped WETH tokens on Hedera
3. The task auto-approves HTS tokens via the Hedera precompile

Check adapter balance:
```bash
cast balance <MY_NATIVE_OFT_ADAPTER_ADDRESS> --rpc-url $RPC_URL_BASE_SEPOLIA
```
### "Insufficient funds for gas"

Hedera operations require HBAR. Fund your account at the [Hedera Portal](https://portal.hedera.com/).

### "Chapter 3 deposit fails with HTS: Transfer failed, INSUFFICIENT_TOKEN_BALANCE"

If this appears during Chapter 3 compose, make sure you completed **Chapter 3 → Step 4: Set Strategy Ownership** before running the send command.

### "LayerZero endpoint not found"

Ensure you've deployed the mock DVN and Executor before wiring:

```bash
pnpm hardhat lz:deploy --tags SimpleDVNMock
pnpm hardhat lz:deploy --tags SimpleExecutorMock
```

## Key Concepts

### Hub vs Spoke Architecture

- **Hub (Hedera)**: Where the vault and strategy live. Assets are held here.
- **Spoke (Base)**: Where users interact. Share tokens exist here.

### OFT (Omnichain Fungible Token)

LayerZero's standard for cross-chain tokens. Two variants:

- **OFT**: Mint/burn model (new tokens on destination)
- **OFTAdapter**: Lock/unlock model (wraps existing tokens)

### ERC4626 Vault

Standardized vault interface:

- `deposit(assets)` → receive shares
- `redeem(shares)` → receive assets

### lzCompose

LayerZero's composability feature. After receiving tokens, the receiver can trigger additional logic (like depositing into a vault).

## Next Steps

1. **Add more spoke chains**: Extend the mesh to Arbitrum, Optimism, etc.
2. **Custom strategies**: Replace `HederaEtfStrategy` with your own investment logic
3. **Mainnet deployment**: Replace mock workers with real LayerZero DVN/Executor

## Resources

- [LayerZero V2 Docs](https://docs.layerzero.network/v2)
- [Hedera Developer Docs](https://docs.hedera.com/)
- [OpenZeppelin ERC4626](https://docs.openzeppelin.com/contracts/4.x/erc4626)
- [SaucerSwap Docs](https://docs.saucerswap.finance/)

