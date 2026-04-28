"use client";

import { useQuery } from "@tanstack/react-query";
import { parseEther } from "viem";
import { useAccount, usePublicClient } from "wagmi";
import { useDeployedContractInfo, useScaffoldWriteContract } from "~~/hooks/scaffold-hbar";

const BASE_CHAIN_ID = 84532;
const HEDERA_EID = 40285;
const ZERO_EVM_ADDRESS = "0x0000000000000000000000000000000000000000" as const;

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
    return write.writeContractAsync("send", [sendParam, quote, address], value);
  };

  return { ...write, send };
};
