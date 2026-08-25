# Architecture

Hub-and-spoke LayerZero app: **Hedera Testnet** is the hub, **Base Sepolia** is the spoke.

```
BASE (Spoke)                           HEDERA (Hub)
┌─────────────────┐                   ┌─────────────────────────┐
│ MyNativeOFT     │◄──── LayerZero ──►│ MyHTSConnector          │ Ch.1
│ Adapter         │                   │ (wraps ETH as HTS)      │
└─────────────────┘                   └─────────────────────────┘

┌─────────────────┐                   ┌─────────────────────────┐
│ MyShareOFT      │◄──── LayerZero ──►│ MyERC4626 + Adapter     │ Ch.2
│ (share tokens)  │                   │ + OVaultComposer        │
└─────────────────┘                   └─────────────────────────┘

┌─────────────────┐                   ┌─────────────────────────┐
│ MyShareOFT      │◄──── LayerZero ──►│ MyERC4626Strategy       │ Ch.3
│ (share tokens)  │                   │ + HederaEtfStrategy     │
└─────────────────┘                   │ (50/50 HBAR + HUSTLERS) │
                                      └─────────────────────────┘
```

Walkthrough, deploy tags, and ownership transfer: [SETUP_INSTRUCTIONS.md](SETUP_INSTRUCTIONS.md). Pool/token helpers: [env/README.md](env/README.md).

## Chapter 3 strategy

`HederaEtfStrategy` is a minimal on-chain basket: it splits WETH 50/50 and swaps into **HBAR + HUSTLERS** via **SaucerSwap V1** (not V2, not SAUCE). No oracles, no rebalancing, no risk controls. Swaps use `amountOutMin = 0`.

The vault (`MyERC4626Strategy`) is the intended owner. `invest` / `divest` / rescue are `onlyOwner`, so transfer strategy ownership to the vault before the first Chapter 3 deposit.

**Core idea**

- Deposits arrive as the vault asset (HTS-wrapped WETH from Chapter 1).
- If auto-invest is on, the vault approves the strategy and calls `invest`.
- Half of `amountIn` swaps to HUSTLERS (`swapExactTokensForTokens`).
- The other half swaps to native HBAR via WHBAR (`swapExactTokensForETH`).
- The strategy holds HBAR + HUSTLERS. The vault tracks `investedAssets` (cost basis), not mark-to-market NAV.

**Key contracts**

- `packages/hardhat/contracts/HederaEtfStrategy.sol` — 50/50 swap module.
- `packages/hardhat/contracts/MyERC4626Strategy.sol` — ERC4626 vault that auto-invests on deposit and divests on withdraw when idle WETH is insufficient.
- `packages/hardhat/deploy/HederaEtfStrategy.ts` — deploys with `routerV1` / `whbarToken` / `hustlersToken` from `env/addresses.testnet.json`, plus the Chapter 1 connector token as `asset`.
- `packages/hardhat/tasks/strategyInvest.ts` — standalone `lz:strategy:invest` helper.

**Strategy flow**

1. Owner calls `invest(amountIn, deadline)` (the vault does this inside `_deposit`).
2. Strategy pulls `amountIn` of the asset from the owner.
3. It swaps half to HUSTLERS and half to native HBAR.
4. On vault withdraw, if the vault does not hold enough idle WETH, it calls `divest(assetsToDivest, investedAssets, deadline)` to swap a proportional slice of the basket back to WETH.

**Limitations**

- No price oracles or NAV. `totalAssets()` is idle WETH plus `investedAssets` (amount sent in), not the current HBAR + HUSTLERS value.
- No rebalancing. The 50/50 split is only at invest time.
- Slippage is unprotected (`amountOutMin = 0`).
- Constructor associates the strategy with the HTS asset and HUSTLERS tokens. Auto-association is not a substitute for that.
- Rescue is for stuck balances / manual unwind, not the happy-path redeem. Prefer vault withdraw → `divest` when the vault owns the strategy.

**Standalone invest (optional)**

The tutorial path is vault deposit, not this task. Use it only while the EOA still owns the strategy (before ownership transfer):

```bash
pnpm hardhat lz:strategy:invest \
  --strategy <STRATEGY_ADDRESS> \
  --amount 1 \
  --decimals 18 \
  --network hedera-testnet
```

`amount` is human units; the task converts with `--decimals` and sets a 10-minute deadline unless you pass `--deadline`.

**Rescue (owner only)**

```solidity
rescueToken(address token, address to, uint256 amount)
rescueHbar(address to, uint256 amount)
```

**Verify balances**

```bash
pnpm hardhat console --network hedera-testnet
```

```javascript
const strategy = await ethers.getContractAt("HederaEtfStrategy", "<STRATEGY_ADDRESS>")
const hustlers = await strategy.hustlers()
const token = await ethers.getContractAt(["function balanceOf(address) view returns (uint256)"], hustlers)
await token.balanceOf(strategy.address)
await ethers.provider.getBalance(strategy.address) // native HBAR
```
