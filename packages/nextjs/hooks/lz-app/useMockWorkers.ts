"use client";

import { useAccount } from "wagmi";
import { useScaffoldReadContract, useScaffoldWriteContract } from "~~/hooks/scaffold-hbar";

export const useMockWorkers = (chainId: number) => {
  const { address } = useAccount();
  const dvn = useScaffoldWriteContract("SimpleDVNMock", chainId);
  const executor = useScaffoldWriteContract("SimpleExecutorMock", chainId);
  const ownerRead = useScaffoldReadContract({
    contractName: "SimpleDVNMock",
    chainId,
    functionName: "owner",
  });
  const owner = ownerRead.data as `0x${string}` | undefined;
  const isOwner = owner && address ? owner.toLowerCase() === address.toLowerCase() : false;

  return { dvn, executor, owner, isOwner };
};
