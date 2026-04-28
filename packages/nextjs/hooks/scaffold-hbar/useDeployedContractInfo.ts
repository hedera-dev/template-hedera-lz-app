"use client";

import { useMemo } from "react";
import { deployedContracts } from "~~/contracts/deployedContracts";
import { externalContracts } from "~~/contracts/externalContracts";

export const useDeployedContractInfo = (contractName: string, chainId: number) => {
  return useMemo(() => {
    const contracts = {
      ...(deployedContracts[chainId] || {}),
      ...((externalContracts as any)[chainId] || {}),
    } as Record<string, { address: `0x${string}`; abi: any[] }>;
    return contracts[contractName];
  }, [contractName, chainId]);
};
