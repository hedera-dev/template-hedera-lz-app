# Frontend Runbook (After `create-hbar`)

This guide is the minimum post-provisioning setup required for the current frontend (`/bridge`, `/vault`, `/strategy`, `/admin`).

It intentionally focuses on contract groups by functionality, not tutorial chapters.

---

## 1) What the frontend needs

### Bridge contracts
- `MyNativeOFTAdapter` (Base)
- `MyHTSConnector` (Hedera)

### Vault strategy contracts
- `MyERC4626Strategy` (Hedera)
- `HederaEtfStrategy` (Hedera)
- `MyShareOFTAdapterStrategy` (Hedera)
- `MyOVaultComposerStrategy` (Hedera)
- `MyShareOFT` (Base, for share mesh side)

### Mock workers (testnet processing path)
- `SimpleDVNMock`
- `SimpleExecutorMock`

### Liquidity dependencies (for auto-invest)
- HUSTLERS token
- SaucerSwap pools:
  - WETH/WHBAR
  - WETH/HUSTLERS

---

## 2) Environment setup

From repo root:

```bash
cd /path/to/template-hedera-lz-app
nvm use
pnpm install
cp .env.example .env
cp packages/nextjs/.env.example packages/nextjs/.env.local
```

Set required values in root `.env`:

```bash
PRIVATE_KEY=0x...
RPC_URL_HEDERA_TESTNET=https://testnet.hashio.io/api
RPC_URL_BASE_SEPOLIA=https://sepolia.base.org
NEXT_PUBLIC_RPC_URL_HEDERA_TESTNET=https://testnet.hashio.io/api
NEXT_PUBLIC_RPC_URL_BASE_SEPOLIA=https://sepolia.base.org
RELAYER_PRIVATE_KEY=0x...
```

Set relayer values in `packages/nextjs/.env.local` too (this is what Next.js server routes read):

```bash
RELAYER_PRIVATE_KEY=0x...
```

Recommended relayer limits:

```bash
RELAYER_MAX_BRIDGE_AMOUNT_ETH=1
RELAYER_MAX_VAULT_AMOUNT_ETH=1
RELAYER_MAX_VAULT_REDEEM_AMOUNT_ETH=1
```

Optional WalletConnect:

```bash
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=
NEXT_PUBLIC_ENABLE_BURNER=false
```

Compile once:

```bash
pnpm compile
```

---

## 3) Deploy contracts needed by frontend

### 3.1 Deploy bridge contracts

```bash
pnpm hardhat lz:deploy --tags chapter1-asset
```

### 3.2 Deploy mock workers

```bash
pnpm hardhat lz:deploy --tags SimpleDVNMock
pnpm hardhat lz:deploy --tags SimpleExecutorMock
```

### 3.3 Deploy vault strategy contracts

```bash
pnpm hardhat lz:deploy --tags chapter3
```

### 3.4 Ensure `MyShareOFT` exists on Base for strategy share wiring

```bash
pnpm hardhat lz:deploy --network base-sepolia --tags ovault-strategy
pnpm hardhat lz:deploy --network hedera-testnet --tags ovault-strategy
```

---

## 4) Wire required LayerZero paths

### 4.1 Wire bridge asset mesh

```bash
pnpm hardhat lz:oapp:wire --oapp-config config/layerzero.asset.config.ts
```

### 4.2 Wire vault strategy share mesh

```bash
pnpm hardhat lz:oapp:wire --oapp-config config/layerzero.share.strategy.config.ts
```

---

## 5) Create liquidity required by vault strategy

Before creating pools, make sure the deployer wallet has enough tokens on Hedera:
- WETH (used in both pools, so `2x` the configured WETH liquidity)
- HUSTLERS

Deploy HUSTLERS first:

```bash
pnpm hardhat lz:setup:deploy-hustlers --network hedera-testnet
```

Bridge WETH from Base to Hedera to fund pool creation (example amount):

```bash
pnpm hardhat lz:oft:send \
  --src-eid 40245 \
  --dst-eid 40285 \
  --amount 0.02 \
  --to <DEPLOYER_EVM_ADDRESS> \
  --simple-workers
```

Optional balance checks before creating pools:

