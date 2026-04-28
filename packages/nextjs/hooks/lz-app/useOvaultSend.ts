"use client";

import { useAccount, usePublicClient } from "wagmi";
import { buildOvaultSendParam, normalizeQuote, Side } from "./ovaultSendParam";
import { useDeployedContractInfo, useScaffoldWriteContract } from "~~/hooks/scaffold-hbar";

const BASE_CHAIN_ID = 84532;

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

    const { amountWei, sendParam } = await buildOvaultSendParam({
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
    return write.writeContractAsync("send", [sendParam, quote, address], msgValue);
  };

  return { ...write, send };
};
