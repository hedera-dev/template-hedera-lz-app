<h1 align="center">Hedera ↔ Base OVault (LayerZero v2)</h1>

Hedera-first fork of the LayerZero OVault example. Hedera acts as the hub chain, Base Sepolia as the spoke. Simple Worker mocks are used for testnets (no default executors/DVNs), so this is **development only**.

## Requirements

- Node.js ≥ 18.18, pnpm ≥ 8
- One funded deployer private key (Hedera testnet + Base Sepolia)
- Basic familiarity with OFTs, OVault, and LayerZero v2 wiring

## Setup

```bash
pnpm install
cp .env.example .env
# fill PRIVATE_KEY, optionally override RPC_URL_HEDERA_TESTNET / RPC_URL_BASE_SEPOLIA
```

Networks are already limited to `hedera-testnet` and `base-sepolia` in `hardhat.config.ts`.

## Build

```bash
pnpm compile
```

## Deploy (Hedera hub, Base spoke)

1) Deploy Simple Worker mocks on both chains:

```bash
pnpm hardhat lz:deploy --tags SimpleDVNMock --network hedera-testnet
pnpm hardhat lz:deploy --tags SimpleExecutorMock --network hedera-testnet
pnpm hardhat lz:deploy --tags SimpleDVNMock --network base-sepolia
pnpm hardhat lz:deploy --tags SimpleExecutorMock --network base-sepolia
```

2) Deploy the OVault stack (hub on Hedera, spoke on Base) using `devtools/deployConfig.ts`:

```bash
# Hedera (vault + adapter + composer + asset OFT)
pnpm hardhat lz:deploy --tags ovault --network hedera-testnet
# Base (share OFT + asset OFT)
pnpm hardhat lz:deploy --tags ovault --network base-sepolia
```

## Wire LayerZero (Simple Workers)

Configs are already simple-worker ready and scoped to Hedera/Base:

- Assets: `config/layerzero.asset.config.ts`
- Shares: `config/layerzero.share.config.ts`

Wire after mocks + contracts are deployed:

```bash
pnpm hardhat lz:oapp:wire --oapp-config config/layerzero.asset.config.ts
pnpm hardhat lz:oapp:wire --oapp-config config/layerzero.share.config.ts
```

## Send flows

- Direct OFT send (assets by default):

```bash
pnpm hardhat lz:oft:send --src-eid 40285 --dst-eid 40245 --amount 1 --to <EVM_ADDRESS> \
  --oapp-config config/layerzero.asset.config.ts
```

- OVault composer send (end-to-end deposit/redeem across chains):

```bash
# Deposit assets from Hedera → shares on Base
pnpm hardhat lz:ovault:send --src-eid 40285 --dst-eid 40245 --amount 1 --to <EVM_ADDRESS> --token-type asset

# Redeem shares from Base → assets on Hedera
pnpm hardhat lz:ovault:send --src-eid 40245 --dst-eid 40285 --amount 1 --to <EVM_ADDRESS> --token-type share
```

Both tasks default to the simple-worker configs and will target Hedera/Base only.

## Project layout (post-refactor)

- `contracts/` – MyAssetOFT, MyShareOFT, MyShareOFTAdapter, MyOVaultComposer, MyERC4626
- `deploy/` – ovault deploy script + SimpleDVNMock/SimpleExecutorMock/DestinationExecutorMock
- `devtools/` – `deployConfig.ts` (Hedera hub, Base spoke) and helpers
- `layerzero.*.config.ts` – simple-worker wiring for assets and shares (Hedera/Base only)
- `tasks/` – `lz:oft:send`, `lz:ovault:send`, shared send helpers
- `deployments/` – generated deployment artifacts per chain (Base Sepolia, Hedera testnet)

## Notes

- Simple Workers need manual processing: use `lz:simple-workers:process-receive` (or `verify` + `commit` + `commit-and-execute`) on the destination chain if a message is pending. These tasks read your local `deployments/*` for contract addresses.
- Simple Workers are **not** production-safe (no fees, manual verification). Use official executors/DVNs on mainnet.
- Gas values in configs are conservative defaults; profile and tune for your contracts.
- If you switch the hub/spoke topology, update `devtools/deployConfig.ts` and both LayerZero configs accordingly.
