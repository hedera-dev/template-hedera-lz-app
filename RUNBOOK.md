# Frontend and Ops Runbook

This runbook covers frontend runtime setup and operational checks that complement the canonical deployment flow in `README.md`.

## Scope

- Use `README.md` for contract deployment, wiring, and chapter ordering.
- Use this file for frontend env setup, relayer setup, and runtime verification after deploys.

## Environment Setup

From project root:

```bash
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

Set relayer values in `packages/nextjs/.env.local`:

```bash
RELAYER_PRIVATE_KEY=0x...
RELAYER_MAX_BRIDGE_AMOUNT_ETH=1
RELAYER_MAX_VAULT_AMOUNT_ETH=1
RELAYER_MAX_VAULT_REDEEM_AMOUNT_ETH=1
```

Optional WalletConnect:

```bash
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=
NEXT_PUBLIC_ENABLE_BURNER=false
```

## Frontend Runtime Flow

After contract deploy/wire steps from `README.md`:

```bash
pnpm next:gen-contracts
pnpm next:dev
```

Open `http://localhost:3000`.

## Address Sync Checklist

After redeploys, verify `packages/nextjs/contracts/deployedContracts.ts` includes fresh addresses for key contracts used by `/bridge`, `/vault`, `/strategy`, and `/admin`.

## Operational Notes

- If messages are pending, use the Simple Worker process/commit/execute tasks in [`docs/simple-workers/SIMPLE_WORKERS_GUIDE.md`](docs/simple-workers/SIMPLE_WORKERS_GUIDE.md).
- If strategy compose approval issues appear, use `lz:fix:composer-approval` from hardhat tasks and re-test the affected flow.
