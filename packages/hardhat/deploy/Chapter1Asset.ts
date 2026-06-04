import assert from 'assert'

import { type DeployFunction } from 'hardhat-deploy/types'

import { EndpointId } from '@layerzerolabs/lz-definitions'

import { syncWethTokenAddress } from '../config/utils'

// Fetch Hedera USD/HBAR rate (mirrornode). Fallback to env override or a static default.
async function getHtsCreateFeeWei(): Promise<string> {
    const WEI_PER_HBAR = 1_000_000_000_000_000_000n
    const MIN_HBAR = BigInt(process.env.HTS_CREATE_FEE_MIN_HBAR || '20')
    const minFeeWei = MIN_HBAR * WEI_PER_HBAR

    // Prefer explicit override (already in wei)
    if (process.env.HTS_CREATE_FEE_WEI) {
        const overrideFeeWei = BigInt(process.env.HTS_CREATE_FEE_WEI)
        return (overrideFeeWei >= minFeeWei ? overrideFeeWei : minFeeWei).toString()
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
        const weiLike = BigInt(Math.floor(tinybar)) * BigInt(WEI_PER_TINYBAR)
        return (weiLike >= minFeeWei ? weiLike : minFeeWei).toString()
    } catch {
        // Fallback: assume $1 ≈ 1 HBAR -> 1e8 tinybar, scale to wei
        const fallbackWei = BigInt(TINYBAR_PER_HBAR) * BigInt(WEI_PER_TINYBAR)
        return (fallbackWei >= minFeeWei ? fallbackWei : minFeeWei).toString()
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

        // The HTS token is created by the connector at deploy time, so its address
        // changes on every fresh deploy. Sync it into env/addresses.testnet.json
        // immediately to avoid stale WETH addresses in downstream consumers.
        await syncWethTokenAddress(hre, address)
    }
}

deploy.tags = ['chapter1-asset']

export default deploy
