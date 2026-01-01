import fs from 'fs'

import { BigNumber, Contract } from 'ethers'
import { task, types } from 'hardhat/config'
import { EndpointId } from '@layerzerolabs/lz-definitions'

import { loadDeploymentAddress } from '../../config/utils'

const ROUTER_ABI = [
    'function addLiquidityETHNewPool(address token,uint256 amountTokenDesired,uint256 amountTokenMin,uint256 amountETHMin,address to,uint256 deadline) payable returns (uint256,uint256,uint256)',
    'function addLiquidityNewPool(address tokenA,address tokenB,uint256 amountADesired,uint256 amountBDesired,uint256 amountAMin,uint256 amountBMin,address to,uint256 deadline) payable returns (uint256,uint256,uint256)',
]
const FACTORY_ABI = ['function pairCreateFee() view returns (uint256)']
const OFT_ABI = ['function token() view returns (address)']
const ERC20_ABI = ['function approve(address,uint256) returns (bool)']

const CONFIG_PATH = 'env/addresses.testnet.json'
const NETWORK_KEY = 'hedera-testnet'
const MIRROR_NODE_URL = 'https://testnet.mirrornode.hedera.com'

task('lz:setup:create-pools', 'Create SaucerSwap V1 pools for WETH/HBAR and WETH/HUSTLERS')
    .addOptionalParam('hbarLiquidityWei', 'HBAR liquidity (wei-like, 1e18)', '10000000000000000000', types.string) // defaults to 10 HBAR
    .addOptionalParam('wethLiquidity', 'WETH liquidity (smallest units)', '5000000000000000', types.string) // defaults to 0.005 WETH (so a total of 0.01 will be spent because 2x pools)
    .addOptionalParam('hustlersLiquidity', 'HUSTLERS liquidity (smallest units)', '100000000', types.string)
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
        const factory = new Contract(addresses.factoryV1, FACTORY_ABI, signer)
        const wethConnector = loadDeploymentAddress(EndpointId.HEDERA_V2_TESTNET, 'MyHTSConnector')
        const wethOft = new Contract(wethConnector, OFT_ABI, signer)
        const wethToken = await wethOft.token()
        const weth = new Contract(wethToken, ERC20_ABI, signer)
        const hustlers = new Contract(addresses.hustlersToken, ERC20_ABI, signer)

        const feeTinycent = await factory.pairCreateFee()
        const response = await fetch(`${MIRROR_NODE_URL}/api/v1/network/exchangerate`)
        if (!response.ok) {
            throw new Error(`Failed to fetch exchangerate: ${response.status} ${response.statusText}`)
        }
        const exchange = await response.json()
        const centEquivalent = BigNumber.from(exchange.current_rate.cent_equivalent)
        const hbarEquivalent = BigNumber.from(exchange.current_rate.hbar_equivalent)
        const poolFeeTinybar = BigNumber.from(feeTinycent).mul(hbarEquivalent).div(centEquivalent)
        const poolFeeWei = poolFeeTinybar.mul(BigNumber.from(10).pow(10))

        console.log('pool fee', poolFeeWei)

        const hbarLiquidityWei = BigNumber.from(args.hbarLiquidityWei)
        const wethLiquidity = BigNumber.from(args.wethLiquidity)
        const hustlersLiquidity = BigNumber.from(args.hustlersLiquidity)
        const deadline = Math.floor(Date.now() / 1000) + 1200

        await weth.approve(addresses.routerV1, wethLiquidity)
        await hustlers.approve(addresses.routerV1, hustlersLiquidity)

        const totalHbar = poolFeeWei.add(hbarLiquidityWei)

        const addLiquidityETHNewPoolGas = await router.estimateGas.addLiquidityETHNewPool(
            wethToken,
            wethLiquidity,
            0,
            0,
            deployer,
            deadline,
            {
                value: totalHbar,
            }
        )
        await router.addLiquidityETHNewPool(wethToken, wethLiquidity, 0, 0, deployer, deadline, {
            value: totalHbar,
            gasLimit: addLiquidityETHNewPoolGas.mul(1.2),
        })

        const addLiquidityNewPoolGas = await router.estimateGas.addLiquidityNewPool(
            wethToken,
            addresses.hustlersToken,
            wethLiquidity,
            hustlersLiquidity,
            0,
            0,
            deployer,
            deadline,
            { value: poolFeeWei }
        )

        await router.addLiquidityNewPool(
            wethToken,
            addresses.hustlersToken,
            wethLiquidity,
            hustlersLiquidity,
            0,
            0,
            deployer,
            deadline,
            { value: poolFeeWei, gasLimit: addLiquidityNewPoolGas.mul(12).div(10) }
        )
    })
