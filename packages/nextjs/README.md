# Frontend Guide (Next.js)

This frontend demonstrates relayer-assisted LayerZero flows between Base Sepolia and Hedera Testnet.

Main goals:

- single-signature UX for primary user actions
- clear transaction progress across source, LayerZero, and destination
- manual recovery path when relayer or nonce ordering fails

---

## What the app does

The app provides 4 main user/operator surfaces:

- `/bridge` - bridge assets between Base and Hedera (Chapter 1 flow)
- `/vault` - deposit to Hedera vault from Base, and redeem shares back to Base ETH (Chapter 3 flow)
- `/strategy` - read-only strategy and vault state dashboard
- `/mock-workers` - advanced/manual worker recovery console (operator-oriented)

Supporting routes:

- `/admin` - owner controls
- `/debug` - generic contract debug UI

---

## Quick start

1. Copy `packages/nextjs/.env.example` to `packages/nextjs/.env.local`.
2. Install workspace deps from repo root:

```bash
pnpm install
```

3. Generate deployed contracts map:

```bash
pnpm next:gen-contracts
```

4. Run frontend:

```bash
pnpm next:dev
```

---

## Relayer configuration (required for best UX)

Set these in `packages/nextjs/.env.local`:

- `RELAYER_PRIVATE_KEY` - key used by backend relayer to submit destination worker txs (`verify`, `commitAndExecute`, optional `compose302`)
- `RELAYER_MAX_BRIDGE_AMOUNT_ETH` - optional cap for `/bridge` relayer processing
- `RELAYER_MAX_VAULT_AMOUNT_ETH` - optional cap for vault deposit relayer processing
- `RELAYER_MAX_VAULT_REDEEM_AMOUNT_ETH` - optional cap for vault redeem relayer processing

Bridge and vault UIs call `POST /api/relayer/bridge` with:

- `flow: "bridge"` for bridge
- `flow: "ovault"` for vault deposit
- `flow: "ovault_redeem"` for vault redeem to Base

If relayer fails, UI exposes manual fallback processing.

---

## User flows

### 1) Bridge flow (`/bridge`)

Use this page to move value cross-chain (Base <-> Hedera):

1. Select source and destination chain.
2. Enter amount.
3. Submit source tx (single wallet signature).
4. Relayer finalizes destination worker processing.
5. Verify result in transaction timeline links:
   - source explorer tx
   - LayerZero scan link
   - destination verify / commit-execute tx

Fallback:

- If relayer fails, use manual process button and nonce recovery panel.

### 2) Vault flow (`/vault`)

Supported intents:

- `Deposit to Hedera vault` (Base ETH -> Hedera vault shares)
- `Redeem to Base ETH` (redeem shares on Hedera -> settle back to Base)

Important UX rule:

- Redeem amount is **shares**, not ETH.

Standard flow:

1. Pick intent and amount.
2. Submit source transaction.
3. Relayer handles destination processing.
4. Confirm completion via timeline links and step statuses.

Fallback:

- If relayer fails, use manual process + nonce check/catch-up panel.

### 3) Strategy dashboard (`/strategy`)

Read-only observability for vault/strategy state:

- Vault overview: total assets, total share supply, your shares
- Strategy allocation: invested assets, HUSTLERS balance, HBAR balance
- Recent activity: invested/divested event counts in recent block window

### 4) Manual workers recovery (`/mock-workers`)

Advanced operator tool for direct worker execution:

- choose destination chain
- input route/payload fields (EIDs, OFT addresses, nonce, amount, recipient)
- optionally include compose payload
- run `verify + commitAndExecute`

Use this when automated relayer path cannot complete.

---

## How users confirm funds moved

For bridge and vault flows, users should validate:

1. **Source tx confirmed** (BaseScan or HashScan)
2. **LayerZero message observed** (LayerZeroScan)
3. **Destination execution confirmed** (BaseScan or HashScan verify/commit links)

This combination proves source submission and destination delivery.

---

## Troubleshooting

- Wrong wallet network:
  - UI will prompt switch to required source/destination chain.
- `nonce_mismatch` / nonce ahead errors:
  - use nonce check and catch-up tools in bridge/vault recovery sections.
- Relayer errors:
  - check `/api/relayer/bridge` response code in UI messages, then use manual fallback.
- No recent strategy events:
  - page only scans a recent block window; older activity may not appear.
