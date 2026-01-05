import { createLogger } from '@layerzerolabs/io-devtools'
import { EndpointId } from '@layerzerolabs/lz-definitions'
import { ExecutorOptionType } from '@layerzerolabs/lz-v2-utilities'
import { IMetadata, TwoWayConfig, defaultFetchMetadata, generateConnectionsConfig } from '@layerzerolabs/metadata-tools'
import { OAppEnforcedOption } from '@layerzerolabs/toolbox-hardhat'

import type { OmniPointHardhat } from '@layerzerolabs/toolbox-hardhat'
import { loadDeploymentAddress } from './utils'

const logger = createLogger()

// Strategy share mesh: adapter on Hedera (hub) and ShareOFT on Base
const hederaShareAdapter: OmniPointHardhat = {
    eid: EndpointId.HEDERA_V2_TESTNET,
    contractName: 'MyShareOFTAdapterStrategy',
}

const baseShareOft: OmniPointHardhat = {
    eid: EndpointId.BASESEP_V2_TESTNET,
    contractName: 'MyShareOFT',
}

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

const customFetchMetadata = async (): Promise<IMetadata> => {
    const defaultMetadata = await defaultFetchMetadata()

    const configuredContracts = [hederaShareAdapter, baseShareOft]
    const configuredEids = [...new Set(configuredContracts.map((contract) => contract.eid))]

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

    const customExecutorsByEid: Record<number, { address: string }> = {
        [EndpointId.BASESEP_V2_TESTNET]: {
            address: loadDeploymentAddress(EndpointId.BASESEP_V2_TESTNET, 'SimpleExecutorMock'),
        },
        [EndpointId.HEDERA_V2_TESTNET]: {
            address: loadDeploymentAddress(EndpointId.HEDERA_V2_TESTNET, 'SimpleExecutorMock'),
        },
    }

    const customDVNsByEid: Record<number, { address: string }> = {
        [EndpointId.BASESEP_V2_TESTNET]: {
            address: loadDeploymentAddress(EndpointId.BASESEP_V2_TESTNET, 'SimpleDVNMock'),
        },
        [EndpointId.HEDERA_V2_TESTNET]: {
            address: loadDeploymentAddress(EndpointId.HEDERA_V2_TESTNET, 'SimpleDVNMock'),
        },
    }

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
        hederaShareAdapter,
        baseShareOft,
        [['SimpleDVNMock'], []],
        [1, 1],
        [EVM_ENFORCED_OPTIONS, EVM_ENFORCED_OPTIONS],
        'SimpleExecutorMock',
    ],
]

export default async function () {
    const connections = await generateConnectionsConfig(pathways, { fetchMetadata: customFetchMetadata })
    return {
        contracts: [{ contract: hederaShareAdapter }, { contract: baseShareOft }],
        connections,
    }
}
