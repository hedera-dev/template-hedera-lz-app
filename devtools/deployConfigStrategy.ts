import { EndpointId } from '@layerzerolabs/lz-definitions'

import { DeploymentConfig } from './types'

// ============================================
// OVault Strategy Deployment Configuration (Chapter 3)
// npx hardhat lz:deploy --tags ovault-strategy
// ============================================

const _hubEid = EndpointId.HEDERA_V2_TESTNET
const _spokeEids = [EndpointId.BASESEP_V2_TESTNET]

export const DEPLOYMENT_CONFIG_STRATEGY: DeploymentConfig = {
    vault: {
        deploymentEid: _hubEid,
        contracts: {
            vault: 'MyERC4626Strategy',
            shareAdapter: 'MyShareOFTAdapterStrategy',
            composer: 'MyOVaultComposerStrategy',
        },
        vaultAddress: undefined,
        assetOFTAddress: undefined,
        shareOFTAdapterAddress: undefined,
    },
    shareOFT: {
        contract: 'MyShareOFT',
        metadata: {
            name: 'MyShareOFT',
            symbol: 'SHARE',
        },
        deploymentEids: _spokeEids,
    },
    assetOFT: {
        contract: 'MyHTSConnector',
        metadata: {
            name: 'WETH',
            symbol: 'WETH',
        },
        deploymentEids: [_hubEid],
    },
} as const

export const isVaultChainStrategy = (eid: number): boolean => eid === DEPLOYMENT_CONFIG_STRATEGY.vault.deploymentEid
export const shouldDeployAssetStrategy = (eid: number): boolean =>
    !DEPLOYMENT_CONFIG_STRATEGY.vault.assetOFTAddress && DEPLOYMENT_CONFIG_STRATEGY.assetOFT.deploymentEids.includes(eid)
export const shouldDeployShareStrategy = (eid: number): boolean =>
    !DEPLOYMENT_CONFIG_STRATEGY.vault.shareOFTAdapterAddress &&
    DEPLOYMENT_CONFIG_STRATEGY.shareOFT.deploymentEids.includes(eid)
