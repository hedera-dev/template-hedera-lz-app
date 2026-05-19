// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.22;

// ============================================
// CHAPTER 2: Cross-Chain Vault
// ============================================

import { ERC20 } from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { ERC4626 } from "@openzeppelin/contracts/token/ERC20/extensions/ERC4626.sol";

/**
 * @title MyERC4626
 * @notice ERC4626 tokenized vault implementation for cross-chain vault operations
 * @dev SECURITY CONSIDERATIONS:
 *      - Donation/inflation attacks on empty or low-liquidity vaults
 *      - Share price manipulation via large donations before first deposit
 *      - Slippage during deposit/redeem operations in low-liquidity conditions
 *      - First depositor advantage scenarios
 *
 *      See OpenZeppelin ERC4626 documentation for full risk analysis:
 *      https://docs.openzeppelin.com/contracts/4.x/erc4626#inflation-attack
 *
 *      MITIGATIONS:
 *      - OpenZeppelin v4.9+ includes virtual assets/shares to mitigate inflation attacks
 *      - Deployers should consider initial deposits to prevent manipulation
 */
contract MyERC4626 is ERC4626 {
    /**
     * @notice Creates a new ERC4626 vault
     * @dev Initializes the vault with virtual assets/shares protection against inflation attacks
     * @param _name The name of the vault token
     * @param _symbol The symbol of the vault token
     * @param _asset The underlying asset that the vault accepts
     */
    constructor(string memory _name, string memory _symbol, IERC20 _asset) ERC20(_name, _symbol) ERC4626(_asset) {}
}
