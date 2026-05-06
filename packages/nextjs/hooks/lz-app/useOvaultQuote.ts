"use client";

import { useQuery } from "@tanstack/react-query";
import { parseEther } from "viem";
import { useAccount, usePublicClient } from "wagmi";
import { buildRedeemSendParam, buildOvaultSendParam, normalizeQuote, RedeemMode, Side, BASE_EID } from "./ovaultSendParam";
import { useDeployedContractInfo } from "~~/hooks/scaffold-hbar";

const BASE_CHAIN_ID = 84532;

export const useOvaultQuote = ({
  amount,
  side,
  redeemMode = "local",
}: {
  amount: string;
  side: Side;
  redeemMode?: RedeemMode;
}) => {
  const { address } = useAccount();
  const baseClient = usePublicClient({ chainId: BASE_CHAIN_ID });
  const hederaClient = usePublicClient({ chainId: 296 });
  const contractName = side === "deposit" ? "MyNativeOFTAdapter" : "MyShareOFT";
  const oftDeployment = useDeployedContractInfo(contractName, BASE_CHAIN_ID);
  const vaultDeployment = useDeployedContractInfo("MyERC4626Strategy", 296);
  const composerDeployment = useDeployedContractInfo("MyOVaultComposerStrategy", 296);
  const shareOftHub = useDeployedContractInfo("MyShareOFTAdapterStrategy", 296);
  const assetOftHub = useDeployedContractInfo("MyHTSConnector", 296);

  const query = useQuery({
    queryKey: ["ovault-quote", side, redeemMode, amount, address, oftDeployment?.address],
    enabled: Boolean(address && hederaClient && vaultDeployment && composerDeployment),
    queryFn: async () => {
      if (!hederaClient || !vaultDeployment || !composerDeployment) return 0n;
      if (side === "redeem") {
        if (redeemMode === "local") return 0n;
        if (!address || !assetOftHub?.address) return 0n;
        const shareAmount = parseEther(amount || "0");
        if (shareAmount <= 0n) return 0n;
        const previewRaw = await hederaClient.readContract({
          address: vaultDeployment.address,
          abi: vaultDeployment.abi,
          functionName: "previewRedeem",
          args: [shareAmount],
        });
        const expectedAssets = previewRaw as unknown as bigint;
        const sendParam = buildRedeemSendParam({
          receiverAddress: address,
          dstEid: BASE_EID,
          minAmountLD: expectedAssets,
        });
        const quoteRaw = await hederaClient.readContract({
          address: composerDeployment.address,
          abi: composerDeployment.abi,
          functionName: "quoteSend",
          args: [address, assetOftHub.address as `0x${string}`, shareAmount, sendParam],
        });
        return normalizeQuote(quoteRaw).nativeFee;
      }

      if (!address || !baseClient || !hederaClient || !oftDeployment || !vaultDeployment || !composerDeployment) {
        return 0n;
      }

      const { sendParam } = await buildOvaultSendParam({
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
        address: oftDeployment.address,
        abi: oftDeployment.abi,
        functionName: "quoteSend",
        args: [sendParam, false],
      });

      return normalizeQuote(quoteRaw).nativeFee;
    },
  });

  return {
    nativeFee: (query.data ?? 0n).toString(),
    ok: !query.isError,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    error: query.error,
    updatedAt: query.dataUpdatedAt,
  };
};
