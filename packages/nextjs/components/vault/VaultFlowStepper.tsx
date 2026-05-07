"use client";

import type { VaultStepStatus } from "~~/hooks/lz-app";

type Props = {
  source: VaultStepStatus;
  destination: VaultStepStatus;
  funds: VaultStepStatus;
  destinationLabel: string;
};

const Badge = ({ status }: { status: VaultStepStatus }) => {
  const cls =
    status === "done" ? "badge-success" : status === "active" ? "badge-warning" : status === "error" ? "badge-error" : "badge-ghost";
  return <span className={`badge ${cls}`}>{status}</span>;
};

export const VaultFlowStepper = ({ source, destination, funds, destinationLabel }: Props) => {
  return (
    <div className="card bg-base-100 border border-base-300 p-4 space-y-2">
      <div className="font-medium">Flow progress</div>
      <div className="flex items-center justify-between">
        <span className="text-sm">1. Source transaction</span>
        <Badge status={source} />
      </div>
      <div className="flex items-center justify-between">
        <span className="text-sm">2. Destination processing ({destinationLabel})</span>
        <Badge status={destination} />
      </div>
      <div className="flex items-center justify-between">
        <span className="text-sm">3. Funds available</span>
        <Badge status={funds} />
      </div>
    </div>
  );
};
