// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.22;

import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

interface ISaucerSwapV2Router {
    struct ExactInputParams {
        bytes path;
        address recipient;
        uint256 deadline;
        uint256 amountIn;
        uint256 amountOutMinimum;
    }

    function exactInput(ExactInputParams calldata params) external payable returns (uint256 amountOut);

    function unwrapWHBAR(uint256 amountMinimum, address recipient) external payable;
}

/**
 * @title HederaEtfStrategy
 * @notice Simple 50/50 basket strategy that swaps an input asset into HBAR + SAUCE via SaucerSwap V2.
 * @dev This is a minimal strategy example. It does not implement pricing, rebalancing, or risk controls.
 */
contract HederaEtfStrategy is Ownable {
    using SafeERC20 for IERC20;

    IERC20 public immutable asset;
    IERC20 public immutable sauce;
    address public immutable whbar;
    ISaucerSwapV2Router public immutable router;

    uint24 public hbarPoolFee;
    uint24 public saucePoolFee;

    event Invested(address indexed caller, uint256 amountIn, uint256 hbarOut, uint256 sauceOut);
    event PoolFeesUpdated(uint24 hbarPoolFee, uint24 saucePoolFee);

    constructor(
        address _asset,
        address _sauce,
        address _whbar,
        address _router,
        uint24 _hbarPoolFee,
        uint24 _saucePoolFee,
        address _owner
    ) Ownable(_owner) {
        require(_asset != address(0), "asset=0");
        require(_sauce != address(0), "sauce=0");
        require(_whbar != address(0), "whbar=0");
        require(_router != address(0), "router=0");

        asset = IERC20(_asset);
        sauce = IERC20(_sauce);
        whbar = _whbar;
        router = ISaucerSwapV2Router(_router);
        hbarPoolFee = _hbarPoolFee;
        saucePoolFee = _saucePoolFee;
    }

    receive() external payable {}

    /**
     * @notice Swap the input asset into HBAR and SAUCE at a 50/50 split.
     * @dev Caller must approve this contract to spend `amountIn` of the asset beforehand.
     * @param amountIn Total asset amount (smallest units) to invest.
     * @param minHbarOut Minimum WHBAR/HBAR output (smallest units).
     * @param minSauceOut Minimum SAUCE output (smallest units).
     * @param deadline Unix timestamp after which the swap will revert.
     */
    function invest(
        uint256 amountIn,
        uint256 minHbarOut,
        uint256 minSauceOut,
        uint256 deadline
    ) external onlyOwner returns (uint256 hbarOut, uint256 sauceOut) {
        require(amountIn > 0, "amountIn=0");

        asset.safeTransferFrom(msg.sender, address(this), amountIn);
        asset.safeIncreaseAllowance(address(router), amountIn);

        uint256 hbarAmountIn = amountIn / 2;
        uint256 sauceAmountIn = amountIn - hbarAmountIn;

        if (sauceAmountIn > 0) {
            sauceOut = router.exactInput(
                ISaucerSwapV2Router.ExactInputParams({
                    path: _encodePath(address(asset), saucePoolFee, address(sauce)),
                    recipient: address(this),
                    deadline: deadline,
                    amountIn: sauceAmountIn,
                    amountOutMinimum: minSauceOut
                })
            );
        }

        if (hbarAmountIn > 0) {
            uint256 whbarOut = router.exactInput(
                ISaucerSwapV2Router.ExactInputParams({
                    path: _encodePath(address(asset), hbarPoolFee, whbar),
                    recipient: address(router),
                    deadline: deadline,
                    amountIn: hbarAmountIn,
                    amountOutMinimum: minHbarOut
                })
            );
            router.unwrapWHBAR(0, address(this));
            hbarOut = whbarOut;
        }

        emit Invested(msg.sender, amountIn, hbarOut, sauceOut);
    }

    function setPoolFees(uint24 _hbarPoolFee, uint24 _saucePoolFee) external onlyOwner {
        hbarPoolFee = _hbarPoolFee;
        saucePoolFee = _saucePoolFee;
        emit PoolFeesUpdated(_hbarPoolFee, _saucePoolFee);
    }

    function rescueToken(address token, address to, uint256 amount) external onlyOwner {
        IERC20(token).safeTransfer(to, amount);
    }

    function rescueHbar(address to, uint256 amount) external onlyOwner {
        require(to != address(0), "to=0");
        payable(to).transfer(amount);
    }

    function _encodePath(address tokenIn, uint24 fee, address tokenOut) private pure returns (bytes memory) {
        return abi.encodePacked(tokenIn, fee, tokenOut);
    }
}
