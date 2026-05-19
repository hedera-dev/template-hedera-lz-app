import { createMeshConfig } from './shared'

/**
 * Strategy share OFT mesh configuration
 * Used for: Chapter 3 ETF strategy vault share flows
 *
 * Hedera (hub): MyShareOFTAdapterStrategy - adapts strategy vault shares
 * Base (spoke): MyShareOFT - represents strategy shares on Base
 */
export default createMeshConfig({
    hedera: { contractName: 'MyShareOFTAdapterStrategy' },
    base: { contractName: 'MyShareOFT' },
})
