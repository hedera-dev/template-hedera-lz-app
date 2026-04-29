// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.22;

// ============================================
// CHAPTER 3: ETF Strategy Vault
// Handles cross-chain deposit/redeem with auto-invest
// ============================================

import { IOFT } from "@layerzerolabs/oft-evm/contracts/interfaces/IOFT.sol";
import { VaultComposerSync } from "@layerzerolabs/ovault-evm/contracts/VaultComposerSync.sol";

import { HederaTokenService } from "./hts/HederaTokenService.sol";

/**
 * @title MyOVaultComposerStrategy
 * @notice OVault composer for the strategy-enabled vault (Chapter 3).
 */
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

contract MyOVaultComposerStrategy is VaultComposerSync, HederaTokenService {
    using SafeERC20 for IERC20;

    constructor(address _vault, address _assetOFT, address _shareOFT) VaultComposerSync(_vault, _assetOFT, _shareOFT) {}

    function _initializeAssetToken() internal virtual override returns (address assetERC20) {
        assetERC20 = IOFT(ASSET_OFT).token();

        if (assetERC20 != address(VAULT.asset())) {
            revert AssetTokenNotVaultAsset(assetERC20, address(VAULT.asset()));
        }

        int responseCode = associateToken(address(this), assetERC20);
        if (responseCode != SUCCESS_CODE && responseCode != TOKEN_ALREADY_ASSOCIATED_TO_ACCOUNT) {
            revert("HTS: Association failed");
        }

        uint256 maxAllowance = uint64(type(int64).max);
        
        if (IOFT(ASSET_OFT).approvalRequired()) {
            responseCode = approve(assetERC20, ASSET_OFT, maxAllowance);
            if (responseCode != SUCCESS_CODE) {
                revert("HTS: approve asset OFT failed");
            }
        }

        responseCode = approve(assetERC20, address(VAULT), maxAllowance);
        if (responseCode != SUCCESS_CODE) {
            revert("HTS: approve vault failed");
        }
    }
    
    /// @notice Emergency function to fix ERC20 approvals for Hedera compatibility
    function fixApprovals() external {
        address assetERC20 = IOFT(ASSET_OFT).token();
        IERC20(assetERC20).forceApprove(address(VAULT), type(uint256).max);
        IERC20(assetERC20).forceApprove(ASSET_OFT, type(uint256).max);
    }
}
