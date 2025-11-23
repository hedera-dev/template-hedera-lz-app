import { readFileSync } from 'node:fs'
import path from 'node:path'

import { createLogger } from '@layerzerolabs/io-devtools'
import { EndpointId } from '@layerzerolabs/lz-definitions'
import { ExecutorOptionType } from '@layerzerolabs/lz-v2-utilities'
import { IMetadata, TwoWayConfig, defaultFetchMetadata, generateConnectionsConfig } from '@layerzerolabs/metadata-tools'
import { OAppEnforcedOption } from '@layerzerolabs/toolbox-hardhat'

import type { OmniPointHardhat } from '@layerzerolabs/toolbox-hardhat'

const logger = createLogger()
const deploymentsRoot = path.join(__dirname, 'deployments')

const deploymentFolderByEid: Record<number, string> = {
    [EndpointId.BASESEP_V2_TESTNET]: 'base-sepolia',
    [EndpointId.HEDERA_V2_TESTNET]: 'hedera-testnet',
}

const loadDeploymentAddress = (eid: number, contractName: string): string => {
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

// ============================================================================
// SECTION 1: CONTRACT DEFINITIONS - YOU MUST EDIT THIS
// ============================================================================
// Define your OApp contracts on each chain
// Update these with your actual contract names and endpoint IDs

const hederaContract: OmniPointHardhat = {
    eid: EndpointId.HEDERA_V2_TESTNET, // Change to your network's endpoint ID
    contractName: 'MyOFT', // Change to your deployed contract name
}

const baseContract: OmniPointHardhat = {
    eid: EndpointId.BASESEP_V2_TESTNET, // Change to your network's endpoint ID
    contractName: 'MyOFT', // Change to your deployed contract name
}

// Add more contracts here if you have more chains:
// const baseContract: OmniPointHardhat = {
//     eid: EndpointId.BASE_V2_TESTNET,
//     contractName: 'MyOFT',
// }

// ============================================================================
// SECTION 2: GAS OPTIONS - YOU MAY NEED TO EDIT THIS
// ============================================================================
// These are the gas limits for receiving messages on destination chains
// For production, profile your contract's gas usage and adjust the 'gas' value
// To learn more: https://docs.layerzero.network/v2/concepts/applications/oapp-standard#execution-options-and-enforced-settings

const EVM_ENFORCED_OPTIONS: OAppEnforcedOption[] = [
    {
        msgType: 1,
        optionType: ExecutorOptionType.LZ_RECEIVE,
        gas: 80000, // <-- EDIT THIS: Set appropriate gas limit for your contract
        value: 0,
    },
]

// ============================================================================
// SECTION 3: METADATA CONFIGURATION - MOSTLY BOILERPLATE
// ============================================================================
// This function extends LayerZero's default metadata with your custom workers
// You only need to edit the executor and DVN addresses below

const customFetchMetadata = async (): Promise<IMetadata> => {
    // ==== BOILERPLATE START - DO NOT EDIT ====
    // First, get the default metadata from LayerZero
    const defaultMetadata = await defaultFetchMetadata()

    // Collect all unique endpoint IDs from configured contracts
    const configuredContracts = [hederaContract, baseContract] // <-- ADD YOUR CONTRACTS HERE TOO
    const configuredEids = [...new Set(configuredContracts.map((contract) => contract.eid))]

    // Discover chainKeys for configured endpoints
    const chainKeyMap: Record<number, string> = {}

    for (const [chainKey, chainData] of Object.entries(defaultMetadata)) {
        if (chainData.deployments) {
            for (const deployment of chainData.deployments) {
                const eid = Number(deployment.eid)
                if (configuredEids.includes(eid)) {
                    chainKeyMap[eid] = chainKey
                }
            }
        }
    }

    // Log discovered chainKeys
    if (Object.keys(chainKeyMap).length > 0) {
        logger.info('Discovered chainKey mappings:')
        configuredContracts.forEach((contract) => {
            const chainKey = chainKeyMap[contract.eid]
            if (chainKey) {
                logger.info(`  ${contract.contractName} (eid: ${contract.eid}): ${chainKey}`)
            }
        })
    } else {
        logger.warn('No chainKeys found for configured endpoints')
    }
    // ==== BOILERPLATE END ====

    // ============================================================================
    // SECTION 4: CUSTOM EXECUTOR AND DVN ADDRESSES - YOU MUST EDIT THIS
    // ============================================================================
    // Replace these addresses with your deployed executor and DVN contracts
    // Get addresses from: ./deployments/<network-name>/YourContract.json

    const customExecutorsByEid: Record<number, { address: string }> = {
        [EndpointId.BASESEP_V2_TESTNET]: { address: loadDeploymentAddress(EndpointId.BASESEP_V2_TESTNET, 'SimpleExecutorMock') },
        [EndpointId.HEDERA_V2_TESTNET]: { address: loadDeploymentAddress(EndpointId.HEDERA_V2_TESTNET, 'SimpleExecutorMock') },
        // Add more executors for other chains:
        // [EndpointId.BASE_V2_TESTNET]: { address: loadDeploymentAddress(EndpointId.BASE_V2_TESTNET, 'SimpleExecutorMock') },
    }

    const customDVNsByEid: Record<number, { address: string }> = {
        [EndpointId.BASESEP_V2_TESTNET]: { address: loadDeploymentAddress(EndpointId.BASESEP_V2_TESTNET, 'SimpleDVNMock') },
        [EndpointId.HEDERA_V2_TESTNET]: { address: loadDeploymentAddress(EndpointId.HEDERA_V2_TESTNET, 'SimpleDVNMock') },
        // Add more DVNs for other chains:
        // [EndpointId.BASE_V2_TESTNET]: { address: loadDeploymentAddress(EndpointId.BASE_V2_TESTNET, 'SimpleDVNMock') },
    }

    // ==== BOILERPLATE START - DO NOT EDIT ====
    // Build the extended metadata dynamically based on discovered chainKeys
    const extendedMetadata: IMetadata = { ...defaultMetadata }

    // Add custom executors and DVNs for each configured endpoint
    configuredEids.forEach((eid) => {
        const chainKey = chainKeyMap[eid]
        if (!chainKey) {
            logger.warn(`No chainKey found for eid ${eid}, skipping custom executor/DVN configuration`)
            return
        }

        // Initialize chain metadata if it doesn't exist
        if (!extendedMetadata[chainKey]) {
            extendedMetadata[chainKey] = defaultMetadata[chainKey] || {}
        }

        // Add custom executor if defined for this endpoint
        const customExecutor = customExecutorsByEid[eid]
        if (customExecutor) {
            extendedMetadata[chainKey] = {
                ...extendedMetadata[chainKey],
                executors: {
                    ...extendedMetadata[chainKey]?.executors,
                    [customExecutor.address]: {
                        version: 2,
                        canonicalName: 'MyCustomExecutor', // <-- OPTIONAL: Change this name if desired
                        id: `my-custom-executor-${chainKey}`,
                    },
                },
            }
        }

        // Add custom DVN if defined for this endpoint
        const customDVN = customDVNsByEid[eid]
        if (customDVN) {
            extendedMetadata[chainKey] = {
                ...extendedMetadata[chainKey],
                dvns: {
                    ...extendedMetadata[chainKey]?.dvns,
                    [customDVN.address]: {
                        version: 2,
                        canonicalName: 'MyCustomDVN', // <-- OPTIONAL: Change this name if desired
                        id: `my-custom-dvn-${chainKey}`,
                    },
                },
            }
        }
    })

    return extendedMetadata
}
// ==== BOILERPLATE END ====

// ============================================================================
// SECTION 5: PATHWAY CONFIGURATION - YOU MUST EDIT THIS
// ============================================================================
// Define connections between your contracts
// Pathways are automatically bidirectional (A→B and B→A)
// Use the canonical names you defined above for DVNs and Executors

const pathways: TwoWayConfig[] = [
    [
        hederaContract, // Source contract
        baseContract, // Destination contract
        [['MyCustomDVN'], []], // DVN configuration: [[requiredDVNs], [optionalDVNs]]
        [1, 1], // Confirmations: [srcToDestConfirmations, destToSrcConfirmations]
        [EVM_ENFORCED_OPTIONS, EVM_ENFORCED_OPTIONS], // Gas options for each direction
        'MyCustomExecutor', // Executor name (must match canonicalName above)
    ],
    // Add more pathways for additional chain pairs:
    // [
    //     optimismContract,
    //     baseContract,
    //     [['MyCustomDVN'], []],
    //     [1, 1],
    //     [EVM_ENFORCED_OPTIONS, EVM_ENFORCED_OPTIONS],
    //     'MyCustomExecutor',
    // ],
]

// ============================================================================
// SECTION 6: EXPORT CONFIGURATION
// ============================================================================
// This exports your complete configuration
// Only edit the contracts array if you added more chains

export default async function () {
    // Generate the connections config with your custom metadata
    const connections = await generateConnectionsConfig(pathways, { fetchMetadata: customFetchMetadata })
    return {
        contracts: [
            { contract: baseContract },
            { contract: hederaContract },
            // Add more contracts here if you have more chains:
            // { contract: baseContract },
        ],
        connections,
    }
}
