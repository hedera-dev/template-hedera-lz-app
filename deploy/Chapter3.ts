import assert from 'assert'
import fs from 'fs'
import path from 'path'

import { type DeployFunction } from 'hardhat-deploy/types'
import { EndpointId } from '@layerzerolabs/lz-definitions'

import { loadDeploymentAddress } from '../config/utils'
import { DEPLOYMENT_CONFIG_STRATEGY } from '../devtools/deployConfigStrategy'

const ADDRESSES_PATH = path.resolve(process.cwd(), 'env/addresses.testnet.json')
const NETWORK_KEY = 'hedera-testnet'
const DEFAULT_GAS_LIMIT = 10_000_000

const estimateGasLimit = async (
    hre: Parameters<DeployFunction>[0],
    contractName: string,
    args: unknown[]
): Promise<number> => {
    try {
        const factory = await hre.ethers.getContractFactory(contractName)
        const deployTx = factory.getDeployTransaction(...args)
        const estimated = await hre.ethers.provider.estimateGas(deployTx)
        const buffered = estimated.mul(120).div(100)

        return buffered.toNumber()
    } catch (err) {
        return DEFAULT_GAS_LIMIT
    }
}

const deploy: DeployFunction = async (hre) => {
    const { getNamedAccounts, deployments } = hre
    const { deployer } = await getNamedAccounts()
    const networkEid = hre.network.config?.eid

    assert(deployer, 'Missing named deployer account')
    assert(networkEid, `Network ${hre.network.name} is missing 'eid' in config`)

    const endpointV2 = await hre.deployments.get('EndpointV2')

    if (networkEid !== EndpointId.HEDERA_V2_TESTNET) {
        return
    }

    const assetOFTAddress = loadDeploymentAddress(EndpointId.HEDERA_V2_TESTNET, 'MyHTSConnector')
    console.log(`Using existing MyHTSConnector: ${assetOFTAddress}`)

    const ioftArtifact = await hre.artifacts.readArtifact('IOFT')
    const oft = await hre.ethers.getContractAt(ioftArtifact.abi, assetOFTAddress)
    const assetTokenAddress = await oft.token()
    console.log(`Underlying asset token address found from OFT deployment: ${assetTokenAddress}`)

    const config = JSON.parse(fs.readFileSync(ADDRESSES_PATH, 'utf8'))
    const addresses = config[NETWORK_KEY]
    assert(addresses, `Missing ${NETWORK_KEY} addresses config`)
    assert(addresses.routerV1, 'Missing routerV1 in addresses config')
    assert(addresses.whbarToken, 'Missing whbarToken in addresses config')
    assert(addresses.hustlersToken, 'Missing hustlersToken in addresses config')

    const strategyGasLimit = await estimateGasLimit(hre, 'HederaEtfStrategy', [
        assetTokenAddress,
        addresses.hustlersToken,
        addresses.whbarToken,
        addresses.routerV1,
        deployer,
    ])
    const strategy = await deployments.deploy('HederaEtfStrategy', {
        from: deployer,
        args: [assetTokenAddress, addresses.hustlersToken, addresses.whbarToken, addresses.routerV1, deployer],
        log: true,
        skipIfAlreadyDeployed: true,
        gasLimit: strategyGasLimit,
    })
    console.log(`Deployed contract: HederaEtfStrategy, network: ${hre.network.name}, address: ${strategy.address}`)

    const vaultGasLimit = await estimateGasLimit(hre, DEPLOYMENT_CONFIG_STRATEGY.vault.contracts.vault, [
        DEPLOYMENT_CONFIG_STRATEGY.shareOFT.metadata.name,
        DEPLOYMENT_CONFIG_STRATEGY.shareOFT.metadata.symbol,
        assetTokenAddress,
        strategy.address,
        deployer,
    ])
    const vault = await deployments.deploy(DEPLOYMENT_CONFIG_STRATEGY.vault.contracts.vault, {
        from: deployer,
        args: [
            DEPLOYMENT_CONFIG_STRATEGY.shareOFT.metadata.name,
            DEPLOYMENT_CONFIG_STRATEGY.shareOFT.metadata.symbol,
            assetTokenAddress,
            strategy.address,
            deployer,
        ],
        log: true,
        skipIfAlreadyDeployed: true,
        gasLimit: vaultGasLimit,
    })
    console.log(
        `Deployed contract: ${DEPLOYMENT_CONFIG_STRATEGY.vault.contracts.vault}, network: ${hre.network.name}, address: ${vault.address}`
    )

    const shareAdapterGasLimit = await estimateGasLimit(hre, DEPLOYMENT_CONFIG_STRATEGY.vault.contracts.shareAdapter, [
        vault.address,
        endpointV2.address,
        deployer,
    ])
    const shareAdapter = await deployments.deploy(DEPLOYMENT_CONFIG_STRATEGY.vault.contracts.shareAdapter, {
        from: deployer,
        args: [vault.address, endpointV2.address, deployer],
        log: true,
        skipIfAlreadyDeployed: true,
        gasLimit: shareAdapterGasLimit,
    })
    console.log(
        `Deployed contract: ${DEPLOYMENT_CONFIG_STRATEGY.vault.contracts.shareAdapter}, network: ${hre.network.name}, address: ${shareAdapter.address}`
    )

    const composerGasLimit = await estimateGasLimit(hre, DEPLOYMENT_CONFIG_STRATEGY.vault.contracts.composer, [
        vault.address,
        assetOFTAddress,
        shareAdapter.address,
    ])
    const composer = await deployments.deploy(DEPLOYMENT_CONFIG_STRATEGY.vault.contracts.composer, {
        from: deployer,
        args: [vault.address, assetOFTAddress, shareAdapter.address],
        log: true,
        skipIfAlreadyDeployed: true,
        gasLimit: composerGasLimit,
    })
    console.log(
        `Deployed contract: ${DEPLOYMENT_CONFIG_STRATEGY.vault.contracts.composer}, network: ${hre.network.name}, address: ${composer.address}`
    )
}

deploy.tags = ['chapter3']

export default deploy
