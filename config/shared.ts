import { createLogger } from '@layerzerolabs/io-devtools'
import { EndpointId } from '@layerzerolabs/lz-definitions'
import { ExecutorOptionType } from '@layerzerolabs/lz-v2-utilities'
import { IMetadata, TwoWayConfig, defaultFetchMetadata, generateConnectionsConfig } from '@layerzerolabs/metadata-tools'
import { OAppEnforcedOption, OmniPointHardhat } from '@layerzerolabs/toolbox-hardhat'

import { loadDeploymentAddress } from './utils'

const logger = createLogger()

// Standard enforced options for EVM chains
const EVM_ENFORCED_OPTIONS: OAppEnforcedOption[] = [
    {
        msgType: 1,
        optionType: ExecutorOptionType.LZ_RECEIVE,
        gas: 100_000,
        value: 0,
    },
    {
        msgType: 2,
        optionType: ExecutorOptionType.LZ_RECEIVE,
        gas: 100_000,
        value: 0,
    },
]

// Supported endpoint IDs for this tutorial
export const HEDERA_EID = EndpointId.HEDERA_V2_TESTNET
export const BASE_EID = EndpointId.BASESEP_V2_TESTNET

export interface MeshConfig {
    hedera: { contractName: string }
    base: { contractName: string }
}

/**
 * Creates a LayerZero mesh configuration for a pair of contracts.
 * This factory extracts the common DVN/executor setup used across all meshes.
 */
export function createMeshConfig(mesh: MeshConfig) {
    const hederaContract: OmniPointHardhat = {
        eid: HEDERA_EID,
        contractName: mesh.hedera.contractName,
    }

    const baseContract: OmniPointHardhat = {
        eid: BASE_EID,
        contractName: mesh.base.contractName,
    }

    const configuredContracts = [hederaContract, baseContract]
    const configuredEids = [...new Set(configuredContracts.map((c) => c.eid))]

    const createCustomFetchMetadata = () => async (): Promise<IMetadata> => {
        const defaultMetadata = await defaultFetchMetadata()

        // Build chainKey mappings from default metadata
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

        // Load custom executor addresses from deployments
        const customExecutorsByEid: Record<number, { address: string }> = {
            [BASE_EID]: { address: loadDeploymentAddress(BASE_EID, 'SimpleExecutorMock') },
            [HEDERA_EID]: { address: loadDeploymentAddress(HEDERA_EID, 'SimpleExecutorMock') },
        }

        // Load custom DVN addresses from deployments
        const customDVNsByEid: Record<number, { address: string }> = {
            [BASE_EID]: { address: loadDeploymentAddress(BASE_EID, 'SimpleDVNMock') },
            [HEDERA_EID]: { address: loadDeploymentAddress(HEDERA_EID, 'SimpleDVNMock') },
        }

        // Extend default metadata with custom executor/DVN
        const extendedMetadata: IMetadata = { ...defaultMetadata }

        configuredEids.forEach((eid) => {
            const chainKey = chainKeyMap[eid]
            if (!chainKey) {
                logger.warn(`No chainKey found for eid ${eid}, skipping custom executor/DVN configuration`)
                return
            }

            if (!extendedMetadata[chainKey]) {
                extendedMetadata[chainKey] = defaultMetadata[chainKey] || {}
            }

            const customExecutor = customExecutorsByEid[eid]
            if (customExecutor) {
                extendedMetadata[chainKey] = {
                    ...extendedMetadata[chainKey],
                    executors: {
                        ...extendedMetadata[chainKey]?.executors,
                        [customExecutor.address]: {
                            version: 2,
                            canonicalName: 'SimpleExecutorMock',
                            id: `my-custom-executor-${chainKey}`,
                        },
                    },
                }
            }

            const customDVN = customDVNsByEid[eid]
            if (customDVN) {
                extendedMetadata[chainKey] = {
                    ...extendedMetadata[chainKey],
                    dvns: {
                        ...extendedMetadata[chainKey]?.dvns,
                        [customDVN.address]: {
                            version: 2,
                            canonicalName: 'SimpleDVNMock',
                            id: `my-custom-dvn-${chainKey}`,
                        },
                    },
                }
            }
        })

        return extendedMetadata
    }

    const pathways: TwoWayConfig[] = [
        [
            hederaContract,
            baseContract,
            [['SimpleDVNMock'], []], // DVN configuration
            [1, 1], // Confirmations
            [EVM_ENFORCED_OPTIONS, EVM_ENFORCED_OPTIONS],
            'SimpleExecutorMock',
        ],
    ]

    return async function () {
        const connections = await generateConnectionsConfig(pathways, {
            fetchMetadata: createCustomFetchMetadata(),
        })
        return {
            contracts: [{ contract: hederaContract }, { contract: baseContract }],
            connections,
        }
    }
}
