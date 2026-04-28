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

## Key pages

- `/bridge`: Chapter 1 ETH <-> WETH-HTS flow
- `/vault`: OVault deposit/redeem
- `/strategy`: vault/strategy state
- `/admin`: owner-gated controls
- `/mock-workers`: simple worker controls
- `/debug`: generic contract debug UI
