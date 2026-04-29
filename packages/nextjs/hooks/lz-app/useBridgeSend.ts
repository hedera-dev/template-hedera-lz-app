"use client";

import { useQuery } from "@tanstack/react-query";
import { parseEther, parseAbiItem, decodeEventLog } from "viem";
import { useAccount, usePublicClient } from "wagmi";
import { useDeployedContractInfo, useScaffoldWriteContract } from "~~/hooks/scaffold-hbar";

const BASE_CHAIN_ID = 84532;
const HEDERA_EID = 40285;
const ZERO_EVM_ADDRESS = "0x0000000000000000000000000000000000000000" as const;
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

// PacketSent event from LayerZero EndpointV2 - contains the actual nonce used
const PACKET_SENT_ABI = [
  {
    type: "event",
    name: "PacketSent",
    inputs: [
      { name: "encodedPayload", type: "bytes", indexed: false },
      { name: "options", type: "bytes", indexed: false },
      { name: "sendLibrary", type: "address", indexed: false },
    ],
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

const addressToBytes32 = (address: `0x${string}`): `0x${string}` => {
  return `0x${address.slice(2).padStart(64, "0")}` as `0x${string}`;
};
const normalizeQuote = (quoteRaw: unknown): { nativeFee: bigint; lzTokenFee: bigint } => {
  if (Array.isArray(quoteRaw)) {
    return { nativeFee: (quoteRaw[0] as bigint) ?? 0n, lzTokenFee: (quoteRaw[1] as bigint) ?? 0n };
  }
  return quoteRaw as { nativeFee: bigint; lzTokenFee: bigint };
};

const buildBridgeSendParam = (amount: string, recipient: `0x${string}`) => {
  const amountWei = parseEther(amount || "0");
  return {
    amountWei,
    sendParam: {
      dstEid: HEDERA_EID,
      to: addressToBytes32(recipient),
      amountLD: amountWei,
      minAmountLD: amountWei,
      extraOptions: "0x" as `0x${string}`,
      composeMsg: "0x" as `0x${string}`,
      oftCmd: "0x" as `0x${string}`,
    },
  };
};

export const useBridgeQuote = (amount: string) => {
  const { address } = useAccount();
  const publicClient = usePublicClient({ chainId: BASE_CHAIN_ID });
  const deployment = useDeployedContractInfo("MyNativeOFTAdapter", BASE_CHAIN_ID);

  const query = useQuery({
    queryKey: ["bridge-quote", amount, address, deployment?.address],
    enabled: Boolean(publicClient && deployment),
    queryFn: async () => {
      if (!publicClient || !deployment) return 0n;
      const { sendParam } = buildBridgeSendParam(amount, (address ?? ZERO_EVM_ADDRESS) as `0x${string}`);
      const quoteRaw = await publicClient.readContract({
        address: deployment.address,
        abi: deployment.abi,
        functionName: "quoteSend",
        args: [sendParam, false],
      });
      return normalizeQuote(quoteRaw).nativeFee;
    },
  });

  return {
    ok: !query.isError,
    fee: query.data ?? 0n,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    error: query.error,
    updatedAt: query.dataUpdatedAt,
  };
};

export const useBridgeSend = () => {
  const { address } = useAccount();
  const publicClient = usePublicClient({ chainId: BASE_CHAIN_ID });
  const write = useScaffoldWriteContract("MyNativeOFTAdapter", BASE_CHAIN_ID);
  const hederaAssetOft = useDeployedContractInfo("MyHTSConnector", 296);

  const send = async (amount: string) => {
    if (!address) throw new Error("Connect wallet first");
    if (!write.deployment) throw new Error("Missing deployment for MyNativeOFTAdapter on Base Sepolia");
    if (!publicClient) throw new Error("Missing public client for Base Sepolia");

    const { amountWei, sendParam } = buildBridgeSendParam(amount, address);

    const quoteRaw = await publicClient.readContract({
      address: write.deployment.address,
      abi: write.deployment.abi,
      functionName: "quoteSend",
      args: [sendParam, false],
    });

    const quote = normalizeQuote(quoteRaw);
    const value = quote.nativeFee + amountWei;
    
    if (!hederaAssetOft?.address) throw new Error("Missing deployment for MyHTSConnector on Hedera");

    // Send the transaction
    const txHash = (await write.writeContractAsync("send", [sendParam, quote, address], value)) as `0x${string}`;
    
    // Wait for confirmation and get the actual nonce from the receipt
    const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });
    
    // Get endpoint address to find PacketSent event
    const endpointAddress = (await publicClient.readContract({
      address: write.deployment.address,
      abi: write.deployment.abi,
      functionName: "endpoint",
    })) as `0x${string}`;
    
    // Extract nonce from PacketSent event in the receipt
    // The encodedPayload starts with: version (1 byte) + nonce (8 bytes) + srcEid (4 bytes) + ...
    let outboundNonce = 0n;
    
    for (const log of receipt.logs) {
      if (log.address.toLowerCase() === endpointAddress.toLowerCase()) {
        try {
          const decoded = decodeEventLog({
            abi: PACKET_SENT_ABI,
            data: log.data,
            topics: log.topics,
          });
          if (decoded.eventName === "PacketSent" && decoded.args.encodedPayload) {
            // Extract nonce from encodedPayload: skip version byte (2 hex chars after 0x), read next 16 hex chars (8 bytes)
            const payload = decoded.args.encodedPayload as `0x${string}`;
            const nonceHex = "0x" + payload.slice(4, 20); // bytes 1-8 (after version byte)
            outboundNonce = BigInt(nonceHex);
            break;
          }
        } catch {
          // Not a PacketSent event, continue
        }
      }
    }
    
    // Fallback: read from chain if event parsing failed
    if (outboundNonce === 0n) {
      const peer = (await publicClient.readContract({
        address: write.deployment.address,
        abi: OAPP_PEER_ABI,
        functionName: "peers",
        args: [HEDERA_EID],
      })) as `0x${string}`;
      
      const nonceRaw = await publicClient.readContract({
        address: endpointAddress,
        abi: ENDPOINT_ABI,
        functionName: "outboundNonce",
        args: [write.deployment.address, HEDERA_EID, peer],
      });
      outboundNonce = BigInt(nonceRaw);
    }

    return {
      txHash,
      outboundNonce,
      sendParam,
      sourceOftAddress: write.deployment.address as `0x${string}`,
      destinationOftAddress: hederaAssetOft.address as `0x${string}`,
    };
  };

  return { ...write, send };
};
