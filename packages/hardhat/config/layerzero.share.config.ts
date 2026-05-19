import { createMeshConfig } from './shared'

/**
 * Share OFT mesh configuration
 * Used for: Chapter 2 vault share token flows
 *
 * Hedera (hub): MyShareOFTAdapter - adapts vault shares for LayerZero
 * Base (spoke): MyShareOFT - represents vault shares on Base
 */
export default createMeshConfig({
    hedera: { contractName: 'MyShareOFTAdapter' },
    base: { contractName: 'MyShareOFT' },
})
