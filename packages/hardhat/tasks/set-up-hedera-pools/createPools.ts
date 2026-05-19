import fs from 'fs'

import { BigNumber, Contract } from 'ethers'
import { createLogger } from '@layerzerolabs/io-devtools'
import { task, types } from 'hardhat/config'
import { EndpointId } from '@layerzerolabs/lz-definitions'

import { loadDeploymentAddress } from '../../config/utils'

const ROUTER_ABI = [
    'function addLiquidityETHNewPool(address token,uint256 amountTokenDesired,uint256 amountTokenMin,uint256 amountETHMin,address to,uint256 deadline) payable returns (uint256,uint256,uint256)',
    'function addLiquidityNewPool(address tokenA,address tokenB,uint256 amountADesired,uint256 amountBDesired,uint256 amountAMin,uint256 amountBMin,address to,uint256 deadline) payable returns (uint256,uint256,uint256)',
    'function addLiquidityETH(address token,uint256 amountTokenDesired,uint256 amountTokenMin,uint256 amountETHMin,address to,uint256 deadline) payable returns (uint256,uint256,uint256)',
    'function addLiquidity(address tokenA,address tokenB,uint256 amountADesired,uint256 amountBDesired,uint256 amountAMin,uint256 amountBMin,address to,uint256 deadline) returns (uint256,uint256,uint256)',
    'function WETH() view returns (address)',
    'function WHBAR() view returns (address)',
]
const FACTORY_ABI = [
    'function pairCreateFee() view returns (uint256)',
    'function getPair(address tokenA,address tokenB) view returns (address)',
    'function createPair(address tokenA,address tokenB) payable returns (address)',
]
const OFT_ABI = ['function token() view returns (address)']
const ERC20_ABI = ['function approve(address,uint256) returns (bool)', 'function balanceOf(address) view returns (uint256)']
const ASSOCIATION_ABI = ['function associate()']

const CONFIG_PATH = 'env/addresses.testnet.json'
const NETWORK_KEY = 'hedera-testnet'
const MIRROR_NODE_URL = 'https://testnet.mirrornode.hedera.com'
const logger = createLogger()

