import { task } from 'hardhat/config'

task('fix-composer-approval', 'Fix HTS approval for composer to vault')
    .addParam('composer', 'Composer contract address')
    .addParam('vault', 'Vault contract address')
    .addParam('token', 'HTS token address')
    .setAction(async (args, hre) => {
        const { ethers } = hre
        const [signer] = await ethers.getSigners()

        console.log('Fixing composer approval...')
        console.log('Composer:', args.composer)
        console.log('Vault:', args.vault)
        console.log('Token:', args.token)

        // HTS Precompile address
        const HTS_PRECOMPILE = '0x0000000000000000000000000000000000000167'

        // ABI for HTS approve function
        const approveAbi = [
            'function approve(address token, address spender, uint256 amount) external returns (int64)',
        ]

        // Call approve on the composer contract (it inherits HederaTokenService)
        const composerAbi = [
            'function ASSET_OFT() view returns (address)',
            'function VAULT() view returns (address)',
        ]

        const composer = new ethers.Contract(args.composer, composerAbi, signer)

        // Verify the addresses match
        const assetOft = await composer.ASSET_OFT()
        const vault = await composer.VAULT()
        console.log('Composer ASSET_OFT:', assetOft)
        console.log('Composer VAULT:', vault)

        // Check if we need to associate the composer with the token first
        const associateAbi = ['function associateToken(address account, address token) external returns (int64)']

        const htsPrecompile = new ethers.Contract(HTS_PRECOMPILE, [...associateAbi, ...approveAbi], signer)

        console.log('\nAttempting to associate composer with token...')
        try {
            const associateTx = await htsPrecompile.associateToken(args.composer, args.token, {
                gasLimit: 1_000_000,
            })
            const receipt = await associateTx.wait()
            console.log('Association tx:', receipt.hash)
        } catch (e: any) {
            console.log('Association failed (may already be associated):', e.message?.slice(0, 100))
        }

        console.log('\nAttempting to approve vault to spend composer tokens...')
        const maxAllowance = BigInt(2) ** BigInt(63) - BigInt(1) // Max HTS allowance

        try {
            // Try calling approve via the precompile
            const approveTx = await htsPrecompile.approve(args.token, args.vault, maxAllowance, {
                gasLimit: 1_000_000,
            })
            const receipt = await approveTx.wait()
            console.log('Approval tx:', receipt.hash)
        } catch (e: any) {
            console.log('Approval via precompile failed:', e.message?.slice(0, 100))
        }

        console.log('\nDone!')
    })
