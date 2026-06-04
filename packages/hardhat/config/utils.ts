import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'

import type { HardhatRuntimeEnvironment } from 'hardhat/types'
import { EndpointId } from '@layerzerolabs/lz-definitions'

const deploymentRoots = [
    // Preferred location after moving hardhat sources into packages/hardhat
    path.join(__dirname, '..', '..', '..', 'deployments'),
    // Backward compatibility for older layout/tests
    path.join(__dirname, '..', 'deployments'),
]

const deploymentFolderByEid: Record<number, string> = {
    [EndpointId.BASESEP_V2_TESTNET]: 'base-sepolia',
    [EndpointId.HEDERA_V2_TESTNET]: 'hedera-testnet',
}

export const loadDeploymentAddress = (eid: number, contractName: string): string => {
    const networkFolder = deploymentFolderByEid[eid]
    if (!networkFolder) {
        throw new Error(`No deployment folder configured for eid ${eid}`)
    }

    const deploymentPath = deploymentRoots
        .map((root) => path.join(root, networkFolder, `${contractName}.json`))
        .find((candidate) => existsSync(candidate))

    if (!deploymentPath) {
        throw new Error(
            `Missing deployment for ${contractName} (${networkFolder}). Tried:\n${deploymentRoots
                .map((root) => path.join(root, networkFolder, `${contractName}.json`))
                .join('\n')}`
        )
    }
    const deploymentRaw = readFileSync(deploymentPath, 'utf8')
    const deployment = JSON.parse(deploymentRaw)
    if (!deployment.address) {
        throw new Error(`Missing address for ${contractName} in ${deploymentPath}`)
    }

    return deployment.address
}

const ADDRESSES_CONFIG_PATH = path.resolve(process.cwd(), 'env/addresses.testnet.json')
const ADDRESSES_NETWORK_KEY = 'hedera-testnet'

/**
 * Persist a single address entry into env/addresses.testnet.json under the
 * hedera-testnet network key. Returns true when the file was actually changed,
 * so callers can decide whether to log the update.
 */
export const updateAddressConfigEntry = (key: string, value: string): boolean => {
    const config = existsSync(ADDRESSES_CONFIG_PATH)
        ? JSON.parse(readFileSync(ADDRESSES_CONFIG_PATH, 'utf8'))
        : {}
    config[ADDRESSES_NETWORK_KEY] = config[ADDRESSES_NETWORK_KEY] || {}

    if (config[ADDRESSES_NETWORK_KEY][key] === value) {
        return false
    }

    config[ADDRESSES_NETWORK_KEY][key] = value
    writeFileSync(ADDRESSES_CONFIG_PATH, `${JSON.stringify(config, null, 2)}\n`)

    return true
}

/**
 * Resolve the underlying HTS token behind a deployed WETH OFT connector and
 * sync it into env/addresses.testnet.json (wethToken). Keeping the config in
 * sync after every connector deploy prevents stale WETH addresses downstream
 * (frontend externalContracts, pool/liquidity tasks, strategy deploys).
 */
export const syncWethTokenAddress = async (
    hre: HardhatRuntimeEnvironment,
    connectorAddress: string
): Promise<string> => {
    const ioftArtifact = await hre.artifacts.readArtifact('IOFT')
    const oft = await hre.ethers.getContractAt(ioftArtifact.abi, connectorAddress)
    const wethToken: string = await oft.token()

    if (updateAddressConfigEntry('wethToken', wethToken)) {
        console.log(`Updated env/addresses.testnet.json wethToken -> ${wethToken}`)
    } else {
        console.log(`env/addresses.testnet.json wethToken already up to date (${wethToken})`)
    }

    return wethToken
}
