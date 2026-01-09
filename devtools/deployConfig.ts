import { EndpointId } from '@layerzerolabs/lz-definitions'

import { DeploymentConfig } from './types'

// ============================================
// Unified Deployment Configuration
// ============================================
//
// This file configures deployments for both:
// - Chapter 2: Basic OVault (tag: ovault)
// - Chapter 3: Strategy OVault (tag: ovault-strategy)
//
// Hub/Spoke Architecture:
// - Hub (Hedera): Vault, ShareAdapter, Composer, HTSConnector
// - Spoke (Base): ShareOFT, NativeOFTAdapter
// ============================================

const HUB_EID = EndpointId.HEDERA_V2_TESTNET
const SPOKE_EIDS = [EndpointId.BASESEP_V2_TESTNET]

// ============================================
// Chapter 2: Basic OVault Configuration
// ============================================
export const DEPLOYMENT_CONFIG: DeploymentConfig = {
    vault: {
        deploymentEid: HUB_EID,
        contracts: {
            vault: 'MyERC4626',
            shareAdapter: 'MyShareOFTAdapter',
            composer: 'MyOVaultComposer',
        },
        // Set these to use existing contracts instead of deploying new ones
        vaultAddress: undefined,
        assetOFTAddress: undefined,
        shareOFTAdapterAddress: undefined,
    },
    shareOFT: {
        contract: 'MyShareOFT',
        metadata: { name: 'MyShareOFT', symbol: 'SHARE' },
        deploymentEids: SPOKE_EIDS,
    },
    assetOFT: {
        contract: 'MyHTSConnector',
        metadata: { name: 'WETH', symbol: 'WETH' },
        deploymentEids: [HUB_EID],
    },
} as const

// ============================================
// Chapter 3: Strategy OVault Configuration
// ============================================
export const DEPLOYMENT_CONFIG_STRATEGY: DeploymentConfig = {
    vault: {
        deploymentEid: HUB_EID,
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
        metadata: { name: 'MyShareOFT', symbol: 'SHARE' },
        deploymentEids: SPOKE_EIDS,
    },
    assetOFT: {
        contract: 'MyHTSConnector',
        metadata: { name: 'WETH', symbol: 'WETH' },
        deploymentEids: [HUB_EID],
    },
} as const

// ============================================
// Helper Functions (shared across both configs)
// ============================================

// Chapter 2 helpers
export const isVaultChain = (eid: number): boolean => eid === DEPLOYMENT_CONFIG.vault.deploymentEid
export const shouldDeployVault = (eid: number): boolean => isVaultChain(eid) && !DEPLOYMENT_CONFIG.vault.vaultAddress
export const shouldDeployAsset = (eid: number): boolean =>
    !DEPLOYMENT_CONFIG.vault.assetOFTAddress && DEPLOYMENT_CONFIG.assetOFT.deploymentEids.includes(eid)
export const shouldDeployShare = (eid: number): boolean =>
    !DEPLOYMENT_CONFIG.vault.shareOFTAdapterAddress && DEPLOYMENT_CONFIG.shareOFT.deploymentEids.includes(eid)
export const shouldDeployShareAdapter = (eid: number): boolean =>
    isVaultChain(eid) && !DEPLOYMENT_CONFIG.vault.shareOFTAdapterAddress

// Chapter 3 helpers
export const isVaultChainStrategy = (eid: number): boolean => eid === DEPLOYMENT_CONFIG_STRATEGY.vault.deploymentEid
export const shouldDeployAssetStrategy = (eid: number): boolean =>
    !DEPLOYMENT_CONFIG_STRATEGY.vault.assetOFTAddress &&
    DEPLOYMENT_CONFIG_STRATEGY.assetOFT.deploymentEids.includes(eid)
export const shouldDeployShareStrategy = (eid: number): boolean =>
    !DEPLOYMENT_CONFIG_STRATEGY.vault.shareOFTAdapterAddress &&
    DEPLOYMENT_CONFIG_STRATEGY.shareOFT.deploymentEids.includes(eid)
