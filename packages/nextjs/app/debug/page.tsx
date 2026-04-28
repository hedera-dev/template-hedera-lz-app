"use client";

import { deployedContracts } from "~~/contracts/deployedContracts";
import { useState } from "react";
import { useScaffoldReadContract } from "~~/hooks/scaffold-hbar";

export default function DebugPage() {
  const [chainId, setChainId] = useState<number>(296);
  const entries = Object.entries(deployedContracts[chainId] || {});
  const [selectedName, setSelectedName] = useState<string>(entries[0]?.[0] || "");

  if (!entries.length) {
    return <div className="alert">No deployments loaded. Run `pnpm next:gen-contracts`.</div>;
  }

  const selected = entries.find(([name]) => name === selectedName)?.[1] || entries[0][1];
  const ownerRead = useScaffoldReadContract({
    contractName: selectedName || entries[0][0],
    chainId,
    functionName: "owner",
    query: { enabled: Boolean(selectedName || entries[0][0]) },
  });

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Debug Contracts</h1>
      <div className="join">
        <button className={`btn join-item ${chainId === 296 ? "btn-primary" : ""}`} onClick={() => setChainId(296)}>
          Hedera
        </button>
        <button className={`btn join-item ${chainId === 84532 ? "btn-primary" : ""}`} onClick={() => setChainId(84532)}>
          Base
        </button>
      </div>
      <div className="card bg-base-200 p-4 space-y-3">
        <label className="form-control">
          <span className="label-text">Contract</span>
          <select
            className="select select-bordered"
            value={selectedName}
            onChange={(e) => setSelectedName(e.target.value)}
          >
            {entries.map(([name]) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
        </label>
        <p className="text-sm break-all">
          <span className="font-semibold">Address:</span> {selected.address}
        </p>
        <p className="text-sm">
          <span className="font-semibold">ABI items:</span> {selected.abi.length}
        </p>
        <p className="text-sm break-all">
          <span className="font-semibold">owner():</span>{" "}
          {ownerRead.isSuccess ? String(ownerRead.data) : ownerRead.isError ? "not available for this contract" : "loading..."}
        </p>
      </div>
    </div>
  );
}
