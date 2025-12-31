import assert from 'assert'

import { type DeployFunction } from 'hardhat-deploy/types'

const deploy: DeployFunction = async (hre) => {
    const { getNamedAccounts, deployments } = hre
    const { deployer } = await getNamedAccounts()

    assert(deployer, 'Missing named deployer account')

    const asset = process.env.STRATEGY_ASSET
    const sauce = process.env.STRATEGY_SAUCE
    const whbar = process.env.STRATEGY_WHBAR
    const router = process.env.STRATEGY_ROUTER
    const hbarFee = process.env.STRATEGY_HBAR_POOL_FEE || '3000'
    const sauceFee = process.env.STRATEGY_SAUCE_POOL_FEE || '3000'

    assert(asset, 'Missing STRATEGY_ASSET')
    assert(sauce, 'Missing STRATEGY_SAUCE')
    assert(whbar, 'Missing STRATEGY_WHBAR')
    assert(router, 'Missing STRATEGY_ROUTER')

    const hbarPoolFee = Number(hbarFee)
    const saucePoolFee = Number(sauceFee)

    if (!Number.isInteger(hbarPoolFee) || hbarPoolFee < 0 || hbarPoolFee > 1_000_000) {
        throw new Error(`Invalid STRATEGY_HBAR_POOL_FEE: ${hbarFee}`)
    }
    if (!Number.isInteger(saucePoolFee) || saucePoolFee < 0 || saucePoolFee > 1_000_000) {
        throw new Error(`Invalid STRATEGY_SAUCE_POOL_FEE: ${sauceFee}`)
    }

    await deployments.deploy('HederaEtfStrategy', {
        from: deployer,
        args: [asset, sauce, whbar, router, hbarPoolFee, saucePoolFee, deployer],
        log: true,
        skipIfAlreadyDeployed: true,
    })
}

deploy.tags = ['strategy']

export default deploy
