"use client";

import type { VaultCatchUpStatus, VaultPendingMessage } from "~~/hooks/lz-app";

type Props = {
  pendingMessage?: VaultPendingMessage;
  relayerError?: string;
  processError?: string;
  isOnDestinationChain: boolean;
  destinationLabel: string;
  onManualProcess: () => void;
  onCheckNonce: () => void;
  onCatchUp: () => void;
  manualPending?: boolean;
  checkingNonce?: boolean;
  nextExpectedNonce?: bigint | null;
  catchUpStatus: VaultCatchUpStatus;
};

export const VaultRecoveryPanel = ({
  pendingMessage,
  relayerError,
  processError,
  isOnDestinationChain,
  destinationLabel,
  onManualProcess,
  onCheckNonce,
  onCatchUp,
  manualPending,
  checkingNonce,
  nextExpectedNonce,
  catchUpStatus,
}: Props) => {
  if (!pendingMessage) return null;
  return (
    <div className="card bg-base-100 border border-base-300 p-4 space-y-2">
      <div className="font-medium">Recovery & Manual Processing</div>
      {relayerError ? <div className="alert alert-warning text-sm whitespace-pre-wrap break-all">{relayerError}</div> : null}
      {processError ? <div className="alert alert-error text-sm whitespace-pre-wrap break-all">{processError}</div> : null}
      <div className="text-xs text-base-content/70">
        Destination chain: {destinationLabel}. Nonce: {pendingMessage.nonce.toString()}
      </div>
      {nextExpectedNonce !== null ? (
        <div className="text-xs text-base-content/70">Destination expected nonce: {(nextExpectedNonce ?? 0n).toString()}</div>
      ) : null}
      <div className="flex gap-2 flex-wrap">
        <button className="btn btn-secondary btn-sm" onClick={onManualProcess} disabled={manualPending}>
          {isOnDestinationChain ? `Process on ${destinationLabel}` : `Switch to ${destinationLabel}`}
        </button>
        <button className="btn btn-ghost btn-sm" onClick={onCheckNonce} disabled={checkingNonce}>
          {checkingNonce ? "Checking..." : "Check nonce"}
        </button>
        <button className="btn btn-warning btn-sm" onClick={onCatchUp} disabled={catchUpStatus.isProcessing}>
          {catchUpStatus.isProcessing
            ? `Catching up ${catchUpStatus.currentNonce?.toString() ?? "-"} (${catchUpStatus.processedCount}/${catchUpStatus.totalCount})`
            : "Auto catch-up"}
        </button>
      </div>
      {catchUpStatus.errors.length > 0 ? (
        <div className="alert alert-error text-xs whitespace-pre-wrap">{catchUpStatus.errors.join("\n")}</div>
      ) : null}
    </div>
  );
};
