// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.22;

// ============================================
// CHAPTER 2: Cross-Chain Vault
// ============================================

import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";
import { OFTAdapter } from "@layerzerolabs/oft-evm/contracts/OFTAdapter.sol";

/**
 * @title MyShareOFTAdapter
 * @notice OFT adapter for vault shares enabling cross-chain transfers
 * @dev The share token MUST be an OFT adapter (lockbox).
 * @dev A mint-burn adapter would not work since it transforms `ShareERC20::totalSupply()`
 */
contract MyShareOFTAdapter is OFTAdapter {
    /**
     * @notice Creates a new OFT adapter for vault shares
     * @dev Sets up cross-chain token transfer capabilities for vault shares
     * @param _token The vault share token to adapt for cross-chain transfers
     * @param _lzEndpoint The LayerZero endpoint for this chain
     * @param _delegate The account with administrative privileges
     */
    constructor(
        address _token,
        address _lzEndpoint,
        address _delegate
    ) OFTAdapter(_token, _lzEndpoint, _delegate) Ownable(_delegate) {}
}
