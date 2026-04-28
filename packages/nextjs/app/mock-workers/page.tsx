"use client";

import { useState } from "react";
import { useMockWorkers } from "~~/hooks/lz-app";

export default function MockWorkersPage() {
  const [chainId, setChainId] = useState<296 | 84532>(296);
  const [guid, setGuid] = useState("");
  const workers = useMockWorkers(chainId);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Simple Workers</h1>
      <div className="join">
        <button className={`btn join-item ${chainId === 296 ? "btn-primary" : ""}`} onClick={() => setChainId(296)}>
          Hedera
        </button>
        <button className={`btn join-item ${chainId === 84532 ? "btn-primary" : ""}`} onClick={() => setChainId(84532)}>
          Base
        </button>
      </div>
      {!workers.isOwner ? <div className="alert alert-warning">Only owner can process mock worker operations.</div> : null}
      <div className="card bg-base-200 p-4 space-y-3">
        <input className="input input-bordered" placeholder="Packet GUID / TxHash" value={guid} onChange={(e) => setGuid(e.target.value)} />
        <button className="btn btn-primary" disabled={!workers.isOwner} onClick={() => workers.executor.writeContractAsync("execute", [guid])}>
          commit-and-execute
        </button>
      </div>
    </div>
  );
}
