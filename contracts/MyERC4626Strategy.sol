// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.22;

import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";
import { ERC20 } from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { ERC4626 } from "@openzeppelin/contracts/token/ERC20/extensions/ERC4626.sol";

interface IHederaEtfStrategy {
    function invest(
        uint256 amountIn,
        uint256 minHbarOut,
        uint256 minSauceOut,
        uint256 deadline
    ) external returns (uint256 hbarOut, uint256 sauceOut);
}

/**
 * @title MyERC4626Strategy
 * @notice ERC4626 vault that can auto-invest deposits via HederaEtfStrategy.
 * @dev This is a minimal "auto-invest" example for tutorial purposes.
 */
contract MyERC4626Strategy is ERC4626, Ownable {
    using SafeERC20 for IERC20;

    IHederaEtfStrategy public strategy;
    bool public autoInvest;
    uint256 public minHbarOut;
    uint256 public minSauceOut;
    uint256 public investDeadlineSeconds;
    uint256 public investedAssets;

    event StrategyUpdated(address indexed strategy);
    event AutoInvestUpdated(bool enabled);
    event StrategyMinsUpdated(uint256 minHbarOut, uint256 minSauceOut);
    event InvestDeadlineUpdated(uint256 deadlineSeconds);

    constructor(
        string memory _name,
        string memory _symbol,
        IERC20 _asset,
        address _strategy,
        address _owner
    ) ERC20(_name, _symbol) ERC4626(_asset) Ownable(_owner) {
        investDeadlineSeconds = 600;
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

    function setStrategyMins(uint256 _minHbarOut, uint256 _minSauceOut) external onlyOwner {
        minHbarOut = _minHbarOut;
        minSauceOut = _minSauceOut;
        emit StrategyMinsUpdated(_minHbarOut, _minSauceOut);
    }

    function setInvestDeadlineSeconds(uint256 _deadlineSeconds) external onlyOwner {
        investDeadlineSeconds = _deadlineSeconds;
        emit InvestDeadlineUpdated(_deadlineSeconds);
    }

    function _deposit(address caller, address receiver, uint256 assets, uint256 shares) internal override {
        super._deposit(caller, receiver, assets, shares);

        if (autoInvest && address(strategy) != address(0)) {
            uint256 deadline = block.timestamp + investDeadlineSeconds;
            strategy.invest(assets, minHbarOut, minSauceOut, deadline);
            investedAssets += assets;
        }
    }

    function _setStrategy(address _strategy) internal {
        require(_strategy != address(0), "strategy=0");
        strategy = IHederaEtfStrategy(_strategy);
        IERC20(asset()).forceApprove(_strategy, type(uint256).max);
        emit StrategyUpdated(_strategy);
    }

    function totalAssets() public view override returns (uint256) {
        return IERC20(asset()).balanceOf(address(this)) + investedAssets;
    }
}
