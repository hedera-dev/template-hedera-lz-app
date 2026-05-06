"use client";

import { useAccount, usePublicClient } from "wagmi";
import { encodeFunctionData, parseEther } from "viem";
import {
  BASE_EID,
  buildRedeemSendParam,
  buildOvaultSendParam,
  HEDERA_EID,
  normalizeQuote,
  RedeemMode,
  Side,
} from "./ovaultSendParam";
import { useDeployedContractInfo, useScaffoldWriteContract } from "~~/hooks/scaffold-hbar";

const BASE_CHAIN_ID = 84532;
const HEDERA_CHAIN_ID = 296;
const HEDERA_GAS_LIMIT = 15_000_000n;
const ENDPOINT_ABI = [
  {
    inputs: [
      { internalType: "address", name: "_sender", type: "address" },
      { internalType: "uint32", name: "_dstEid", type: "uint32" },
      { internalType: "bytes32", name: "_receiver", type: "bytes32" },
    ],
    name: "outboundNonce",
    outputs: [{ internalType: "uint64", name: "", type: "uint64" }],
    stateMutability: "view",
    type: "function",
  },
] as const;
const OAPP_PEER_ABI = [
  {
    inputs: [{ internalType: "uint32", name: "_eid", type: "uint32" }],
    name: "peers",
    outputs: [{ internalType: "bytes32", name: "peer", type: "bytes32" }],
    stateMutability: "view",
    type: "function",
  },
] as const;
const COMPOSER_OFTS_ABI = [
  { inputs: [], name: "ASSET_OFT", outputs: [{ type: "address" }], stateMutability: "view", type: "function" },
  { inputs: [], name: "SHARE_OFT", outputs: [{ type: "address" }], stateMutability: "view", type: "function" },
] as const;
const OFT_INFO_ABI = [
  { inputs: [], name: "endpoint", outputs: [{ type: "address" }], stateMutability: "view", type: "function" },
] as const;
const ERC20_ALLOWANCE_APPROVE_ABI = [
  {
    inputs: [
      { name: "owner", type: "address" },
      { name: "spender", type: "address" },
    ],
    name: "allowance",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    name: "approve",
    outputs: [{ name: "", type: "bool" }],
    stateMutability: "nonpayable",
    type: "function",
  },
] as const;

