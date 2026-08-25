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

## Chapter 3 strategy

`HederaEtfStrategy` swaps deposited WETH into a 50/50 **HBAR + HUSTLERS** basket via **SaucerSwap V1** (not V2, not SAUCE). The vault (`MyERC4626Strategy`) must own the strategy before the first Chapter 3 deposit.

Walkthrough, deploy tags, and ownership transfer: see [README.md](README.md) Chapter 3. Pool/token helpers: [env/README.md](env/README.md).
