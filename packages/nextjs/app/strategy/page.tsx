"use client";

import { formatEther } from "viem";
import { useVaultState } from "~~/hooks/lz-app";

const formatEthValue = (value?: bigint) => (value !== undefined ? formatEther(value) : "-");
const formatCount = (value?: number) => (value === undefined ? "-" : value.toString());

export default function StrategyPage() {
  const { totalAssets, totalSupply, userShares, investedAssets, strategyAddress, strategyHustlers, strategyHbar, strategyActivity } =
    useVaultState();

  const assets = formatEthValue(totalAssets.data as bigint | undefined);
  const supply = formatEthValue(totalSupply.data as bigint | undefined);
  const shares = formatEthValue(userShares.data as bigint | undefined);
  const invested = formatEthValue(investedAssets.data as bigint | undefined);
  const stratHustlers = formatEthValue(strategyHustlers.data as bigint | undefined);
  const stratHbar = strategyHbar.data?.formatted || "-";
  const investedEvents = strategyActivity.data?.investedCount;
  const divestedEvents = strategyActivity.data?.divestedCount;
  const strategyHasActivity = (investedEvents ?? 0) + (divestedEvents ?? 0) > 0;

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Strategy State</h1>
      <p className="text-sm text-base-content/70">
        This page explains how much value is in the vault, how much is deployed by strategy, and what rebalancing activity has
        occurred recently.
      </p>

      <div className="card bg-base-200 border border-base-300 rounded-xl p-4 space-y-3">
        <h2 className="font-semibold">Vault Overview</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="bg-base-100 border border-base-300 rounded-xl p-3 space-y-1">
            <p className="text-xs uppercase tracking-wide text-base-content/60">Total Assets</p>
            <p className="text-xl font-semibold">{assets}</p>
            <p className="text-xs text-base-content/60">Total strategy value tracked by the vault accounting model.</p>
          </div>
          <div className="bg-base-100 border border-base-300 rounded-xl p-3 space-y-1">
            <p className="text-xs uppercase tracking-wide text-base-content/60">Total Share Supply</p>
            <p className="text-xl font-semibold">{supply}</p>
            <p className="text-xs text-base-content/60">All vault shares currently issued across all users.</p>
          </div>
          <div className="bg-base-100 border border-base-300 rounded-xl p-3 space-y-1">
            <p className="text-xs uppercase tracking-wide text-base-content/60">Your Shares</p>
            <p className="text-xl font-semibold">{shares}</p>
            <p className="text-xs text-base-content/60">Your ownership units in the vault. Redeems use this value.</p>
          </div>
        </div>
      </div>

      <div className="card bg-base-200 border border-base-300 rounded-xl p-4 space-y-3">
        <h2 className="font-semibold">Strategy Allocation</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="bg-base-100 border border-base-300 rounded-xl p-3 space-y-1">
            <p className="text-xs uppercase tracking-wide text-base-content/60">Invested Assets</p>
            <p className="text-xl font-semibold">{invested}</p>
            <p className="text-xs text-base-content/60">Portion of vault capital currently deployed in the ETF strategy.</p>
          </div>
          <div className="bg-base-100 border border-base-300 rounded-xl p-3 space-y-1">
            <p className="text-xs uppercase tracking-wide text-base-content/60">Strategy HUSTLERS</p>
            <p className="text-xl font-semibold">{stratHustlers}</p>
            <p className="text-xs text-base-content/60">Current HUSTLERS token balance held by strategy contract.</p>
          </div>
          <div className="bg-base-100 border border-base-300 rounded-xl p-3 space-y-1">
            <p className="text-xs uppercase tracking-wide text-base-content/60">Strategy HBAR</p>
            <p className="text-xl font-semibold">{stratHbar}</p>
            <p className="text-xs text-base-content/60">Current HBAR balance held by strategy contract.</p>
          </div>
        </div>
      </div>

      <div className="card bg-base-200 border border-base-300 rounded-xl p-4 space-y-3">
        <h2 className="font-semibold">Recent Strategy Activity</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="bg-base-100 border border-base-300 rounded-xl p-3">
            <p className="text-xs uppercase tracking-wide text-base-content/60">Invested Events (recent)</p>
            <p className="text-xl font-semibold">{strategyActivity.isLoading ? "Loading..." : formatCount(investedEvents)}</p>
          </div>
          <div className="bg-base-100 border border-base-300 rounded-xl p-3">
            <p className="text-xs uppercase tracking-wide text-base-content/60">Divested Events (recent)</p>
            <p className="text-xl font-semibold">{strategyActivity.isLoading ? "Loading..." : formatCount(divestedEvents)}</p>
          </div>
        </div>
        {strategyActivity.isError ? (
          <div className="alert alert-warning text-sm">Unable to read strategy events right now. Check RPC/indexer availability.</div>
        ) : !strategyActivity.isLoading && !strategyHasActivity ? (
          <div className="alert alert-info text-sm">
            No recent invest/divest events found in the scanned block window. This can happen if strategy activity is older than the
            scan range.
          </div>
        ) : null}
        <p className="text-xs text-base-content/60 break-all">
          Strategy contract: {String(strategyAddress.data || "-")}
        </p>
        <p className="text-xs text-base-content/60">Auto refresh: 10s polling</p>
      </div>
    </div>
  );
}
