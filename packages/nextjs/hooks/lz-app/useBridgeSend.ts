"use client";

import { parseEther } from "viem";
import { useAccount, usePublicClient } from "wagmi";
import { useScaffoldWriteContract } from "~~/hooks/scaffold-hbar";

export const useBridgeQuote = (amount: string) => {
  try {
    const wei = parseEther(amount || "0");
    return { ok: true, fee: wei / 2000n };
  } catch {
    return { ok: false, fee: 0n };
  }
};

const BASE_CHAIN_ID = 84532;
const HEDERA_EID = 40285;

const addressToBytes32 = (address: `0x${string}`): `0x${string}` => {
  return `0x${address.slice(2).padStart(64, "0")}` as `0x${string}`;
};

export const useBridgeSend = () => {
  const { address } = useAccount();
  const publicClient = usePublicClient({ chainId: BASE_CHAIN_ID });
  const write = useScaffoldWriteContract("MyNativeOFTAdapter", BASE_CHAIN_ID);

  const send = async (amount: string) => {
    if (!address) throw new Error("Connect wallet first");
    if (!write.deployment) throw new Error("Missing deployment for MyNativeOFTAdapter on Base Sepolia");
    if (!publicClient) throw new Error("Missing public client for Base Sepolia");

    const amountWei = parseEther(amount || "0");
    const sendParam = {
      dstEid: HEDERA_EID,
      to: addressToBytes32(address),
      amountLD: amountWei,
      minAmountLD: amountWei,
      extraOptions: "0x",
      composeMsg: "0x",
      oftCmd: "0x",
    };

    const quoteRaw = await publicClient.readContract({
      address: write.deployment.address,
      abi: write.deployment.abi,
      functionName: "quoteSend",
      args: [sendParam, false],
    });

    const quote = Array.isArray(quoteRaw)
      ? { nativeFee: (quoteRaw[0] as bigint) ?? 0n, lzTokenFee: (quoteRaw[1] as bigint) ?? 0n }
      : (quoteRaw as { nativeFee: bigint; lzTokenFee: bigint });

    const value = quote.nativeFee + amountWei;
    return write.writeContractAsync("send", [sendParam, quote, address], value);
  };

  return { ...write, send };
};
