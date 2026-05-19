// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.22;

// ============================================
// CHAPTER 2: Cross-Chain Vault
// Handles cross-chain deposit/redeem operations
// ============================================

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import { IOFT } from "@layerzerolabs/oft-evm/contracts/interfaces/IOFT.sol";
import { VaultComposerSync } from "@layerzerolabs/ovault-evm/contracts/VaultComposerSync.sol";

import { HederaTokenService } from "./hts/HederaTokenService.sol";

/**
 * @title MyOVaultComposer
 * @notice Cross-chain vault composer enabling omnichain vault operations via LayerZero
 */
contract MyOVaultComposer is VaultComposerSync, HederaTokenService {
    using SafeERC20 for IERC20;

    /**
     * @notice Creates a new cross-chain vault composer
     * @dev Initializes the composer with vault and OFT contracts for omnichain operations
     * @param _vault The vault contract implementing ERC4626 for deposit/redeem operations
     * @param _assetOFT The OFT contract for cross-chain asset transfers
     * @param _shareOFT The OFT contract for cross-chain share transfers
     */
    constructor(address _vault, address _assetOFT, address _shareOFT) VaultComposerSync(_vault, _assetOFT, _shareOFT) {}

    function _initializeAssetToken() internal virtual override returns (address assetERC20) {
        assetERC20 = IOFT(ASSET_OFT).token();

        if (assetERC20 != address(VAULT.asset())) {
            revert AssetTokenNotVaultAsset(assetERC20, address(VAULT.asset()));
        }

        // Ensure this contract can hold the HTS asset before approvals.
        int responseCode = associateToken(address(this), assetERC20);
        if (responseCode != SUCCESS_CODE && responseCode != TOKEN_ALREADY_ASSOCIATED_TO_ACCOUNT) {
            revert("HTS: Association failed");
        }

        if (IOFT(ASSET_OFT).approvalRequired()) {
            IERC20(assetERC20).forceApprove(ASSET_OFT, uint64(type(int64).max)); // Hedera HTS max supply is 2^63 - 1
        }

        IERC20(assetERC20).forceApprove(address(VAULT), uint64(type(int64).max));
    }
}
