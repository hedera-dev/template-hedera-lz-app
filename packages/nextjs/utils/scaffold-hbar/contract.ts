import { deployedContracts } from "~~/contracts/deployedContracts";
import { externalContracts } from "~~/contracts/externalContracts";

export const getContract = (chainId: number, contractName: string) => {
  const merged = {
    ...(deployedContracts[chainId] || {}),
    ...((externalContracts as any)[chainId] || {}),
  } as Record<string, { address: `0x${string}`; abi: any[] }>;
  return merged[contractName];
};
