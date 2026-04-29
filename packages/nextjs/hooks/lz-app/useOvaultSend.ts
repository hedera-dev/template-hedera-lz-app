"use client";

import { useAccount, usePublicClient } from "wagmi";
import { buildOvaultSendParam, normalizeQuote, Side } from "./ovaultSendParam";
import { useDeployedContractInfo, useScaffoldWriteContract } from "~~/hooks/scaffold-hbar";

const BASE_CHAIN_ID = 84532;
const HEDERA_EID = 40285;
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

export const useOvaultSend = (side: Side) => {
  const { address } = useAccount();
  const baseClient = usePublicClient({ chainId: BASE_CHAIN_ID });
  const hederaClient = usePublicClient({ chainId: 296 });
  const contractName = side === "deposit" ? "MyNativeOFTAdapter" : "MyShareOFT";
  const write = useScaffoldWriteContract(contractName, BASE_CHAIN_ID);
  const vaultDeployment = useDeployedContractInfo("MyERC4626Strategy", 296);
  const composerDeployment = useDeployedContractInfo("MyOVaultComposerStrategy", 296);
  const shareOftHub = useDeployedContractInfo("MyShareOFTAdapterStrategy", 296);
  const assetOftHub = useDeployedContractInfo("MyHTSConnector", 296);

  const send = async (amount: string, crossChain: boolean) => {
    if (!address) throw new Error("Connect wallet first");
    if (!write.deployment) throw new Error(`Missing deployment for ${contractName} on Base Sepolia`);
    if (!vaultDeployment || !composerDeployment) throw new Error("Missing hub composer/vault deployment");
    if (!baseClient || !hederaClient) throw new Error("Missing public client for Base/Hedera");

    const { amountWei, sendParam, composeValue, composeGas } = await buildOvaultSendParam({
      side,
      amount,
      crossChain,
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
    })) as `0x${string}`;
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
    const destinationOftAddress =
      side === "deposit" ? (assetOftHub?.address as `0x${string}` | undefined) : (shareOftHub?.address as `0x${string}` | undefined);

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
    };
  };

  return { ...write, send };
};
