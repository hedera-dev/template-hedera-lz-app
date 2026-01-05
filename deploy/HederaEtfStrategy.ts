import assert from 'assert'
import fs from 'fs'
import path from 'path'

import { type DeployFunction } from 'hardhat-deploy/types'
import { EndpointId } from '@layerzerolabs/lz-definitions'

import { loadDeploymentAddress } from '../config/utils'

const deploy: DeployFunction = async (hre) => {
    const { getNamedAccounts, deployments } = hre
    const { deployer } = await getNamedAccounts()

    assert(deployer, 'Missing named deployer account')

    const configPath = path.resolve(process.cwd(), 'env/addresses.testnet.json')
    const config = JSON.parse(fs.readFileSync(configPath, 'utf8'))
    const addresses = config['hedera-testnet']

    assert(addresses, 'Missing hedera-testnet addresses config')
    assert(addresses.routerV1, 'Missing routerV1 in addresses config')
    assert(addresses.whbarToken, 'Missing whbarToken in addresses config')
    assert(addresses.hustlersToken, 'Missing hustlersToken in addresses config')

    const connectorAddress = loadDeploymentAddress(EndpointId.HEDERA_V2_TESTNET, 'MyHTSConnector')
    const ioftArtifact = await hre.artifacts.readArtifact('IOFT')
    const oft = await hre.ethers.getContractAt(ioftArtifact.abi, connectorAddress)
    const assetToken = await oft.token()

    const asset = assetToken
    const hustlers = addresses.hustlersToken
    const whbar = addresses.whbarToken
    const router = addresses.routerV1

    await deployments.deploy('HederaEtfStrategy', {
        from: deployer,
        args: [asset, hustlers, whbar, router, deployer],
        log: true,
        skipIfAlreadyDeployed: true,
    })
}

deploy.tags = ['strategy']

export default deploy
