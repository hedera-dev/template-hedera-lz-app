"use client";

import { usePublicClient } from "wagmi";
import { useQuery } from "@tanstack/react-query";
import { useDeployedContractInfo } from "./useDeployedContractInfo";

export const useScaffoldEventHistory = (
  contractName: string,
  chainId: number,
  eventName: string,
  options?: { refetchInterval?: number },
) => {
  const publicClient = usePublicClient({ chainId });
  const deployment = useDeployedContractInfo(contractName, chainId);

  return useQuery({
    queryKey: ["events", chainId, contractName, eventName],
    enabled: Boolean(publicClient && deployment),
    refetchInterval: options?.refetchInterval ?? 10_000,
    queryFn: async () => {
      if (!publicClient || !deployment) return [];
      return publicClient.getLogs({
        address: deployment.address,
        event: (deployment.abi as any[]).find((item) => item.type === "event" && item.name === eventName),
        fromBlock: "earliest",
      });
    },
  });
};
