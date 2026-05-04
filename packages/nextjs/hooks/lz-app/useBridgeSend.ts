"use client";

import { useQuery } from "@tanstack/react-query";
import { parseEther, decodeEventLog } from "viem";
import { useAccount, usePublicClient, useWriteContract } from "wagmi";
import { useDeployedContractInfo } from "~~/hooks/scaffold-hbar";

const BASE_CHAIN_ID = 84532;
const BASE_EID = 40245;
const HEDERA_CHAIN_ID = 296;
const HEDERA_EID = 40285;
const HEDERA_TINYBAR_TO_WEIBAR = 10_000_000_000n;
const HTS_PRECOMPILE = "0x0000000000000000000000000000000000000167" as const;
const ZERO_EVM_ADDRESS = "0x0000000000000000000000000000000000000000" as const;
const ERC20_ALLOWANCE_ABI = [
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
] as const;
const HTS_PRECOMPILE_ABI = [
  {
    inputs: [
      { name: "token", type: "address" },
      { name: "spender", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    name: "approve",
    outputs: [{ name: "responseCode", type: "int64" }],
    stateMutability: "nonpayable",
    type: "function",
  },
] as const;
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

export type BridgeRoute = {
  fromChain: "base" | "hedera";
  toChain: "base" | "hedera";
};

const getBridgeRouteConfig = (route: BridgeRoute) => {
  const sourceChainId = route.fromChain === "base" ? BASE_CHAIN_ID : HEDERA_CHAIN_ID;
  const destinationChainId = route.toChain === "base" ? BASE_CHAIN_ID : HEDERA_CHAIN_ID;
  const srcEid = route.fromChain === "base" ? BASE_EID : HEDERA_EID;
  const dstEid = route.toChain === "base" ? BASE_EID : HEDERA_EID;
  const sourceContractName = route.fromChain === "base" ? "MyNativeOFTAdapter" : "MyHTSConnector";
  const destinationContractName = route.toChain === "base" ? "MyNativeOFTAdapter" : "MyHTSConnector";
  const isNativeSource = sourceContractName === "MyNativeOFTAdapter";

  return {
    sourceChainId,
    destinationChainId,
    srcEid,
    dstEid,
    sourceContractName,
    destinationContractName,
    isNativeSource,
  };
};

const addressToBytes32 = (address: `0x${string}`): `0x${string}` => {
  return `0x${address.slice(2).padStart(64, "0")}` as `0x${string}`;
};
const normalizeQuote = (quoteRaw: unknown): { nativeFee: bigint; lzTokenFee: bigint } => {
  if (Array.isArray(quoteRaw)) {
    return { nativeFee: (quoteRaw[0] as bigint) ?? 0n, lzTokenFee: (quoteRaw[1] as bigint) ?? 0n };
  }
  return quoteRaw as { nativeFee: bigint; lzTokenFee: bigint };
};

const buildBridgeSendParam = (amount: string, recipient: `0x${string}`, dstEid: number) => {
  const amountWei = parseEther(amount || "0");
  return {
    amountWei,
    sendParam: {
      dstEid,
      to: addressToBytes32(recipient),
      amountLD: amountWei,
      minAmountLD: amountWei,
      extraOptions: "0x" as `0x${string}`,
      composeMsg: "0x" as `0x${string}`,
      oftCmd: "0x" as `0x${string}`,
    },
  };
};

const getBridgeTxValue = (nativeFee: bigint, amountWei: bigint, cfg: ReturnType<typeof getBridgeRouteConfig>) => {
  const contractValue = cfg.isNativeSource ? nativeFee + amountWei : nativeFee;

  // Hedera JSON-RPC value is wei-like, while contracts observe msg.value in tinybars.
  // Scale only the transaction value; keep the LayerZero fee struct unchanged.
  return cfg.sourceChainId === HEDERA_CHAIN_ID ? contractValue * HEDERA_TINYBAR_TO_WEIBAR : contractValue;
};

export const useBridgeQuote = (amount: string, route: BridgeRoute = { fromChain: "base", toChain: "hedera" }) => {
  const { address } = useAccount();
  const cfg = getBridgeRouteConfig(route);
  const publicClient = usePublicClient({ chainId: cfg.sourceChainId });
  const deployment = useDeployedContractInfo(cfg.sourceContractName, cfg.sourceChainId);

  const query = useQuery({
    queryKey: ["bridge-quote", amount, address, route.fromChain, route.toChain, deployment?.address],
    enabled: Boolean(publicClient && deployment),
    queryFn: async () => {
      if (!publicClient || !deployment) return 0n;
      const { sendParam } = buildBridgeSendParam(amount, (address ?? ZERO_EVM_ADDRESS) as `0x${string}`, cfg.dstEid);
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

export const useBridgeSend = (route: BridgeRoute = { fromChain: "base", toChain: "hedera" }) => {
  const { address } = useAccount();
  const cfg = getBridgeRouteConfig(route);
  const publicClient = usePublicClient({ chainId: cfg.sourceChainId });
  const write = useWriteContract();
  const sourceDeployment = useDeployedContractInfo(cfg.sourceContractName, cfg.sourceChainId);
  const destinationOft = useDeployedContractInfo(cfg.destinationContractName, cfg.destinationChainId);

  const send = async (amount: string) => {
    if (!address) throw new Error("Connect wallet first");
    if (!sourceDeployment) throw new Error(`Missing deployment for ${cfg.sourceContractName} on ${cfg.sourceChainId}`);
    if (!publicClient) throw new Error(`Missing public client for chain ${cfg.sourceChainId}`);
    if (!destinationOft?.address) throw new Error(`Missing deployment for ${cfg.destinationContractName} on ${cfg.destinationChainId}`);

    const { amountWei, sendParam } = buildBridgeSendParam(amount, address, cfg.dstEid);

    const quoteRaw = await publicClient.readContract({
      address: sourceDeployment.address,
      abi: sourceDeployment.abi,
      functionName: "quoteSend",
      args: [sendParam, false],
    });

    const quote = normalizeQuote(quoteRaw);
    const value = getBridgeTxValue(quote.nativeFee, amountWei, cfg);

    if (cfg.sourceChainId === HEDERA_CHAIN_ID) {
      const tokenAddress = (await publicClient.readContract({
        address: sourceDeployment.address,
        abi: sourceDeployment.abi,
        functionName: "token",
        args: [],
      })) as unknown as `0x${string}`;

      const allowance = (await publicClient.readContract({
        address: tokenAddress,
        abi: ERC20_ALLOWANCE_ABI,
        functionName: "allowance",
        args: [address, sourceDeployment.address],
      })) as bigint;

      if (allowance < amountWei) {
        const approvalHash = (await write.writeContractAsync({
          chainId: HEDERA_CHAIN_ID,
          address: HTS_PRECOMPILE,
          abi: HTS_PRECOMPILE_ABI,
          functionName: "approve",
          args: [tokenAddress, sourceDeployment.address, amountWei],
          gas: 1_500_000n,
        } as any)) as `0x${string}`;
        await publicClient.waitForTransactionReceipt({ hash: approvalHash });
      }
    }

    const txHash = (await write.writeContractAsync({
      chainId: cfg.sourceChainId,
      address: sourceDeployment.address,
      abi: sourceDeployment.abi,
      functionName: "send",
      args: [sendParam, quote, address],
      value,
    } as any)) as `0x${string}`;
    
    // Wait for confirmation and get the actual nonce from the receipt
    const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });
    
    // Get endpoint address to find PacketSent event
    const endpointAddress = (await publicClient.readContract({
      address: sourceDeployment.address,
      abi: sourceDeployment.abi,
      functionName: "endpoint",
      args: [],
    })) as unknown as `0x${string}`;
    
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
        address: sourceDeployment.address,
        abi: OAPP_PEER_ABI,
        functionName: "peers",
        args: [cfg.dstEid],
      })) as `0x${string}`;
      
      const nonceRaw = await publicClient.readContract({
        address: endpointAddress,
        abi: ENDPOINT_ABI,
        functionName: "outboundNonce",
        args: [sourceDeployment.address, cfg.dstEid, peer],
      });
      outboundNonce = BigInt(nonceRaw);
    }

    return {
      txHash,
      outboundNonce,
      sendParam,
      sourceOftAddress: sourceDeployment.address as `0x${string}`,
      destinationOftAddress: destinationOft.address as `0x${string}`,
      sourceChainId: cfg.sourceChainId,
      destinationChainId: cfg.destinationChainId,
      srcEid: cfg.srcEid,
      dstEid: cfg.dstEid,
    };
  };

  return { ...write, send, deployment: sourceDeployment };
};
