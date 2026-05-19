# Environment Setup (Hedera Testnet)

This folder contains helper scripts to reproduce the HTS + SaucerSwap V1 environment used by Chapter 3.

## Prereqs

- Deployer account configured in `hardhat.config.ts` for `hedera-testnet`.
- HTS creation fee available in the deployer balance.

## Address Config

Update `env/addresses.testnet.json` with:

- `routerV1`: SaucerSwap V1 RouterV3 address.
- `factoryV1`: SaucerSwap V1 Factory address (for pool creation fee).
- `whbarToken`: WHBAR token address.
- `wethToken`: HTS WETH token address (from the connector deploy).
- `hustlersToken`: HTS HUSTLERS token address.

## 1) Deploy HUSTLERS HTS Token (task)

```sh
PRIVATE_KEY=302e... \
pnpm hardhat lz:setup:deploy-hustlers \
  --name Hustlers \
  --symbol HUSTLERS \
  --decimals 18 \
  --supply 1000000
```

Update `env/addresses.testnet.json` with the `hustlersToken` address.

## 2) Create V1 Pools (WETH/HBAR + WETH/HUSTLERS)

This creates new pools and seeds initial liquidity. Values use **tinybar** for HBAR.

```sh
pnpm hardhat lz:setup:create-pools --network hedera-testnet \
  --hbar-liquidity-wei 1000000000000000000 \
  --weth-liquidity 1000000000000000000 \
  --hustlers-liquidity 1000000000000000000
```

## 3) Seed Liquidity (Existing Pools)

Use this after pools exist to add more liquidity.

```sh
pnpm hardhat lz:setup:seed-liquidity --network hedera-testnet \
  --hbar-liquidity-wei 1000000000000000000 \
  --weth-liquidity 1000000000000000000 \
  --hustlers-liquidity 1000000000000000000
```
