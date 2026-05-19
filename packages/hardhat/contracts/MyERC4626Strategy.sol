// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.22;

// ============================================
// CHAPTER 3: ETF Strategy Vault
// ERC4626 vault with auto-invest via HederaEtfStrategy
// ============================================

import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";
import { ERC20 } from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { ERC4626 } from "@openzeppelin/contracts/token/ERC20/extensions/ERC4626.sol";

import { HederaTokenService } from "./hts/HederaTokenService.sol";

interface IHederaEtfStrategy {
    function invest(uint256 amountIn, uint256 deadline) external returns (uint256 hbarOut, uint256 hustlersOut);
    function divest(
        uint256 assetsToDivest,
        uint256 totalInvestedAssets,
        uint256 deadline
    ) external returns (uint256 assetOut);
}

/**
 * @title MyERC4626Strategy
 * @notice ERC4626 vault that can auto-invest deposits via HederaEtfStrategy.
 * @dev This is a minimal "auto-invest" example for tutorial purposes.
 */
contract MyERC4626Strategy is ERC4626, Ownable, HederaTokenService {
    using SafeERC20 for IERC20;

    IHederaEtfStrategy public strategy;
    bool public autoInvest = true;
    uint256 public investDeadlineSeconds;
    uint256 public investedAssets;

    event StrategyUpdated(address indexed strategy);
    event AutoInvestUpdated(bool enabled);
    event InvestDeadlineUpdated(uint256 deadlineSeconds);

    constructor(
        string memory _name,
        string memory _symbol,
        IERC20 _asset,
        address _strategy,
        address _owner
    ) ERC20(_name, _symbol) ERC4626(_asset) Ownable(_owner) {
        investDeadlineSeconds = 600;
        int responseCode = associateToken(address(this), address(_asset));
        require(
            responseCode == SUCCESS_CODE || responseCode == TOKEN_ALREADY_ASSOCIATED_TO_ACCOUNT,
            "HTS: asset association failed"
        );
        if (_strategy != address(0)) {
            _setStrategy(_strategy);
        }
    }

    function setStrategy(address _strategy) external onlyOwner {
        _setStrategy(_strategy);
    }

    function setAutoInvest(bool _enabled) external onlyOwner {
        autoInvest = _enabled;
        emit AutoInvestUpdated(_enabled);
    }

    function setInvestDeadlineSeconds(uint256 _deadlineSeconds) external onlyOwner {
        investDeadlineSeconds = _deadlineSeconds;
        emit InvestDeadlineUpdated(_deadlineSeconds);
    }

    function _deposit(address caller, address receiver, uint256 assets, uint256 shares) internal override {
        super._deposit(caller, receiver, assets, shares);

        if (autoInvest && address(strategy) != address(0)) {
            uint256 deadline = block.timestamp + investDeadlineSeconds;
            strategy.invest(assets, deadline);
            investedAssets += assets;
        }
    }

    function _withdraw(
        address caller,
        address receiver,
        address owner,
        uint256 assets,
        uint256 shares
    ) internal override {
        uint256 available = IERC20(asset()).balanceOf(address(this));
        if (assets > available && address(strategy) != address(0) && investedAssets > 0) {
            uint256 deadline = block.timestamp + investDeadlineSeconds;
            strategy.divest(assets, investedAssets, deadline);
            investedAssets = investedAssets > assets ? investedAssets - assets : 0;
        }
        super._withdraw(caller, receiver, owner, assets, shares);
    }

    function _setStrategy(address _strategy) internal {
        require(_strategy != address(0), "strategy=0");
        strategy = IHederaEtfStrategy(_strategy);
        uint256 allowance = uint64(type(int64).max); // Hedera HTS max supply is 2^63 - 1
        IERC20(address(asset())).forceApprove(_strategy, allowance);
        emit StrategyUpdated(_strategy);
    }

    function totalAssets() public view override returns (uint256) {
        return IERC20(asset()).balanceOf(address(this)) + investedAssets;
    }
}
