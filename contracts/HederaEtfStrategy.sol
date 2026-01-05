// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.22;

import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import { HederaTokenService } from "./hts/HederaTokenService.sol";

interface ISaucerSwapV1Router {
    function swapExactTokensForTokens(
        uint256 amountIn,
        uint256 amountOutMin,
        address[] calldata path,
        address to,
        uint256 deadline
    ) external returns (uint256[] memory amounts);

    function swapExactTokensForETH(
        uint256 amountIn,
        uint256 amountOutMin,
        address[] calldata path,
        address to,
        uint256 deadline
    ) external returns (uint256[] memory amounts);

    function swapExactETHForTokens(
        uint256 amountOutMin,
        address[] calldata path,
        address to,
        uint256 deadline
    ) external payable returns (uint256[] memory amounts);
}

/**
 * @title HederaEtfStrategy
 * @notice Simple 50/50 basket strategy that swaps WETH into HBAR + HUSTLERS via SaucerSwap V1.
 * @dev This is a minimal strategy example. It does not implement pricing, rebalancing, or risk controls.
 */
contract HederaEtfStrategy is Ownable, HederaTokenService {
    using SafeERC20 for IERC20;

    IERC20 public immutable asset;
    IERC20 public immutable hustlers;
    address public immutable whbar;
    ISaucerSwapV1Router public immutable router;

    event Invested(address indexed caller, uint256 amountIn, uint256 hbarOut, uint256 hustlersOut);
    event Divested(address indexed caller, uint256 hbarIn, uint256 hustlersIn, uint256 assetOut);

    constructor(address _asset, address _hustlers, address _whbar, address _router, address _owner) Ownable(_owner) {
        require(_asset != address(0), "asset=0");
        require(_hustlers != address(0), "hustlers=0");
        require(_whbar != address(0), "whbar=0");
        require(_router != address(0), "router=0");

        asset = IERC20(_asset);
        hustlers = IERC20(_hustlers);
        whbar = _whbar;
        router = ISaucerSwapV1Router(_router);

        int responseCode = associateToken(address(this), _asset);
        require(
            responseCode == SUCCESS_CODE || responseCode == TOKEN_ALREADY_ASSOCIATED_TO_ACCOUNT,
            "HTS: asset association failed"
        );
        responseCode = associateToken(address(this), _hustlers);
        require(
            responseCode == SUCCESS_CODE || responseCode == TOKEN_ALREADY_ASSOCIATED_TO_ACCOUNT,
            "HTS: hustlers association failed"
        );
    }

    receive() external payable {}

    /**
     * @notice Swap the input asset into HBAR and HUSTLERS at a 50/50 split.
     * @dev Caller must approve this contract to spend `amountIn` of the asset beforehand.
     * @param amountIn Total asset amount (smallest units) to invest.
     * @param deadline Unix timestamp after which the swap will revert.
     */
    function invest(
        uint256 amountIn,
        uint256 deadline
    ) external onlyOwner returns (uint256 hbarOut, uint256 hustlersOut) {
        require(amountIn > 0, "amountIn=0");

        asset.safeTransferFrom(msg.sender, address(this), amountIn);
        _approveToken(address(asset), address(router), amountIn);

        uint256 hbarAmountIn = amountIn / 2;
        uint256 hustlersAmountIn = amountIn - hbarAmountIn;

        if (hustlersAmountIn > 0) {
            address[] memory path = new address[](2);
            path[0] = address(asset);
            path[1] = address(hustlers);
            uint256[] memory amounts = router.swapExactTokensForTokens(
                hustlersAmountIn,
                0,
                path,
                address(this),
                deadline
            );
            hustlersOut = amounts[amounts.length - 1];
        }

        if (hbarAmountIn > 0) {
            address[] memory path = new address[](2);
            path[0] = address(asset);
            path[1] = whbar;
            uint256[] memory amounts = router.swapExactTokensForETH(hbarAmountIn, 0, path, address(this), deadline);
            hbarOut = amounts[amounts.length - 1];
        }

        emit Invested(msg.sender, amountIn, hbarOut, hustlersOut);
    }

    /**
     * @notice Convert all held HBAR + HUSTLERS back into WETH and send to the caller.
     * @param deadline Unix timestamp after which the swap will revert.
     */
    function divest(
        uint256 assetsToDivest,
        uint256 totalInvestedAssets,
        uint256 deadline
    ) external onlyOwner returns (uint256 assetOut) {
        require(totalInvestedAssets > 0, "totalInvestedAssets=0");
        require(assetsToDivest > 0, "assetsToDivest=0");

        uint256 hbarAmount = address(this).balance;
        uint256 hustlersAmount = hustlers.balanceOf(address(this));
        uint256 hbarPortion = (hbarAmount * assetsToDivest) / totalInvestedAssets;
        uint256 hustlersPortion = (hustlersAmount * assetsToDivest) / totalInvestedAssets;

        if (hbarPortion > 0) {
            address[] memory path = new address[](2);
            path[0] = whbar;
            path[1] = address(asset);
            router.swapExactETHForTokens{ value: hbarPortion }(0, path, address(this), deadline);
        }

        if (hustlersPortion > 0) {
            _approveToken(address(hustlers), address(router), hustlersPortion);
            address[] memory path = new address[](2);
            path[0] = address(hustlers);
            path[1] = address(asset);
            router.swapExactTokensForTokens(hustlersPortion, 0, path, address(this), deadline);
        }

        assetOut = asset.balanceOf(address(this));
        if (assetOut > 0) {
            asset.safeTransfer(msg.sender, assetOut);
        }

        emit Divested(msg.sender, hbarPortion, hustlersPortion, assetOut);
    }

    function rescueToken(address token, address to, uint256 amount) external onlyOwner {
        IERC20(token).safeTransfer(to, amount);
    }

    function rescueHbar(address to, uint256 amount) external onlyOwner {
        require(to != address(0), "to=0");
        payable(to).transfer(amount);
    }

    function _approveToken(address token, address spender, uint256 amount) private {
        uint256 allowance = amount;
        if (allowance > uint64(type(int64).max)) {
            // Hedera HTS max supply is 2^63 - 1
            allowance = uint64(type(int64).max);
        }
        IERC20(token).forceApprove(spender, allowance);
        // int responseCode = approve(token, spender, allowance);
        // require(responseCode == SUCCESS_CODE, "HTS: approve failed");
    }
}
