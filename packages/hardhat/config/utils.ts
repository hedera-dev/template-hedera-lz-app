import { readFileSync } from 'node:fs'
import path from 'node:path'
import { EndpointId } from '@layerzerolabs/lz-definitions'

const deploymentsRoot = path.join(__dirname, '..', 'deployments')

const deploymentFolderByEid: Record<number, string> = {
    [EndpointId.BASESEP_V2_TESTNET]: 'base-sepolia',
    [EndpointId.HEDERA_V2_TESTNET]: 'hedera-testnet',
}

export const loadDeploymentAddress = (eid: number, contractName: string): string => {
    const networkFolder = deploymentFolderByEid[eid]
    if (!networkFolder) {
        throw new Error(`No deployment folder configured for eid ${eid}`)
    }

    const deploymentPath = path.join(deploymentsRoot, networkFolder, `${contractName}.json`)
    const deploymentRaw = readFileSync(deploymentPath, 'utf8')
    const deployment = JSON.parse(deploymentRaw)
    if (!deployment.address) {
        throw new Error(`Missing address for ${contractName} in ${deploymentPath}`)
    }

    return deployment.address
}
