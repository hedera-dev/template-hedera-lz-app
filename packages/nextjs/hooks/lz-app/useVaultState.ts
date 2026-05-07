"use client";

import { useQuery } from "@tanstack/react-query";
import { parseAbiItem } from "viem";
import { useAccount } from "wagmi";
import { useBalance, usePublicClient } from "wagmi";
import { useScaffoldReadContract } from "~~/hooks/scaffold-hbar";

const INVESTED_EVENT = parseAbiItem(
  "event Invested(address indexed caller, uint256 amountIn, uint256 hbarOut, uint256 hustlersOut)",
);
const DIVESTED_EVENT = parseAbiItem(
  "event Divested(address indexed caller, uint256 hbarIn, uint256 hustlersIn, uint256 assetOut)",
);

export const useVaultState = () => {
  const { address } = useAccount();
  const chainId = 296;
  const hederaClient = usePublicClient({ chainId });

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
  const strategyActivity = useQuery({
    queryKey: ["strategy-activity", chainId, strategyEvm],
    enabled: Boolean(hederaClient && strategyEvm),
    refetchInterval: 10_000,
    queryFn: async () => {
      if (!hederaClient || !strategyEvm) {
        return { investedCount: 0, divestedCount: 0, lastInvestedBlock: null as bigint | null, lastDivestedBlock: null as bigint | null };
      }
      const currentBlock = await hederaClient.getBlockNumber();
      const fromBlock = currentBlock > 200_000n ? currentBlock - 200_000n : 0n;
      const [investedLogs, divestedLogs] = await Promise.all([
        hederaClient.getLogs({ address: strategyEvm, event: INVESTED_EVENT, fromBlock, toBlock: currentBlock }),
        hederaClient.getLogs({ address: strategyEvm, event: DIVESTED_EVENT, fromBlock, toBlock: currentBlock }),
      ]);
      const lastInvestedBlock = investedLogs.length > 0 ? investedLogs[investedLogs.length - 1].blockNumber ?? null : null;
      const lastDivestedBlock = divestedLogs.length > 0 ? divestedLogs[divestedLogs.length - 1].blockNumber ?? null : null;
      return {
        investedCount: investedLogs.length,
        divestedCount: divestedLogs.length,
        lastInvestedBlock,
        lastDivestedBlock,
      };
    },
  });

  return {
    totalAssets,
    totalSupply,
    userShares,
    investedAssets,
    strategyAddress,
    strategyHustlers,
    strategyHbar,
    strategyActivity,
  };
};
