"use client";

import { useQuery } from "@tanstack/react-query";
import { useAccount, usePublicClient } from "wagmi";
import { buildOvaultSendParam, normalizeQuote, Side } from "./ovaultSendParam";
import { useDeployedContractInfo } from "~~/hooks/scaffold-hbar";

const BASE_CHAIN_ID = 84532;

export const useOvaultQuote = ({
  amount,
  side,
}: {
  amount: string;
  side: Side;
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
    queryKey: ["ovault-quote", side, amount, address, oftDeployment?.address],
    enabled:
      side === "redeem"
        ? Boolean(address)
        : Boolean(address && baseClient && hederaClient && oftDeployment && vaultDeployment && composerDeployment),
    queryFn: async () => {
      // Redeem/divest is local on Hedera: composer.redeemAndSend() redeems shares and
      // transfers the asset locally, so there is no LayerZero message fee.
      if (side === "redeem") return 0n;

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
