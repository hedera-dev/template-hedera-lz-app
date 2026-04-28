"use client";

import { Options } from "@layerzerolabs/lz-v2-utilities";
import { encodeAbiParameters, parseEther } from "viem";
import { useAccount, usePublicClient } from "wagmi";
import { useDeployedContractInfo, useScaffoldWriteContract } from "~~/hooks/scaffold-hbar";

type Side = "deposit" | "redeem";

const BASE_CHAIN_ID = 84532;
const BASE_EID = 40245;
const HEDERA_EID = 40285;
const DEFAULT_COMPOSE_VALUE = parseEther("0.025");

const addressToBytes32 = (address: `0x${string}`): `0x${string}` => {
  return `0x${address.slice(2).padStart(64, "0")}` as `0x${string}`;
};

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
      expectedOutput = (previewRaw as unknown) as bigint;
    } catch {
      expectedOutput = amountWei;
    }

    const secondHopSendParam = {
      dstEid: destinationEid,
      to: addressToBytes32(address),
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
        if (Array.isArray(quotedRaw)) {
          composeValue = BigInt((quotedRaw[0] as bigint) ?? 0n);
        } else if (quotedRaw && typeof quotedRaw === "object" && "nativeFee" in (quotedRaw as object)) {
          composeValue = BigInt(((quotedRaw as { nativeFee: bigint }).nativeFee ?? 0n) as bigint);
        } else {
          composeValue = DEFAULT_COMPOSE_VALUE;
        }
      } catch {
        composeValue = DEFAULT_COMPOSE_VALUE;
      }
    }

    const composeGas = destinationEid === HEDERA_EID ? 175000 : 395000;
    const firstHopOptions = Options.newOptions()
      .addExecutorComposeOption(0, composeGas, composeValue)
      .toHex() as `0x${string}`;

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

    const quoteRaw = await baseClient.readContract({
      address: write.deployment.address,
      abi: write.deployment.abi,
      functionName: "quoteSend",
      args: [sendParam, false],
    });

    const quote = Array.isArray(quoteRaw)
      ? { nativeFee: (quoteRaw[0] as bigint) ?? 0n, lzTokenFee: (quoteRaw[1] as bigint) ?? 0n }
      : (quoteRaw as { nativeFee: bigint; lzTokenFee: bigint });

    const msgValue = side === "deposit" ? quote.nativeFee + amountWei : quote.nativeFee;
    return write.writeContractAsync("send", [sendParam, quote, address], msgValue);
  };

  return { ...write, send };
};
