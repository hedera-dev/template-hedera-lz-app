"use client";

import { Options } from "@layerzerolabs/lz-v2-utilities";
import { encodeAbiParameters, parseEther, PublicClient } from "viem";

export type Side = "deposit" | "redeem";

export const BASE_EID = 40245;
export const HEDERA_EID = 40285;
export const DEFAULT_COMPOSE_VALUE = parseEther("0.025");

export const addressToBytes32 = (address: `0x${string}`): `0x${string}` => {
  return `0x${address.slice(2).padStart(64, "0")}` as `0x${string}`;
};

export const normalizeQuote = (quoteRaw: unknown): { nativeFee: bigint; lzTokenFee: bigint } => {
  if (Array.isArray(quoteRaw)) {
    return { nativeFee: (quoteRaw[0] as bigint) ?? 0n, lzTokenFee: (quoteRaw[1] as bigint) ?? 0n };
  }
  return quoteRaw as { nativeFee: bigint; lzTokenFee: bigint };
};

type DeployedContract = {
  address: `0x${string}`;
  abi: any[];
};

type BuildOvaultSendParamArgs = {
  side: Side;
  amount: string;
  crossChain: boolean;
  receiverAddress: `0x${string}`;
  hederaClient: PublicClient;
  vaultDeployment: DeployedContract;
  composerDeployment: DeployedContract;
  shareOftHub?: DeployedContract;
  assetOftHub?: DeployedContract;
};

export const buildOvaultSendParam = async ({
  side,
  amount,
  crossChain,
  receiverAddress,
  hederaClient,
  vaultDeployment,
  composerDeployment,
  shareOftHub,
  assetOftHub,
}: BuildOvaultSendParamArgs) => {
  const amountWei = parseEther(amount || "0");
  const destinationEid = crossChain ? BASE_EID : HEDERA_EID;

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
    dstEid: destinationEid,
    to: addressToBytes32(receiverAddress),
    amountLD: expectedOutput,
    minAmountLD: expectedOutput,
    extraOptions: Options.newOptions().addExecutorLzReceiveOption(100000, 0).toHex() as `0x${string}`,
    composeMsg: "0x" as `0x${string}`,
    oftCmd: "0x" as `0x${string}`,
  };

  let composeValue = 0n;
  const outputHubOft = side === "deposit" ? shareOftHub : assetOftHub;
  if (destinationEid !== HEDERA_EID && outputHubOft) {
    try {
      const quotedRaw = await hederaClient.readContract({
        address: outputHubOft.address,
        abi: outputHubOft.abi,
        functionName: "quoteSend",
        args: [secondHopSendParam, false],
      });
      composeValue = normalizeQuote(quotedRaw).nativeFee;
    } catch {
      composeValue = DEFAULT_COMPOSE_VALUE;
    }
  }

  const composeGas = destinationEid === HEDERA_EID ? 175000 : 395000;
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
