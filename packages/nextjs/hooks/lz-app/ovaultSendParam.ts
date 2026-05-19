"use client";

import { Options } from "@layerzerolabs/lz-v2-utilities";
import { encodeAbiParameters, encodeFunctionData, parseEther, PublicClient } from "viem";

export type Side = "deposit" | "redeem";
export type RedeemMode = "local" | "crossChainToBase";

export const BASE_EID = 40245;
export const HEDERA_EID = 40285;
export const DEFAULT_COMPOSE_VALUE = parseEther("0.025");
export const DEFAULT_REDEEM_SLIPPAGE_BPS = 100; // 1.00%

export const addressToBytes32 = (address: `0x${string}`): `0x${string}` => {
  return `0x${address.slice(2).padStart(64, "0")}` as `0x${string}`;
};

export const normalizeQuote = (quoteRaw: unknown): { nativeFee: bigint; lzTokenFee: bigint } => {
  if (Array.isArray(quoteRaw)) {
    return { nativeFee: (quoteRaw[0] as bigint) ?? 0n, lzTokenFee: (quoteRaw[1] as bigint) ?? 0n };
  }
  return quoteRaw as { nativeFee: bigint; lzTokenFee: bigint };
};

const safeQuoteSend = async (
  client: PublicClient,
  params: {
    address: `0x${string}`;
    abi: readonly any[];
    sendParam: {
      dstEid: number;
      to: `0x${string}`;
      amountLD: bigint;
      minAmountLD: bigint;
      extraOptions: `0x${string}`;
      composeMsg: `0x${string}`;
      oftCmd: `0x${string}`;
    };
  },
): Promise<{ nativeFee: bigint; lzTokenFee: bigint }> => {
  try {
    const quoteRaw = await client.readContract({
      address: params.address,
      abi: params.abi,
      functionName: "quoteSend",
      args: [params.sendParam, false],
    });
    return normalizeQuote(quoteRaw);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (!msg.includes("Position") || !msg.includes("out of bounds")) {
      throw err;
    }

    // Hedera RPC occasionally returns malformed response lengths for viem decoding.
    // For MessagingFee(tuple(uint256,uint256)), decode the two words manually.
    const data = encodeFunctionData({
      abi: params.abi as any,
      functionName: "quoteSend",
      args: [params.sendParam, false],
    });
    const raw = (await client.request({
      method: "eth_call",
      params: [{ to: params.address, data }, "latest"],
    })) as `0x${string}`;

    const body = raw.startsWith("0x") ? raw.slice(2) : raw;
    if (body.length < 128) {
      throw err;
    }

    return {
      nativeFee: BigInt(`0x${body.slice(0, 64)}`),
      lzTokenFee: BigInt(`0x${body.slice(64, 128)}`),
    };
  }
};

type DeployedContract = {
  address: `0x${string}`;
  abi: any[];
};

type BuildOvaultSendParamArgs = {
  side: Side;
  amount: string;
  receiverAddress: `0x${string}`;
  hederaClient: PublicClient;
  vaultDeployment: DeployedContract;
  composerDeployment: DeployedContract;
  shareOftHub?: DeployedContract;
  assetOftHub?: DeployedContract;
};

const COMPOSER_OFTS_ABI = [
  { inputs: [], name: "ASSET_OFT", outputs: [{ type: "address" }], stateMutability: "view", type: "function" },
  { inputs: [], name: "SHARE_OFT", outputs: [{ type: "address" }], stateMutability: "view", type: "function" },
] as const;

const safeReadAddress = async (
  client: PublicClient,
  address: `0x${string}`,
  functionName: "ASSET_OFT" | "SHARE_OFT",
): Promise<`0x${string}`> => {
  try {
    const value = await client.readContract({
      address,
      abi: COMPOSER_OFTS_ABI,
      functionName,
    });
    return value as `0x${string}`;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (!msg.includes("Position") || !msg.includes("out of bounds")) throw err;

    const data = encodeFunctionData({
      abi: COMPOSER_OFTS_ABI,
      functionName,
      args: [],
    });
    const raw = (await client.request({
      method: "eth_call",
      params: [{ to: address, data }, "latest"],
    })) as `0x${string}`;
    const body = raw.startsWith("0x") ? raw.slice(2).padStart(64, "0") : raw.padStart(64, "0");
    return `0x${body.slice(-40)}` as `0x${string}`;
  }
};

