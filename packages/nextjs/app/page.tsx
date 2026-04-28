"use client";

import Link from "next/link";
import { useVaultState, useOftEvents } from "~~/hooks/lz-app";
import { formatEther } from "viem";

export default function HomePage() {
  const vault = useVaultState();
  const events = useOftEvents();
  return (
    <div className="space-y-4">
      <h1 className="text-3xl font-bold">LayerZero ETF Strategy App</h1>
      <p className="text-base-content/70">
        Interact with Chapter 1 bridge + Chapter 3 vault/strategy from a scaffold-hbar themed frontend.
      </p>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <Link href="/bridge" className="card bg-base-200 p-4 hover:bg-base-300">
          Bridge ETH/WETH
        </Link>
        <Link href="/vault" className="card bg-base-200 p-4 hover:bg-base-300">
          Deposit/Redeem
        </Link>
        <Link href="/strategy" className="card bg-base-200 p-4 hover:bg-base-300">
          Strategy state
        </Link>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="card bg-base-200 p-4">
          <p className="text-sm text-base-content/70">Vault total assets</p>
          <p className="font-semibold">{vault.totalAssets.data ? formatEther(vault.totalAssets.data as bigint) : "-"}</p>
        </div>
        <div className="card bg-base-200 p-4">
          <p className="text-sm text-base-content/70">Vault total supply</p>
          <p className="font-semibold">{vault.totalSupply.data ? formatEther(vault.totalSupply.data as bigint) : "-"}</p>
        </div>
        <div className="card bg-base-200 p-4">
          <p className="text-sm text-base-content/70">Recent events</p>
          <p className="font-semibold">{(events.invested.data?.length || 0) + (events.divested.data?.length || 0)}</p>
        </div>
      </div>
    </div>
  );
}
