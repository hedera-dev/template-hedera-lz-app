// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.22;

// ============================================
// CHAPTER 3: ETF Strategy Vault
// ============================================

import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";
import { OFTAdapter } from "@layerzerolabs/oft-evm/contracts/OFTAdapter.sol";

/**
 * @title MyShareOFTAdapterStrategy
 * @notice OFT adapter for strategy vault shares enabling cross-chain transfers
 * @dev Uses a distinct contract name so strategy deployments don't reuse Chapter 2 adapters.
 */
contract MyShareOFTAdapterStrategy is OFTAdapter {
    /**
     * @notice Creates a new OFT adapter for strategy vault shares
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
