import fs from 'fs'

import { BigNumber, Contract } from 'ethers'
import { task, types } from 'hardhat/config'
import { EndpointId } from '@layerzerolabs/lz-definitions'

import { loadDeploymentAddress } from '../../config/utils'

const ROUTER_ABI = [
    'function addLiquidityETH(address token,uint256 amountTokenDesired,uint256 amountTokenMin,uint256 amountETHMin,address to,uint256 deadline) payable returns (uint256,uint256,uint256)',
    'function addLiquidity(address tokenA,address tokenB,uint256 amountADesired,uint256 amountBDesired,uint256 amountAMin,uint256 amountBMin,address to,uint256 deadline) returns (uint256,uint256,uint256)',
]
const ERC20_ABI = ['function approve(address,uint256) returns (bool)']
const OFT_ABI = ['function token() view returns (address)']

const CONFIG_PATH = 'env/addresses.testnet.json'
const NETWORK_KEY = 'hedera-testnet'

task('lz:setup:seed-liquidity', 'Seed liquidity for existing SaucerSwap V1 pools')
    .addOptionalParam('hbarLiquidityWei', 'HBAR liquidity (wei-like, 1e18)', '0', types.string)
    .addOptionalParam('wethLiquidity', 'WETH liquidity (smallest units)', '0', types.string)
    .addOptionalParam('hustlersLiquidity', 'HUSTLERS liquidity (smallest units)', '0', types.string)
    .setAction(async (args, hre) => {
        const { getNamedAccounts } = hre
        const { deployer } = await getNamedAccounts()

        const config = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'))
        const addresses = config[NETWORK_KEY]

        if (!addresses) {
            throw new Error(`Missing address config for ${NETWORK_KEY}`)
        }

        const signer = (await hre.ethers.getSigners())[0]
        const router = new Contract(addresses.routerV1, ROUTER_ABI, signer)
        const wethConnector = loadDeploymentAddress(EndpointId.HEDERA_V2_TESTNET, 'MyHTSConnector')
        const wethOft = new Contract(wethConnector, OFT_ABI, signer)
        const wethToken = await wethOft.token()
        const weth = new Contract(wethToken, ERC20_ABI, signer)
        const hustlers = new Contract(addresses.hustlersToken, ERC20_ABI, signer)

        const hbarLiquidityWei = BigNumber.from(args.hbarLiquidityWei)
        const wethLiquidity = BigNumber.from(args.wethLiquidity)
        const hustlersLiquidity = BigNumber.from(args.hustlersLiquidity)
        const deadline = Math.floor(Date.now() / 1000) + 1200

        await weth.approve(addresses.routerV1, wethLiquidity)
        await hustlers.approve(addresses.routerV1, hustlersLiquidity)

        await router.addLiquidityETH(wethToken, wethLiquidity, 0, 0, deployer, deadline, {
            value: hbarLiquidityWei,
        })

        await router.addLiquidity(
            wethToken,
            addresses.hustlersToken,
            wethLiquidity,
            hustlersLiquidity,
            0,
            0,
            deployer,
            deadline
        )

        config[NETWORK_KEY] = config[NETWORK_KEY] || {}
        config[NETWORK_KEY].wethToken = wethToken
        config[NETWORK_KEY].liquiditySeeded = true
        fs.writeFileSync(CONFIG_PATH, `${JSON.stringify(config, null, 2)}\n`)
    })
