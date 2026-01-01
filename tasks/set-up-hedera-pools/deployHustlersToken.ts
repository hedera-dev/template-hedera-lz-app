import fs from 'fs'
import path from 'path'

import { task, types } from 'hardhat/config'

import { AccountId, Client, PrivateKey, TokenCreateTransaction } from '@hiero-ledger/sdk'

const CONFIG_PATH = path.resolve(process.cwd(), 'env/addresses.testnet.json')
const NETWORK_KEY = 'hedera-testnet'

const loadConfig = (): Record<string, any> => {
    if (!fs.existsSync(CONFIG_PATH)) {
        return {}
    }
    return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'))
}

const saveConfig = (config: Record<string, any>) => {
    fs.writeFileSync(CONFIG_PATH, `${JSON.stringify(config, null, 2)}\n`)
}

task('lz:setup:deploy-hustlers', 'Create the HUSTLERS HTS token via the Hiero JS SDK')
    .addOptionalParam('name', 'Token name', 'Hustlers', types.string)
    .addOptionalParam('symbol', 'Token symbol', 'HUSTLERS', types.string)
    .addOptionalParam('decimals', 'Token decimals', 6, types.int)
    .addOptionalParam('supply', 'Initial supply (whole units)', '100000000', types.string)
    .setAction(async (args) => {
        const privateKeyString = process.env.PRIVATE_KEY

        if (!privateKeyString) {
            throw new Error('Set PRIVATE_KEY')
        }

        const privateKey = PrivateKey.fromStringECDSA(privateKeyString)
        const evmAddress = privateKey.publicKey.toEvmAddress()
        const client = Client.forTestnet()
        const accountId = await AccountId.fromEvmAddress(0, 0, evmAddress).populateAccountNum(client)
        const decimals = Number(args.decimals)
        if (!Number.isInteger(decimals) || decimals < 0 || decimals > 18) {
            throw new Error(`Invalid decimals: ${args.decimals}`)
        }

        client.setOperator(accountId, privateKey)

        const tx = await new TokenCreateTransaction()
            .setTokenName(args.name)
            .setTokenSymbol(args.symbol)
            .setDecimals(decimals)
            .setInitialSupply(Number(args.supply))
            .setTreasuryAccountId(accountId)
            .execute(client)

        const receipt = await tx.getReceipt(client)
        const tokenId = receipt.tokenId
        if (!tokenId) {
            throw new Error('Token creation failed')
        }

        const config = loadConfig()
        config[NETWORK_KEY] = config[NETWORK_KEY] || {}
        config[NETWORK_KEY].hustlersToken = tokenId.toSolidityAddress()
        saveConfig(config)

        console.log(`HUSTLERS token ID: ${tokenId.toString()}`)
        console.log(`HUSTLERS EVM address: ${tokenId.toSolidityAddress()}`)
        console.log(`Updated ${CONFIG_PATH}`)
    })
