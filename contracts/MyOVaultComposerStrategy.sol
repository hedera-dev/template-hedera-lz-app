// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.22;

import { IOFT } from "@layerzerolabs/oft-evm/contracts/interfaces/IOFT.sol";
import { VaultComposerSync } from "@layerzerolabs/ovault-evm/contracts/VaultComposerSync.sol";

import { HederaTokenService } from "./hts/HederaTokenService.sol";

/**
 * @title MyOVaultComposerStrategy
 * @notice OVault composer for the strategy-enabled vault (Chapter 3).
 */
contract MyOVaultComposerStrategy is VaultComposerSync, HederaTokenService {
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

        uint256 maxAllowance = uint256(type(int64).max);
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
}
