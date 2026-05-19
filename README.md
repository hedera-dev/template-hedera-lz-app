# LayerZero on Hedera Template

This template is consumed by `create-scaffold-hbar` as an external template branch.

## Canonical Docs

- `README_v3.md` is the source of truth for contract setup, deploy, wire, and send flows.
- `RUNBOOK.md` contains frontend operational setup, relayer notes, and recovery-focused checks.

## Template Shape

- Hardhat-only contract tooling is under `packages/hardhat`.
- Frontend app is under `packages/nextjs`.
- Root `config/*.ts` files are lightweight entrypoints for `pnpm hardhat lz:oapp:wire --oapp-config ...`.

## Quick Start

```bash
pnpm install
cp .env.example .env
pnpm hardhat:compile
pnpm next:gen-contracts
pnpm next:dev
```

Then continue with `README_v3.md` for the full chapter-by-chapter contract workflow.
