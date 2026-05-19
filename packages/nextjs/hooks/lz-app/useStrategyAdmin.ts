"use client";

import { useAccount } from "wagmi";
import { useScaffoldReadContract, useScaffoldWriteContract } from "~~/hooks/scaffold-hbar";

export const useStrategyAdmin = () => {
  const { address } = useAccount();
  const strategy = useScaffoldWriteContract("HederaEtfStrategy", 296);
  const vault = useScaffoldWriteContract("MyERC4626Strategy", 296);
  const ownerRead = useScaffoldReadContract({
    contractName: "HederaEtfStrategy",
    chainId: 296,
    functionName: "owner",
  });
  const owner = ownerRead.data as `0x${string}` | undefined;
  const isOwner = owner && address ? owner.toLowerCase() === address.toLowerCase() : false;

  return { strategy, vault, owner, isOwner };
};
