# Hedera ETF Strategy (MVP)

This repo now includes a minimal on-chain strategy that swaps a single input asset into a 50/50 basket of HBAR + SAUCE using SaucerSwap V2. It is intentionally lightweight: no oracles, no rebalancing, and no risk controls.

**Core idea**
- Users (or a vault/manager) provide the input asset (e.g., WETH on Hedera).
- The strategy splits the amount 50/50.
- Half swaps to SAUCE.
- Half swaps to WHBAR and unwraps to native HBAR.

The vault logic itself is unchanged. This strategy is a standalone module that can be owned by a vault/manager and invoked when desired.

**Key contracts**
- `contracts/HederaEtfStrategy.sol`: executes the 50/50 swap using SaucerSwap V2.
- `deploy/HederaEtfStrategy.ts`: deploys the strategy with configurable token/router addresses.
- `tasks/strategyInvest.ts`: helper task to approve + invest.

**Strategy flow**
1) `invest(amountIn, minHbarOut, minSauceOut, deadline)` is called by the owner.
2) The strategy pulls `amountIn` of the asset from the owner.
3) It swaps half to SAUCE and half to WHBAR (then unwraps to HBAR).
4) The strategy holds SAUCE + HBAR balances.

**Limitations**
- No price oracles or NAV; this is purely swap logic.
- No rebalancing or automated execution.
- No withdrawal logic for the basket (use `rescueToken`/`rescueHbar` for manual unwinds).
- Assumes auto-associations are enabled for HTS tokens.

---

**Configuration (Hedera Testnet)**
You must provide the asset and Hedera token/router addresses when deploying.

Known testnet addresses (0.0.x converted to solidity addresses):
- SaucerSwap V2 Router (0.0.1414040) -> `0x0000000000000000000000000000000000159398`
- WHBAR token (0.0.15058) -> `0x0000000000000000000000000000000000003ad2`
- SAUCE token (0.0.1183558) -> `0x0000000000000000000000000000000000120f46`

Asset (WETH) address is not provided here; use your deployed/bridged asset token.

Pool fee defaults:
- `STRATEGY_HBAR_POOL_FEE=3000`
- `STRATEGY_SAUCE_POOL_FEE=3000`

---

**Deploy**
```
STRATEGY_ASSET=<WETH_ADDRESS> \
STRATEGY_SAUCE=0x0000000000000000000000000000000000120f46 \
STRATEGY_WHBAR=0x0000000000000000000000000000000000003ad2 \
STRATEGY_ROUTER=0x0000000000000000000000000000000000159398 \
STRATEGY_HBAR_POOL_FEE=3000 \
STRATEGY_SAUCE_POOL_FEE=3000 \
pnpm hardhat deploy --tags strategy --network hedera-testnet
```

---

**Use (swap into HBAR + SAUCE)**
The strategy is `onlyOwner`, so the owner must call `invest` after approving the asset.

```
pnpm hardhat lz:strategy:invest \
  --strategy <STRATEGY_ADDRESS> \
  --amount 1 \
  --decimals 18 \
  --min-hbar-out 0 \
  --min-sauce-out 0 \
  --network hedera-testnet
```

Notes:
- `amount` is human units; it is converted using `--decimals`.
- `min-hbar-out` is in tinybar (HBAR’s smallest unit).
- `min-sauce-out` is in SAUCE’s smallest unit (6 decimals).

---

**Verify balances**
```
pnpm hardhat console --network hedera-testnet
```
```javascript
const strategy = await ethers.getContractAt("HederaEtfStrategy", "<STRATEGY_ADDRESS>")
const sauce = await ethers.getContractAt(["function balanceOf(address) view returns (uint256)"], "0x0000000000000000000000000000000000120f46")
await sauce.balanceOf(strategy.address)
await ethers.provider.getBalance(strategy.address) // native HBAR
```

---

**If you want a vault to manage this strategy**
- Transfer ownership of the strategy to the vault/composer/manager address.
- Approve the strategy to spend the vault’s asset token before calling `invest`.
