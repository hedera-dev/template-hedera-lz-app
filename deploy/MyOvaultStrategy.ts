import assert from 'assert'

import { type DeployFunction } from 'hardhat-deploy/types'

import {
    DEPLOYMENT_CONFIG_STRATEGY,
    isVaultChainStrategy,
    shouldDeployAssetStrategy,
    shouldDeployShareStrategy,
} from '../devtools'

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000'

const deploy: DeployFunction = async (hre) => {
    const { getNamedAccounts, deployments } = hre
    const { deployer } = await getNamedAccounts()
    const networkEid = hre.network.config?.eid

    assert(deployer, 'Missing named deployer account')
    assert(networkEid, `Network ${hre.network.name} is missing 'eid' in config`)

    console.log(`Network: ${hre.network.name}`)
    console.log(`Deployer: ${deployer}`)

    if (isVaultChainStrategy(networkEid) && shouldDeployShareStrategy(networkEid)) {
        throw new Error(
            `Configuration error: Share OFT should not deploy on vault chain (EID: ${networkEid}). ` +
                `Vault chain uses Share Adapter instead. Check your configuration.`
        )
    }

    const endpointV2 = await hre.deployments.get('EndpointV2')
    const deployedContracts: Record<string, string> = {}

    if (shouldDeployAssetStrategy(networkEid)) {
        const assetOFT = await deployments.deploy(DEPLOYMENT_CONFIG_STRATEGY.assetOFT.contract, {
            from: deployer,
            args: [
                DEPLOYMENT_CONFIG_STRATEGY.assetOFT.metadata.name,
                DEPLOYMENT_CONFIG_STRATEGY.assetOFT.metadata.symbol,
                endpointV2.address,
                deployer,
            ],
            log: true,
            skipIfAlreadyDeployed: true,
        })
        deployedContracts.assetOFT = assetOFT.address
        console.log(
            `Deployed contract: ${DEPLOYMENT_CONFIG_STRATEGY.assetOFT.contract}, network: ${hre.network.name}, address: ${assetOFT.address}`
        )
    }

    if (shouldDeployShareStrategy(networkEid)) {
        const shareOFT = await deployments.deploy(DEPLOYMENT_CONFIG_STRATEGY.shareOFT.contract, {
            from: deployer,
            args: [
                DEPLOYMENT_CONFIG_STRATEGY.shareOFT.metadata.name,
                DEPLOYMENT_CONFIG_STRATEGY.shareOFT.metadata.symbol,
                endpointV2.address,
                deployer,
            ],
            log: true,
            skipIfAlreadyDeployed: true,
        })
        deployedContracts.shareOFT = shareOFT.address
        console.log(
            `Deployed contract: ${DEPLOYMENT_CONFIG_STRATEGY.shareOFT.contract}, network: ${hre.network.name}, address: ${shareOFT.address}`
        )
    }

    if (isVaultChainStrategy(networkEid)) {
        let assetOFTAddress: string
        let assetTokenAddress: string

        if (DEPLOYMENT_CONFIG_STRATEGY.vault.assetOFTAddress) {
            assetOFTAddress = DEPLOYMENT_CONFIG_STRATEGY.vault.assetOFTAddress
            console.log(`Using existing asset address: ${assetOFTAddress}`)
        } else {
            assetOFTAddress =
                deployedContracts.assetOFT ||
                (await hre.deployments.get(DEPLOYMENT_CONFIG_STRATEGY.assetOFT.contract)).address
            console.log(`Using deployed asset address: ${assetOFTAddress}`)
        }

        const IOFTArtifact = await hre.artifacts.readArtifact('IOFT')
        const oftContract = await hre.ethers.getContractAt(IOFTArtifact.abi, assetOFTAddress)
        assetTokenAddress = await oftContract.token()
        console.log(`Underlying asset token address found from OFT deployment: ${assetTokenAddress}`)

        let vaultAddress: string
        if (DEPLOYMENT_CONFIG_STRATEGY.vault.vaultAddress) {
            vaultAddress = DEPLOYMENT_CONFIG_STRATEGY.vault.vaultAddress
            console.log(`Using existing vault address: ${vaultAddress}`)
        } else {
            const strategyDeployment = await deployments.getOrNull('HederaEtfStrategy')
            const strategyAddress = strategyDeployment?.address ?? ZERO_ADDRESS
            if (strategyAddress === ZERO_ADDRESS) {
                console.log('Strategy not deployed yet; vault will start without strategy configured')
            }
            const vault = await deployments.deploy(DEPLOYMENT_CONFIG_STRATEGY.vault.contracts.vault, {
                from: deployer,
                args: [
                    DEPLOYMENT_CONFIG_STRATEGY.shareOFT.metadata.name,
                    DEPLOYMENT_CONFIG_STRATEGY.shareOFT.metadata.symbol,
                    assetTokenAddress,
                    strategyAddress,
                    deployer,
                ],
                log: true,
                skipIfAlreadyDeployed: true,
            })
            vaultAddress = vault.address
            console.log(
                `Deployed contract: ${DEPLOYMENT_CONFIG_STRATEGY.vault.contracts.vault}, network: ${hre.network.name}, address: ${vaultAddress}`
            )
        }

        let shareAdapterAddress: string
        if (!DEPLOYMENT_CONFIG_STRATEGY.vault.shareOFTAdapterAddress) {
            const shareAdapter = await deployments.deploy(DEPLOYMENT_CONFIG_STRATEGY.vault.contracts.shareAdapter, {
                from: deployer,
                args: [vaultAddress, endpointV2.address, deployer],
                log: true,
                skipIfAlreadyDeployed: true,
            })
            shareAdapterAddress = shareAdapter.address
            console.log(
                `Deployed contract: ${DEPLOYMENT_CONFIG_STRATEGY.vault.contracts.shareAdapter}, network: ${hre.network.name}, address: ${shareAdapterAddress}`
            )
        } else {
            const existingAdapter = await hre.deployments.get(DEPLOYMENT_CONFIG_STRATEGY.vault.contracts.shareAdapter)
            shareAdapterAddress = existingAdapter.address
            console.log(
                'Skipping Share Adapter deployment since Share OFT mesh already exists. Existing meshes need to be managed outside of this repo; this script only handles new mesh deployments.'
            )
        }

        const composer = await deployments.deploy(DEPLOYMENT_CONFIG_STRATEGY.vault.contracts.composer, {
            from: deployer,
            args: [vaultAddress, assetOFTAddress, shareAdapterAddress],
            log: true,
            skipIfAlreadyDeployed: true,
        })
        console.log(
            `Deployed contract: ${DEPLOYMENT_CONFIG_STRATEGY.vault.contracts.composer}, network: ${hre.network.name}, address: ${composer.address}`
        )

        deployedContracts.vault = vaultAddress
        deployedContracts.shareAdapter = shareAdapterAddress
        deployedContracts.composer = composer.address
    }

    console.log(`Deployment complete on ${hre.network.name}`)
}

deploy.tags = ['ovault-strategy']

export default deploy