```bash
cast call <MY_HTS_CONNECTOR_ADDRESS> "token()(address)" --rpc-url $RPC_URL_HEDERA_TESTNET
cast call <WETH_TOKEN_ADDRESS> "balanceOf(address)(uint256)" <DEPLOYER_EVM_ADDRESS> --rpc-url $RPC_URL_HEDERA_TESTNET
cast call <HUSTLERS_TOKEN_ADDRESS> "balanceOf(address)(uint256)" <DEPLOYER_EVM_ADDRESS> --rpc-url $RPC_URL_HEDERA_TESTNET
```

Then create pools:

```bash
pnpm hardhat lz:setup:create-pools --network hedera-testnet
```

Optional extra liquidity:

```bash
pnpm hardhat lz:setup:seed-liquidity --network hedera-testnet
```

---

## 6) Finalize strategy admin state

`HederaEtfStrategy.owner()` should be vault (`MyERC4626Strategy`) and `autoInvest` should be enabled.

```bash
cast call <HEDERA_ETF_STRATEGY_ADDRESS> "owner()(address)" --rpc-url $RPC_URL_HEDERA_TESTNET

cast send <HEDERA_ETF_STRATEGY_ADDRESS> \
  "transferOwnership(address)" <MY_ERC4626_STRATEGY_ADDRESS> \
  --rpc-url $RPC_URL_HEDERA_TESTNET \
  --private-key $PRIVATE_KEY \
  --gas-limit 1000000

cast send <MY_ERC4626_STRATEGY_ADDRESS> \
  "setAutoInvest(bool)" true \
  --rpc-url $RPC_URL_HEDERA_TESTNET \
  --private-key $PRIVATE_KEY \
  --gas-limit 1000000
```

Optional (only if approval-related compose errors appear):

```bash
cast send <MY_OVAULT_COMPOSER_STRATEGY_ADDRESS> \
  "fixApprovals()" \
  --rpc-url $RPC_URL_HEDERA_TESTNET \
  --private-key $PRIVATE_KEY \
  --gas-limit 5000000
```

---

## 7) Sync frontend contract addresses

After redeploys, regenerate:

```bash
pnpm next:gen-contracts
```

Verify `packages/nextjs/contracts/deployedContracts.ts` includes current addresses for:
- `MyHTSConnector`
- `MyERC4626Strategy`
- `MyShareOFTAdapterStrategy`
- `MyOVaultComposerStrategy`
- `HederaEtfStrategy`
- `SimpleDVNMock`
- `SimpleExecutorMock`

---

## 8) Smoke tests before UI

### Bridge smoke test

```bash
pnpm hardhat lz:oft:send \
  --src-eid 40245 \
  --dst-eid 40285 \
  --amount 0.01 \
  --to <YOUR_EVM_ADDRESS> \
  --simple-workers
```

### Vault strategy deposit smoke test

```bash
pnpm hardhat lz:ovault:send \
  --src-eid 40245 \
  --dst-eid 40285 \
  --amount 0.001 \
  --to <YOUR_EVM_ADDRESS> \
  --token-type asset \
  --composer-contract MyOVaultComposerStrategy \
  --vault-contract MyERC4626Strategy \
  --simple-workers \
  --lz-compose-gas 7000000 \
  --share-oapp-config config/layerzero.share.strategy.config.ts
```

---

## 9) Run frontend

```bash
pnpm next:dev
```

Quick checks:
- `/bridge` sends Base <-> Hedera
- `/vault` deposit/redeem + catch-up flow works
- `/strategy` metrics load (including share price)
- `/admin` strategy controls are responsive

---

## 10) Common problems

1. `eth_getLogs` range/413 errors
   - RPC range limit. Use chunked log scans (already applied in current vault flow hook).

2. WalletConnect modal error
   - Invalid/missing `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID`. Leave empty or set a valid ID.

3. Vault strategy compose revert
   - Missing pools, wrong strategy owner, or `autoInvest=false`.

4. Hedera -> Base unlock failure
   - Base adapter lacks locked ETH or Hedera side lacks wrapped WETH.

5. Frontend reads stale addresses
   - Run `pnpm next:gen-contracts` after redeploy.

