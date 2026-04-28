"use client";

import { useReadContract } from "wagmi";
import { useDeployedContractInfo } from "./useDeployedContractInfo";

type Args = {
  contractName: string;
  chainId: number;
  functionName: string;
  args?: readonly unknown[];
  query?: { enabled?: boolean; refetchInterval?: number };
};

export const useScaffoldReadContract = ({ contractName, chainId, functionName, args, query }: Args) => {
  const deployment = useDeployedContractInfo(contractName, chainId);
  return useReadContract({
    chainId,
    address: deployment?.address,
    abi: deployment?.abi,
    functionName,
    args,
    query: {
      enabled: Boolean(deployment?.address) && (query?.enabled ?? true),
      refetchInterval: query?.refetchInterval,
    },
  } as any);
};
