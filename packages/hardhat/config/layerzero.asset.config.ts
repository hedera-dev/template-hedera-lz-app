import { createMeshConfig } from './shared'

/**
 * Asset OFT mesh configuration
 * Used for: Chapter 1 cross-chain transfers & OVault asset flows
 *
 * Hedera (hub): MyHTSConnector - wraps native ETH to HTS token
 * Base (spoke): MyNativeOFTAdapter - adapts native ETH for LayerZero
 */
export default createMeshConfig({
    hedera: { contractName: 'MyHTSConnector' },
    base: { contractName: 'MyNativeOFTAdapter' },
})
