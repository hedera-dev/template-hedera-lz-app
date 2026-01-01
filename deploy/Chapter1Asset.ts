import assert from 'assert'

import { type DeployFunction } from 'hardhat-deploy/types'

import { EndpointId } from '@layerzerolabs/lz-definitions'

// Fetch Hedera USD/HBAR rate (mirrornode). Fallback to env override or a static default.
async function getHtsCreateFeeWei(): Promise<string> {
    // Prefer explicit override (already in wei)
    if (process.env.HTS_CREATE_FEE_WEI) {
        return process.env.HTS_CREATE_FEE_WEI
    }

    const DEFAULT_USD_CENTS = 100 // $1.00
    const TINYBAR_PER_HBAR = 100_000_000
    const WEI_PER_TINYBAR = 10_000_000_000 // scale 1e8 tinybar to 1e18 wei-equivalent

    try {
        const res = await fetch('https://mainnet.mirrornode.hedera.com/api/v1/network/exchangerate')
        const data = (await res.json()) as {
            current_rate: { cent_equivalent: number; hbar_equivalent: number }
        }
        const { cent_equivalent, hbar_equivalent } = data.current_rate
        const tinybar = (DEFAULT_USD_CENTS * hbar_equivalent * TINYBAR_PER_HBAR) / cent_equivalent
        // Scale tinybar (1e8) to wei-like (1e18) for hardhat deploy value
        const weiLike = Math.floor(tinybar) * WEI_PER_TINYBAR
        return weiLike.toString()
    } catch {
        // Fallback: assume $1 ≈ 1 HBAR -> 1e8 tinybar, scale to wei
        const fallbackWei = TINYBAR_PER_HBAR * WEI_PER_TINYBAR
        return fallbackWei.toString()
    }
}

const deploy: DeployFunction = async (hre) => {
    const { getNamedAccounts, deployments } = hre
    const { deployer } = await getNamedAccounts()
    const networkEid = hre.network.config?.eid

    assert(deployer, 'Missing named deployer account')
    assert(networkEid, `Network ${hre.network.name} is missing 'eid' in config`)

    const endpointV2Deployment = await hre.deployments.get('EndpointV2')

    if (networkEid === EndpointId.BASESEP_V2_TESTNET) {
        const { address } = await deployments.deploy('MyNativeOFTAdapter', {
            from: deployer,
            args: [endpointV2Deployment.address, deployer],
            log: true,
            skipIfAlreadyDeployed: true,
        })
        console.log(`Deployed contract: MyNativeOFTAdapter, network: ${hre.network.name}, address: ${address}`)
    }

    if (networkEid === EndpointId.HEDERA_V2_TESTNET) {
        const tokenName = process.env.WETH_NAME || 'Wrapped Ether'
        const tokenSymbol = process.env.WETH_SYMBOL || 'WETH'
        const value = await getHtsCreateFeeWei()

        console.log('value', value)

        const { address } = await deployments.deploy('MyHTSConnector', {
            from: deployer,
            args: [tokenName, tokenSymbol, endpointV2Deployment.address, deployer],
            value,
            log: true,
            skipIfAlreadyDeployed: true,
            gasLimit: 3_500_000, // increase gas limit
        })
        console.log(`Deployed contract: MyHTSConnector, network: ${hre.network.name}, address: ${address}`)
    }
}

deploy.tags = ['chapter1-asset']

export default deploy
