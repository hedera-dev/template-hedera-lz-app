// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

// ============================================
// CHAPTER 1: Cross-Chain OFT
// Adapts native ETH on Base for LayerZero transfers
// ============================================

import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";
import { NativeOFTAdapter } from "@layerzerolabs/oft-evm/contracts/NativeOFTAdapter.sol";

contract MyNativeOFTAdapter is Ownable, NativeOFTAdapter {
    constructor(
        address _lzEndpoint,
        address _delegate
    ) NativeOFTAdapter(18, _lzEndpoint, _delegate) Ownable(_delegate) {}
}
