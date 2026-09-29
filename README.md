# LayerZero on Hedera Template

Build cross-chain applications using LayerZero on Hedera: native ETH → HTS-wrapped OFT, an omnichain ERC4626 vault, and an auto-investing ETF strategy (HBAR + HUSTLERS).

This repo is an external template for [`create-scaffold-hbar`](https://github.com/hedera-dev/create-scaffold-hbar).

## Create a project

```bash
npm create scaffold-hbar@latest -- --template hedera-dev/template-hedera-lz-app
```

`npx create-scaffold-hbar@latest --template hedera-dev/template-hedera-lz-app` is equivalent. After scaffolding, this template uses **pnpm** (not Yarn or npm) at the project root.

## What you'll build

| Chapter | Topic | What you'll build |
| --- | --- | --- |
| 1 | Cross-Chain OFT | Send native ETH from Base to Hedera as an HTS token |
| 2 | Cross-Chain Vault | ERC4626 vault with omnichain deposits and redemptions |
| 3 | ETF Strategy | Auto-investing vault that swaps into a 50/50 HBAR + HUSTLERS basket |

## Prerequisites

- Node.js ≥ 20.18.3
- pnpm
- Private key with testnet funds on both Base Sepolia and Hedera Testnet
- Basic understanding of Solidity and LayerZero concepts

## Quick start

```bash
pnpm install
cp .env.example .env
# Edit .env: set PRIVATE_KEY and RELAYER_PRIVATE_KEY (the frontend reads the root .env too)
pnpm hardhat:compile
```

`pnpm install` may print warnings about deprecated transitive dependencies — safe to ignore. Native build scripts (keccak, secp256k1, sharp, …) are allowlisted via `pnpm.onlyBuiltDependencies` in the root `package.json`; on pnpm versions that don't support that field you'll see an "ignored build scripts" warning instead, also safe — everything falls back to JS implementations.

Then follow **[SETUP_INSTRUCTIONS.md](SETUP_INSTRUCTIONS.md)** for Chapter 1–3 deploy, wire, and send.

## Docs

- [SETUP_INSTRUCTIONS.md](SETUP_INSTRUCTIONS.md) — contract chapters, deploy, wire, send
- [RUNBOOK.md](RUNBOOK.md) — frontend env, relayer, and operational checks
- [ARCHITECTURE.md](ARCHITECTURE.md) — hub/spoke layout and Chapter 3 strategy
- [docs/simple-workers/SIMPLE_WORKERS_GUIDE.md](docs/simple-workers/SIMPLE_WORKERS_GUIDE.md) — mock DVN/Executor on testnet
