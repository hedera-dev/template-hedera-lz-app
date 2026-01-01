import assert from 'assert'

import { type DeployFunction } from 'hardhat-deploy/types'

const deploy: DeployFunction = async (hre) => {
    const { getNamedAccounts, deployments } = hre
    const { deployer } = await getNamedAccounts()

    assert(deployer, 'Missing named deployer account')

    const asset = process.env.STRATEGY_ASSET
    const hustlers = process.env.STRATEGY_HUSTLERS
    const whbar = process.env.STRATEGY_WHBAR
    const router = process.env.STRATEGY_ROUTER

    assert(asset, 'Missing STRATEGY_ASSET')
    assert(hustlers, 'Missing STRATEGY_HUSTLERS')
    assert(whbar, 'Missing STRATEGY_WHBAR')
    assert(router, 'Missing STRATEGY_ROUTER')

    await deployments.deploy('HederaEtfStrategy', {
        from: deployer,
        args: [asset, hustlers, whbar, router, deployer],
        log: true,
        skipIfAlreadyDeployed: true,
    })
}

deploy.tags = ['strategy']

export default deploy
