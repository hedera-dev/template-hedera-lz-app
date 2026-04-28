"use client";

import { formatEther } from "viem";
import { useVaultState, useOftEvents } from "~~/hooks/lz-app";

export default function StrategyPage() {
  const { totalAssets, totalSupply, userShares, investedAssets, strategyAddress, strategyWeth, strategyHustlers, strategyHbar } =
    useVaultState();
  const events = useOftEvents();

  const assets = totalAssets.data ? formatEther(totalAssets.data as bigint) : "-";
  const supply = totalSupply.data ? formatEther(totalSupply.data as bigint) : "-";
  const shares = userShares.data ? formatEther(userShares.data as bigint) : "-";
  const invested = investedAssets.data ? formatEther(investedAssets.data as bigint) : "-";
  const stratWeth = strategyWeth.data ? formatEther(strategyWeth.data as bigint) : "-";
  const stratHustlers = strategyHustlers.data ? formatEther(strategyHustlers.data as bigint) : "-";
  const stratHbar = strategyHbar.data?.formatted || "-";

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Strategy State</h1>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="stat bg-base-200 rounded-box">
          <div className="stat-title">totalAssets (cost basis)</div>
          <div className="stat-value text-xl">{assets}</div>
        </div>
        <div className="stat bg-base-200 rounded-box">
          <div className="stat-title">totalSupply</div>
          <div className="stat-value text-xl">{supply}</div>
        </div>
        <div className="stat bg-base-200 rounded-box">
          <div className="stat-title">your shares</div>
          <div className="stat-value text-xl">{shares}</div>
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        <div className="stat bg-base-200 rounded-box">
          <div className="stat-title">investedAssets</div>
          <div className="stat-value text-lg">{invested}</div>
        </div>
        <div className="stat bg-base-200 rounded-box">
          <div className="stat-title">strategy WETH</div>
          <div className="stat-value text-lg">{stratWeth}</div>
        </div>
        <div className="stat bg-base-200 rounded-box">
          <div className="stat-title">strategy HUSTLERS</div>
          <div className="stat-value text-lg">{stratHustlers}</div>
        </div>
        <div className="stat bg-base-200 rounded-box">
          <div className="stat-title">strategy HBAR</div>
          <div className="stat-value text-lg">{stratHbar}</div>
        </div>
      </div>
      <div className="card bg-base-200 p-4">
        <h2 className="font-semibold mb-2">Recent events</h2>
        <p className="text-sm">Invested events: {events.invested.data?.length || 0}</p>
        <p className="text-sm">Divested events: {events.divested.data?.length || 0}</p>
        <p className="text-xs text-base-content/60 mt-2 break-all">
          strategy contract: {String(strategyAddress.data || "-")}
        </p>
        <p className="text-xs text-base-content/60">auto refresh: 7-10s polling</p>
      </div>
    </div>
  );
}
