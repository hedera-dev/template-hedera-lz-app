"use client";

import { useWriteContract } from "wagmi";
import { useDeployedContractInfo } from "./useDeployedContractInfo";

export type WriteContractOptions = {
  value?: bigint;
  gas?: bigint;
};

export const useScaffoldWriteContract = (contractName: string, chainId: number) => {
  const deployment = useDeployedContractInfo(contractName, chainId);
  const write = useWriteContract();

  const writeContractAsync = async (
    functionName: string,
    args: readonly unknown[] = [],
    options?: bigint | WriteContractOptions,
  ) => {
    if (!deployment) throw new Error(`Missing deployment for ${contractName} on ${chainId}`);

    // Support both legacy (value only) and new (options object) signatures
    const { value, gas } = typeof options === "bigint" ? { value: options, gas: undefined } : (options ?? {});

    return write.writeContractAsync({
      chainId,
      address: deployment.address,
      abi: deployment.abi,
      functionName,
      args,
      value,
      gas,
    } as any);
  };

  return { ...write, writeContractAsync, deployment };
};