export const useOvaultSend = (side: Side, redeemMode: RedeemMode = "local") => {
  const { address } = useAccount();
  const baseClient = usePublicClient({ chainId: BASE_CHAIN_ID });
  const hederaClient = usePublicClient({ chainId: HEDERA_CHAIN_ID });
  const contractName = side === "deposit" ? "MyNativeOFTAdapter" : "MyShareOFT";
  const write = useScaffoldWriteContract(contractName, BASE_CHAIN_ID);
  const composerWrite = useScaffoldWriteContract("MyOVaultComposerStrategy", HEDERA_CHAIN_ID);
  const vaultWrite = useScaffoldWriteContract("MyERC4626Strategy", HEDERA_CHAIN_ID);
  const vaultDeployment = useDeployedContractInfo("MyERC4626Strategy", HEDERA_CHAIN_ID);
  const composerDeployment = useDeployedContractInfo("MyOVaultComposerStrategy", HEDERA_CHAIN_ID);
  const shareOftHub = useDeployedContractInfo("MyShareOFTAdapterStrategy", HEDERA_CHAIN_ID);
  const assetOftHub = useDeployedContractInfo("MyHTSConnector", HEDERA_CHAIN_ID);
  const nativeOftBase = useDeployedContractInfo("MyNativeOFTAdapter", BASE_CHAIN_ID);

  const send = async (amount: string) => {
    if (!address) throw new Error("Connect wallet first");
    if (!vaultDeployment || !composerDeployment) throw new Error("Missing hub composer/vault deployment");
    if (!baseClient || !hederaClient) throw new Error("Missing public client for Base/Hedera");

    if (side === "redeem") {
      if (!assetOftHub?.address) throw new Error("Missing hub asset OFT deployment");
      if (!shareOftHub?.address) throw new Error("Missing hub share OFT deployment");
      if (redeemMode === "crossChainToBase" && !nativeOftBase?.address) {
        throw new Error("Missing Base native OFT deployment");
      }

      const shareAmount = parseEther(amount || "0");
      const previewRaw = await hederaClient.readContract({
        address: vaultDeployment.address,
        abi: vaultDeployment.abi,
        functionName: "previewRedeem",
        args: [shareAmount],
      });
      const expectedAssets = previewRaw as unknown as bigint;
      const redeemDstEid = redeemMode === "crossChainToBase" ? BASE_EID : HEDERA_EID;
      const sendParam = buildRedeemSendParam({
        receiverAddress: address,
        dstEid: redeemDstEid,
        minAmountLD: expectedAssets,
      });

      const allowance = (await hederaClient.readContract({
        address: vaultDeployment.address,
        abi: ERC20_ALLOWANCE_APPROVE_ABI,
        functionName: "allowance",
        args: [address, composerDeployment.address],
      })) as bigint;

      if (allowance < shareAmount) {
        const approveHash = (await vaultWrite.writeContractAsync(
          "approve",
          [composerDeployment.address, shareAmount],
          { gas: 1_000_000n },
        )) as `0x${string}`;
        await hederaClient.waitForTransactionReceipt({ hash: approveHash });
      }

      let redeemMsgValue = 0n;
      if (redeemMode === "crossChainToBase") {
        const quoteRaw = await hederaClient.readContract({
          address: composerDeployment.address,
          abi: composerDeployment.abi,
          functionName: "quoteSend",
          args: [address, assetOftHub.address as `0x${string}`, shareAmount, sendParam],
        });
        redeemMsgValue = normalizeQuote(quoteRaw).nativeFee;
      }

      const txHash = (await composerWrite.writeContractAsync(
        "redeemAndSend",
        [shareAmount, sendParam, address],
        {
          value: redeemMsgValue,
          gas: HEDERA_GAS_LIMIT,
        },
      )) as `0x${string}`;

      const endpointAddress = (await hederaClient.readContract({
        address: assetOftHub.address as `0x${string}`,
        abi: OFT_INFO_ABI,
        functionName: "endpoint",
        args: [],
      })) as unknown as `0x${string}`;
      const peer = (await hederaClient.readContract({
        address: assetOftHub.address as `0x${string}`,
        abi: OAPP_PEER_ABI,
        functionName: "peers",
        args: [redeemDstEid],
      })) as `0x${string}`;
      const nonceRaw = await hederaClient.readContract({
        address: endpointAddress,
        abi: ENDPOINT_ABI,
        functionName: "outboundNonce",
        args: [assetOftHub.address as `0x${string}`, redeemDstEid, peer],
      });
      const outboundNonce = BigInt(nonceRaw) + 1n;

      return {
        txHash,
        outboundNonce,
        sendParam,
        sourceOftAddress: assetOftHub.address as `0x${string}`,
        destinationOftAddress:
          redeemMode === "crossChainToBase"
            ? (nativeOftBase!.address as `0x${string}`)
            : (assetOftHub.address as `0x${string}`),
        composeMsg: undefined,
        composeFrom: undefined,
        composeTo: undefined,
        composeGas: 0n,
        composeValue: 0n,
        needsProcessing: redeemMode === "crossChainToBase",
        srcEid: HEDERA_EID,
        dstEid: redeemDstEid,
        relayerFlow: redeemMode === "crossChainToBase" ? ("ovault_redeem" as const) : undefined,
      };
    }

    if (!write.deployment) throw new Error(`Missing deployment for ${contractName} on Base Sepolia`);

    const { amountWei, sendParam, composeValue, composeGas } = await buildOvaultSendParam({
      side,
      amount,
      receiverAddress: address,
      hederaClient,
      vaultDeployment,
      composerDeployment,
      shareOftHub: shareOftHub || undefined,
      assetOftHub: assetOftHub || undefined,
    });

    const quoteRaw = await baseClient.readContract({
      address: write.deployment.address,
      abi: write.deployment.abi,
      functionName: "quoteSend",
      args: [sendParam, false],
    });

    const quote = normalizeQuote(quoteRaw);

    const msgValue = side === "deposit" ? quote.nativeFee + amountWei : quote.nativeFee;
    const endpointAddress = (await baseClient.readContract({
      address: write.deployment.address,
      abi: write.deployment.abi,
      functionName: "endpoint",
      args: [],
    })) as unknown as `0x${string}`;
    const peer = (await baseClient.readContract({
      address: write.deployment.address,
      abi: OAPP_PEER_ABI,
      functionName: "peers",
      args: [HEDERA_EID],
    })) as `0x${string}`;
    const nonceRaw = await baseClient.readContract({
      address: endpointAddress,
      abi: ENDPOINT_ABI,
      functionName: "outboundNonce",
      args: [write.deployment.address, HEDERA_EID, peer],
    });
    const outboundNonce = BigInt(nonceRaw) + 1n;

    const txHash = (await write.writeContractAsync("send", [sendParam, quote, address], msgValue)) as `0x${string}`;

    const readComposerAddress = async (fn: "ASSET_OFT" | "SHARE_OFT") => {
      try {
        const result = await hederaClient.readContract({
          address: composerDeployment.address,
          abi: COMPOSER_OFTS_ABI,
          functionName: fn,
        });
        return result as `0x${string}`;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        if (!msg.includes("Position") || !msg.includes("out of bounds")) throw err;
        const data = encodeFunctionData({
          abi: COMPOSER_OFTS_ABI,
          functionName: fn,
          args: [],
        });
        const raw = (await hederaClient.request({
          method: "eth_call",
          params: [{ to: composerDeployment.address, data }, "latest"],
        })) as `0x${string}`;
        const body = raw.startsWith("0x") ? raw.slice(2).padStart(64, "0") : raw.padStart(64, "0");
        return `0x${body.slice(-40)}` as `0x${string}`;
      }
    };

    const destinationOftAddress = side === "deposit" ? await readComposerAddress("ASSET_OFT") : await readComposerAddress("SHARE_OFT");

    return {
      txHash,
      outboundNonce,
      sendParam,
      sourceOftAddress: write.deployment.address as `0x${string}`,
      destinationOftAddress,
      composeMsg: sendParam.composeMsg as `0x${string}`,
      composeFrom: address,
      composeTo: composerDeployment.address as `0x${string}`,
      composeGas: BigInt(composeGas),
      composeValue: composeValue,
      needsProcessing: true,
      /** LayerZero route + flow tag for `/api/relayer/bridge` (Base → Hedera vault deposit). */
      srcEid: BASE_EID,
      dstEid: HEDERA_EID,
      relayerFlow: "ovault" as const,
    };
  };

  return { ...write, send };
};
