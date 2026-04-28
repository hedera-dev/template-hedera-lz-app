"use client";

import { useState } from "react";
import { parseEther } from "viem";
import { useStrategyAdmin } from "~~/hooks/lz-app";
import { useDeployedContractInfo } from "~~/hooks/scaffold-hbar";

export default function AdminPage() {
  const [amount, setAmount] = useState("0.001");
  const admin = useStrategyAdmin();
  const vaultDeployment = useDeployedContractInfo("MyERC4626Strategy", 296);
  const needsOwnershipFix =
    Boolean(admin.owner) && Boolean(vaultDeployment?.address) && admin.owner?.toLowerCase() !== vaultDeployment?.address?.toLowerCase();

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Admin</h1>
      {!admin.isOwner ? (
        <div className="alert alert-warning">Connect the strategy owner wallet to run admin actions.</div>
      ) : null}
      {needsOwnershipFix ? (
        <div className="alert alert-error">
          <span>Divest precondition failed: HederaEtfStrategy owner is not MyERC4626Strategy.</span>
          <button
            className="btn btn-xs"
            disabled={!admin.isOwner}
            onClick={() => admin.strategy.writeContractAsync("transferOwnership", [vaultDeployment?.address])}
          >
            transferOwnership to vault
          </button>
        </div>
      ) : null}
      <div className="card bg-base-200 p-4 space-y-3">
        <input className="input input-bordered" value={amount} onChange={(e) => setAmount(e.target.value)} />
        <button className="btn btn-primary" disabled={!admin.isOwner} onClick={() => admin.strategy.writeContractAsync("invest", [parseEther(amount), BigInt(Math.floor(Date.now() / 1000) + 3600)])}>
          invest()
        </button>
        <button className="btn" disabled={!admin.isOwner} onClick={() => admin.vault.writeContractAsync("setAutoInvest", [true])}>
          setAutoInvest(true)
        </button>
        <button className="btn" disabled={!admin.isOwner} onClick={() => admin.vault.writeContractAsync("setInvestDeadlineSeconds", [300])}>
          setInvestDeadlineSeconds(300)
        </button>
      </div>
      <div className="alert">
        <span>
          `lz:setup:deploy-hustlers` remains CLI-only (Hedera SDK): `pnpm hardhat lz:setup:deploy-hustlers --network hedera-testnet`
        </span>
      </div>
    </div>
  );
}
