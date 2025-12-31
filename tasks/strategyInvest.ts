import { task, types } from 'hardhat/config'

const STRATEGY_ABI = [
    'function asset() view returns (address)',
    'function invest(uint256,uint256,uint256,uint256) returns (uint256,uint256)',
]
const ERC20_ABI = ['function approve(address,uint256) returns (bool)']

task('lz:strategy:invest', 'Swap asset into HBAR + SAUCE using the Hedera ETF strategy')
    .addParam('strategy', 'Strategy contract address', undefined, types.string)
    .addParam('amount', 'Asset amount (human units)', undefined, types.string)
    .addOptionalParam('decimals', 'Asset decimals', 18, types.int)
    .addOptionalParam('minHbarOut', 'Minimum HBAR out (tinybar)', '0', types.string)
    .addOptionalParam('minSauceOut', 'Minimum SAUCE out (smallest units)', '0', types.string)
    .addOptionalParam('deadline', 'Unix deadline (seconds)', undefined, types.int)
    .setAction(async (args, hre) => {
        const signer = (await hre.ethers.getSigners())[0]
        const strategy = new hre.ethers.Contract(args.strategy, STRATEGY_ABI, signer)
        const assetAddress: string = await strategy.asset()
        const asset = new hre.ethers.Contract(assetAddress, ERC20_ABI, signer)

        const amountIn = hre.ethers.utils.parseUnits(args.amount, args.decimals)
        const minHbarOut = hre.ethers.BigNumber.from(args.minHbarOut)
        const minSauceOut = hre.ethers.BigNumber.from(args.minSauceOut)
        const deadline = args.deadline ?? Math.floor(Date.now() / 1000) + 600

        await asset.approve(strategy.address, amountIn)
        const tx = await strategy.invest(amountIn, minHbarOut, minSauceOut, deadline)
        await tx.wait()
    })
