pnpm compile

pnpm hardhat lz:deploy --tags chapter1-asset # todo: change tag

# Deploy SimpleDVNMock

pnpm hardhat lz:deploy --tags SimpleDVNMock

# Deploy SimpleExecutorMock

pnpm hardhat lz:deploy --tags SimpleExecutorMock

pnpm hardhat lz:oapp:wire --oapp-config config/layerzero.asset.config.ts

# verify contracts on Hedera... (todo: add this automatically?)

pnpm hardhat lz:oft:send --src-eid 40245 --dst-eid 40285 --amount 0.01 --to 0x20d1E5f39a5B0E8Bb4Be2abdc8Efe93430B10D76 --simple-workers # this amount is needed for seeding liquidity pools in chapter 3

pnpm hardhat lz:deploy --tags ovault

pnpm hardhat lz:oapp:wire --oapp-config config/layerzero.share.config.ts
pnpm hardhat lz:oapp:wire --oapp-config config/layerzero.asset.config.ts # to do: confirm if this one needed again

pnpm hardhat lz:ovault:send --src-eid 40245 --dst-eid 40285 --amount 0.001 --to 0x20d1E5f39a5B0E8Bb4Be2abdc8Efe93430B10D76 --token-type asset --simple-workers # base asset to hedera share

# base asset to base share

pnpm hardhat lz:ovault:send --src-eid 40245 --dst-eid 40245 --amount 0.001 --to 0x20d1E5f39a5B0E8Bb4Be2abdc8Efe93430B10D76 --token-type asset --simple-workers

# redeem hedera share to base asset

pnpm hardhat lz:ovault:send --src-eid 40285 --dst-eid 40245 --amount 0.001 --to 0x20d1E5f39a5B0E8Bb4Be2abdc8Efe93430B10D76 --token-type share --simple-workers

# redeem base share to base asset

pnpm hardhat lz:ovault:send --src-eid 40245 --dst-eid 40245 --amount 0.001 --to 0x20d1E5f39a5B0E8Bb4Be2abdc8Efe93430B10D76 --token-type share --simple-workers

# check block explorers to ensure vault transfers happened successfully

# phase 3 - env set up

pnpm hardhat lz:setup:deploy-hustlers # create hustlers token; updated in config automatically

pnpm hardhat lz:setup:create-pools --network hedera-testnet # todo: see if we can remove --network flag

# need to have a fair bit of hbar for this... trick is to create 5x accounts on hedera portal and transfer over to one

pnpm hardhat lz:deploy --tags chapter3

pnpm hardhat lz:oapp:wire --oapp-config config/layerzero.share.strategy.config.ts
pnpm hardhat lz:ovault:send \
 --src-eid 40245 \
 --dst-eid 40285 \
 --amount 0.001 \
 --to 0x20d1E5f39a5B0E8Bb4Be2abdc8Efe93430B10D76 \
 --token-type asset \
 --composer-contract MyOVaultComposerStrategy \
 --vault-contract MyERC4626Strategy \
 --simple-workers \
 --lz-compose-gas 7000000 \
--share-oapp-config config/layerzero.share.strategy.config.ts