export const buildOvaultSendParam = async ({
  side,
  amount,
  receiverAddress,
  hederaClient,
  vaultDeployment,
  composerDeployment,
  shareOftHub,
  assetOftHub,
}: BuildOvaultSendParamArgs) => {
  const amountWei = parseEther(amount || "0");
  // Inner SendParam must use this hub chain's EID so VaultComposerSync._send uses _sendLocal (same-chain
  // credit) instead of _sendRemote. Encoding Base (40245) here caused OFT.send during lzCompose → LZ_SendReentrancy.
  const innerSendDstEid = HEDERA_EID;

  const previewFn = side === "deposit" ? "previewDeposit" : "previewRedeem";
  let expectedOutput = amountWei;
  try {
    const previewRaw = await hederaClient.readContract({
      address: vaultDeployment.address,
      abi: vaultDeployment.abi,
      functionName: previewFn,
      args: [amountWei],
    });
    expectedOutput = previewRaw as unknown as bigint;
  } catch {
    expectedOutput = amountWei;
  }

  const secondHopSendParam = {
    dstEid: innerSendDstEid,
    to: addressToBytes32(receiverAddress),
    amountLD: expectedOutput,
    minAmountLD: expectedOutput,
    extraOptions: Options.newOptions().addExecutorLzReceiveOption(100000, 0).toHex() as `0x${string}`,
    composeMsg: "0x" as `0x${string}`,
    oftCmd: "0x" as `0x${string}`,
  };

  // For testnet with mock executors, always use 0n for compose value.
  // The mock executor doesn't require actual native fees for compose operations.
  // This avoids Executor_NativeAmountExceedsCap errors from the first-hop quote.
  const composeValue = 0n;

  // Executor compose gas applies to lzCompose on Hedera (runbook: --lz-compose-gas 7000000+).
  const composeGas = 12_000_000;
  const firstHopOptions = Options.newOptions().addExecutorComposeOption(0, composeGas, composeValue).toHex() as `0x${string}`;

  const composeMsg = encodeAbiParameters(
    [
      {
        type: "tuple",
        components: [
          { name: "dstEid", type: "uint32" },
          { name: "to", type: "bytes32" },
          { name: "amountLD", type: "uint256" },
          { name: "minAmountLD", type: "uint256" },
          { name: "extraOptions", type: "bytes" },
          { name: "composeMsg", type: "bytes" },
          { name: "oftCmd", type: "bytes" },
        ],
      },
      { type: "uint256" },
    ],
    [secondHopSendParam, composeValue],
  );

  const sendParam = {
    dstEid: HEDERA_EID,
    to: addressToBytes32(composerDeployment.address),
    amountLD: amountWei,
    minAmountLD: amountWei,
    extraOptions: firstHopOptions,
    composeMsg,
    oftCmd: "0x" as `0x${string}`,
  };

  return { amountWei, sendParam, composeValue, composeGas };
};

export const buildRedeemSendParam = ({
  receiverAddress,
  dstEid,
  minAmountLD,
}: {
  receiverAddress: `0x${string}`;
  dstEid: number;
  minAmountLD: bigint;
}) => {
  const extraOptions = Options.newOptions().addExecutorLzReceiveOption(100000, 0).toHex() as `0x${string}`;
  return {
    dstEid,
    to: addressToBytes32(receiverAddress),
    amountLD: 0n,
    minAmountLD,
    extraOptions,
    composeMsg: "0x" as `0x${string}`,
    oftCmd: "0x" as `0x${string}`,
  };
};

export const applySlippageBps = (amount: bigint, slippageBps = DEFAULT_REDEEM_SLIPPAGE_BPS): bigint => {
  if (amount <= 0n) return 0n;
  const bounded = Math.max(0, Math.min(9_999, slippageBps));
  const keptBps = 10_000n - BigInt(bounded);
  return (amount * keptBps) / 10_000n;
};