task('lz:setup:create-pools', 'Create SaucerSwap V1 pools for WETH/HBAR and WETH/HUSTLERS')
    .addOptionalParam('hbarLiquidityWei', 'HBAR liquidity (wei-like, 1e18)', '10000000000000000000', types.string) // defaults to 10 HBAR
    .addOptionalParam('wethLiquidity', 'WETH liquidity (smallest units)', '5000000000000000', types.string) // defaults to 0.005 WETH (so a total of 0.01 will be spent because 2x pools)
    .addOptionalParam('hustlersLiquidity', 'HUSTLERS liquidity (smallest units)', '100000000', types.string)
    .addOptionalParam(
        'poolCreateFeeBufferBps',
        'Multiplier applied to pairCreateFee (in basis points). Example: 15000 = 1.5x',
        '15000',
        types.string
    )
    .addOptionalParam(
        'poolCreateFeeMinWei',
        'Minimum pool creation fee in wei-like units (1 HBAR = 1e18)',
        '25000000000000000000',
        types.string
    )
    .addOptionalParam(
        'poolCreateFeeWei',
        'Hard override for pool creation fee in wei-like units (takes precedence)',
        '',
        types.string
    )
    .addOptionalParam('txGasLimit', 'Fallback tx gas limit when estimation fails', '15000000', types.string)
    .addOptionalParam('maxTxGasLimit', 'Maximum tx gas limit allowed by network', '15000000', types.string)
    .addOptionalParam(
        'txGasPriceMultiplierBps',
        'Multiplier for provider gasPrice in basis points (10000 = 1x)',
        '20000',
        types.string
    )
    .addOptionalParam('txGasPriceWei', 'Hard override gasPrice in wei (takes precedence)', '', types.string)
    .addOptionalParam(
        'ethPoolCreateFeeWei',
        'Manual fee for factory.createPair fallback on WETH/HBAR pool creation',
        '',
        types.string
    )
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
        const rawPoolFeeWei = poolFeeTinybar.mul(BigNumber.from(10).pow(10))
        const feeBufferBps = BigNumber.from(args.poolCreateFeeBufferBps)
        const bufferedPoolFeeWei = rawPoolFeeWei.mul(feeBufferBps).div(10_000)
        const minPoolFeeWei = BigNumber.from(args.poolCreateFeeMinWei)
        const computedPoolFeeWei = bufferedPoolFeeWei.gte(minPoolFeeWei) ? bufferedPoolFeeWei : minPoolFeeWei
        const poolFeeWei =
            args.poolCreateFeeWei && args.poolCreateFeeWei.trim().length > 0
                ? BigNumber.from(args.poolCreateFeeWei)
                : computedPoolFeeWei

        logger.info(`pairCreateFee (tinycent): ${feeTinycent.toString()}`)
        logger.info(
            'exchange rate (cent_equivalent/hbar_equivalent):',
            `${centEquivalent.toString()}/${hbarEquivalent.toString()}`
        )
        logger.info(`raw pool fee (wei-like): ${rawPoolFeeWei.toString()}`)
        logger.info(`effective pool fee (wei-like): ${poolFeeWei.toString()}`)

        const hbarLiquidityWei = BigNumber.from(args.hbarLiquidityWei)
        const wethLiquidity = BigNumber.from(args.wethLiquidity)
        const hustlersLiquidity = BigNumber.from(args.hustlersLiquidity)
        const fallbackGasLimit = BigNumber.from(args.txGasLimit)
        const maxTxGasLimit = BigNumber.from(args.maxTxGasLimit)
        const deadline = Math.floor(Date.now() / 1000) + 1200
        const providerGasPrice = await hre.ethers.provider.getGasPrice()
        const gasPriceMultiplierBps = BigNumber.from(args.txGasPriceMultiplierBps)
        const computedGasPrice = providerGasPrice.mul(gasPriceMultiplierBps).div(10_000)
        const effectiveGasPrice =
            args.txGasPriceWei && args.txGasPriceWei.trim().length > 0
                ? BigNumber.from(args.txGasPriceWei)
                : computedGasPrice

        const hasErrorText = (error: unknown, value: string): boolean => {
            const text = error instanceof Error ? error.message : String(error)
            return text.includes(value)
        }

        const approveWithAssociationRecovery = async (
            tokenAddress: string,
            token: Contract,
            spender: string,
            amount: BigNumber,
            label: string
        ): Promise<void> => {
            try {
                await (await token.approve(spender, amount)).wait()
                return
            } catch (error) {
                if (!hasErrorText(error, 'TOKEN_NOT_ASSOCIATED_TO_ACCOUNT')) {
                    throw error
                }

                logger.warn(`${label}: deployer is not associated. Attempting token association and retry...`)
                const associationToken = new Contract(tokenAddress, ASSOCIATION_ABI, signer)
                try {
                    await (
                        await associationToken.associate({
                            gasLimit: maxTxGasLimit,
                            gasPrice: effectiveGasPrice,
                        })
                    ).wait()
                    logger.info(`${label}: association successful`)
                } catch (associateError) {
                    if (!hasErrorText(associateError, 'TOKEN_ALREADY_ASSOCIATED_TO_ACCOUNT')) {
                        throw associateError
                    }
                    logger.info(`${label}: already associated`)
                }

                await (await token.approve(spender, amount)).wait()
                logger.info(`${label}: approve successful after association recovery`)
            }
        }

        const totalWethLiquidity = wethLiquidity.mul(2)
        const signerAddress = await signer.getAddress()
        const [wethBalance, hustlersBalance] = await Promise.all([
            weth.balanceOf(signerAddress),
            hustlers.balanceOf(signerAddress),
        ])

        if (wethBalance.lt(totalWethLiquidity)) {
            throw new Error(
                `Insufficient WETH balance for pool setup. Need ${totalWethLiquidity.toString()} but wallet has ${wethBalance.toString()}. ` +
                    `Bridge/fund WETH to the deployer first, then retry.`
            )
        }

        if (hustlersBalance.lt(hustlersLiquidity)) {
            throw new Error(
                `Insufficient HUSTLERS balance for pool setup. Need ${hustlersLiquidity.toString()} but wallet has ${hustlersBalance.toString()}. ` +
                    `Fund HUSTLERS to the deployer (or rerun token setup) then retry.`
            )
        }

        await approveWithAssociationRecovery(wethToken, weth, addresses.routerV1, totalWethLiquidity, 'WETH')
        await approveWithAssociationRecovery(
            addresses.hustlersToken,
            hustlers,
            addresses.routerV1,
            hustlersLiquidity,
            'HUSTLERS'
        )

        const totalHbar = poolFeeWei.add(hbarLiquidityWei)
        const signerBalance = await signer.getBalance()
        logger.info(`signer balance (wei-like): ${signerBalance.toString()}`)
        logger.info(`required for first tx value (wei-like): ${totalHbar.toString()}`)
        logger.info(`provider gasPrice (wei): ${providerGasPrice.toString()}`)
        logger.info(`effective gasPrice (wei): ${effectiveGasPrice.toString()}`)

        let routerWrappedNativeContract = ''
        try {
            routerWrappedNativeContract = await router.WETH()
        } catch {
            try {
                routerWrappedNativeContract = await router.WHBAR()
            } catch {
                // Router may not expose wrapped-native contract getter in all deployments.
            }
        }
        logger.info(`configured WHBAR token (pair token): ${addresses.whbarToken}`)
        if (routerWrappedNativeContract) {
            logger.info(`router wrapped native contract: ${routerWrappedNativeContract}`)
        }

        const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000'
        const manualCreatePairFeeWei =
            args.ethPoolCreateFeeWei && args.ethPoolCreateFeeWei.trim().length > 0
                ? BigNumber.from(args.ethPoolCreateFeeWei)
                : poolFeeWei

        const resolveGasLimit = (gas: BigNumber): BigNumber => {
            const withBuffer = gas.mul(12).div(10)
            return withBuffer.gt(maxTxGasLimit) ? maxTxGasLimit : withBuffer
        }

        const ensurePair = async (tokenA: string, tokenB: string, createFeeWei: BigNumber, label: string): Promise<string> => {
            let pair = await factory.getPair(tokenA, tokenB)
            if (pair !== ZERO_ADDRESS) {
                logger.info(`${label}: existing pair found ${pair}`)
                return pair
            }

            logger.info(`${label}: pair missing, creating via factory.createPair...`)
            const createPairTx = await factory.createPair(tokenA, tokenB, {
                value: createFeeWei,
                gasLimit: maxTxGasLimit,
                gasPrice: effectiveGasPrice,
            })
            const createPairReceipt = await createPairTx.wait()
            pair = await factory.getPair(tokenA, tokenB)
            if (pair === ZERO_ADDRESS) {
                throw new Error(`${label}: createPair tx mined but pair still missing`)
            }
            logger.info(`${label}: pair created ${pair} tx=${createPairReceipt.transactionHash}`)
            return pair
        }

        const wethHbarPair = await ensurePair(wethToken, addresses.whbarToken, manualCreatePairFeeWei, 'WETH/HBAR')

        let addLiquidityETHGas: BigNumber
        try {
            addLiquidityETHGas = await router.estimateGas.addLiquidityETH(
                wethToken,
                wethLiquidity,
                0,
                0,
                deployer,
                deadline,
                {
                    value: hbarLiquidityWei,
                    gasPrice: effectiveGasPrice,
                }
            )
        } catch (e) {
            logger.warn(`estimateGas(addLiquidityETH) failed; using fallback gas limit. ${(e as Error).message}`)
            addLiquidityETHGas = fallbackGasLimit.gt(maxTxGasLimit) ? maxTxGasLimit : fallbackGasLimit
        }
        const addLiquidityEthGasLimit = resolveGasLimit(addLiquidityETHGas)
        const wethHbarTx = await router.addLiquidityETH(wethToken, wethLiquidity, 0, 0, deployer, deadline, {
            value: hbarLiquidityWei,
            gasLimit: addLiquidityEthGasLimit,
            gasPrice: effectiveGasPrice,
        })
        const wethHbarReceipt = await wethHbarTx.wait()
        logger.info(`WETH/HBAR: added liquidity pair=${wethHbarPair} tx=${wethHbarReceipt.transactionHash}`)

        const wethHustlersPair = await ensurePair(wethToken, addresses.hustlersToken, poolFeeWei, 'WETH/HUSTLERS')

        let addLiquidityGas: BigNumber
        try {
            addLiquidityGas = await router.estimateGas.addLiquidity(
                wethToken,
                addresses.hustlersToken,
                wethLiquidity,
                hustlersLiquidity,
                0,
                0,
                deployer,
                deadline
            )
        } catch (e) {
            logger.warn(`estimateGas(addLiquidity) failed; using fallback gas limit. ${(e as Error).message}`)
            addLiquidityGas = fallbackGasLimit.gt(maxTxGasLimit) ? maxTxGasLimit : fallbackGasLimit
        }
        const addLiquidityGasLimit = resolveGasLimit(addLiquidityGas)
        const wethHustlersTx = await router.addLiquidity(
            wethToken,
            addresses.hustlersToken,
            wethLiquidity,
            hustlersLiquidity,
            0,
            0,
            deployer,
            deadline,
            { gasLimit: addLiquidityGasLimit, gasPrice: effectiveGasPrice }
        )
        const wethHustlersReceipt = await wethHustlersTx.wait()
        logger.info(`WETH/HUSTLERS: added liquidity pair=${wethHustlersPair} tx=${wethHustlersReceipt.transactionHash}`)
    })
