"use client";

import { useWriteContract } from "wagmi";
import { useDeployedContractInfo } from "./useDeployedContractInfo";

export const useScaffoldWriteContract = (contractName: string, chainId: number) => {
  const deployment = useDeployedContractInfo(contractName, chainId);
  const write = useWriteContract();

  const writeContractAsync = async (functionName: string, args: readonly unknown[] = [], value?: bigint) => {
    if (!deployment) throw new Error(`Missing deployment for ${contractName} on ${chainId}`);
    return write.writeContractAsync({
      chainId,
      address: deployment.address,
      abi: deployment.abi,
      functionName,
      args,
      value,
    } as any);
  };

  return { ...write, writeContractAsync, deployment };
};
