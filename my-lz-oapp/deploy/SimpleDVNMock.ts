import { type DeployFunction } from 'hardhat-deploy/types'

import { getEidForNetworkName } from '@layerzerolabs/devtools-evm-hardhat'

const contractName = 'SimpleDVNMock'

const deploy: DeployFunction = async ({ getNamedAccounts, deployments, network }) => {
    console.log('Deploy script started...')
    const { deploy } = deployments
    const { deployer } = await getNamedAccounts()
    console.log(`>>> your address: ${deployer}`)

    const receiveUlnAddress = (await deployments.get('ReceiveUln302')).address

    if (!receiveUlnAddress) {
        throw new Error(`No endpoint address found for network: ${network.name}`)
    }

    const localEid = getEidForNetworkName(network.name)

    const deployment = await deploy(contractName, {
        from: deployer,
        args: [receiveUlnAddress, localEid],
        log: true,
        waitConfirmations: 1,
    })

    console.log(`Contract deployed at address: ${deployment.address}`)
}

deploy.tags = [contractName]
export default deploy
