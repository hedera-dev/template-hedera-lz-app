"use client";

import { useAccount } from "wagmi";
import { useBalance } from "wagmi";
import { useScaffoldReadContract } from "~~/hooks/scaffold-hbar";

export const useVaultState = () => {
  const { address } = useAccount();
  const chainId = 296;

  const totalAssets = useScaffoldReadContract({
    contractName: "MyERC4626Strategy",
    chainId,
    functionName: "totalAssets",
    query: { refetchInterval: 15_000 },
  });
  const totalSupply = useScaffoldReadContract({
    contractName: "MyERC4626Strategy",
    chainId,
    functionName: "totalSupply",
    query: { refetchInterval: 15_000 },
  });
  const userShares = useScaffoldReadContract({
    contractName: "MyERC4626Strategy",
    chainId,
    functionName: "balanceOf",
    args: [address],
    query: { enabled: Boolean(address), refetchInterval: 15_000 },
  });
  const investedAssets = useScaffoldReadContract({
    contractName: "MyERC4626Strategy",
    chainId,
    functionName: "investedAssets",
    query: { refetchInterval: 10_000 },
  });
  const strategyAddress = useScaffoldReadContract({
    contractName: "MyERC4626Strategy",
    chainId,
    functionName: "strategy",
    query: { refetchInterval: 10_000 },
  });
  const strategyEvm = strategyAddress.data as `0x${string}` | undefined;
  const strategyWeth = useScaffoldReadContract({
    contractName: "WethHts",
    chainId,
    functionName: "balanceOf",
    args: [strategyEvm],
    query: { enabled: Boolean(strategyEvm), refetchInterval: 10_000 },
  });
  const strategyHustlers = useScaffoldReadContract({
    contractName: "Hustlers",
    chainId,
    functionName: "balanceOf",
    args: [strategyEvm],
    query: { enabled: Boolean(strategyEvm), refetchInterval: 10_000 },
  });
  const strategyHbar = useBalance({
    chainId,
    address: strategyEvm,
    query: { enabled: Boolean(strategyEvm), refetchInterval: 10_000 },
  });

  return {
    totalAssets,
    totalSupply,
    userShares,
    investedAssets,
    strategyAddress,
    strategyWeth,
    strategyHustlers,
    strategyHbar,
  };
};
