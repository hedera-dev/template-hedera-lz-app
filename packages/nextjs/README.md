# Next.js Frontend

Scaffold-hbar themed frontend for Chapter 1 + Chapter 3 flows.

## Setup

1. Copy `.env.example` to `.env.local`.
2. Install workspace deps from repo root:

```bash
pnpm install
```

3. Generate deployed contracts map:

```bash
pnpm next:gen-contracts
```

4. Run app:

```bash
pnpm next:dev
```

## Mock-worker relayer (testnet)

`packages/nextjs/.env.local` (not committed) should define:

- **`RELAYER_PRIVATE_KEY`**: hot key that signs Hedera txs for `SimpleDVNMock.verify`, `SimpleExecutorMock.commitAndExecute`, and optional `compose302`. The same key must be authorized as the DVN / executor operator your deployments expect (same trust model as `/bridge`).
- **`RELAYER_MAX_BRIDGE_AMOUNT_ETH`** / **`RELAYER_MAX_VAULT_AMOUNT_ETH`** / **`RELAYER_MAX_VAULT_REDEEM_AMOUNT_ETH`**: optional caps (ETH-equivalent, 18 decimals) enforced in `POST /api/relayer/bridge`.

**Bridge** (`/bridge`) and **vault flows** (`/vault`) call `POST /api/relayer/bridge` with `flow: "bridge"`, `"ovault"`, or `"ovault_redeem"`.

Vault redeem has two UX modes:
- **Local (Hedera)**: redeem/divest stays on Hedera (no worker processing; no Base unlock).
- **Cross-chain (Base ETH)**: redeem/send from Hedera to Base with relayer-first destination processing and manual fallback.

If the relayer fails (e.g. `nonce_mismatch`, misconfigured key), the vault UI keeps **Phase 2 manual** `useProcessReceive` as fallback.

## Key pages

- `/bridge`: Chapter 1 ETH <-> WETH-HTS flow
- `/vault`: OVault deposit/redeem
- `/strategy`: vault/strategy state
- `/admin`: owner-gated controls
- `/mock-workers`: simple worker controls
- `/debug`: generic contract debug UI
