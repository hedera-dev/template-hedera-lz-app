"use client";

import { useMemo, useState } from "react";
import { ArrowTopRightOnSquareIcon } from "@heroicons/react/24/outline";
import { useAccount, useSwitchChain, useWaitForTransactionReceipt } from "wagmi";
import { useLayerZeroScanLink, useOvaultQuote, useOvaultSend } from "~~/hooks/lz-app";

export default function VaultPage() {
  const [mode, setMode] = useState<"deposit" | "redeem">("deposit");
  const [amount, setAmount] = useState("0.0005");
  const [crossChain, setCrossChain] = useState(true);
  const [submittedTxHash, setSubmittedTxHash] = useState<`0x${string}` | undefined>();
  const [submitError, setSubmitError] = useState<string>("");
  const { chainId } = useAccount();
  const { switchChainAsync } = useSwitchChain();
  const isBase = chainId === 84532;
  const quote = useOvaultQuote({ amount });
  const tx = useOvaultSend(mode);
  const lzLink = useLayerZeroScanLink(submittedTxHash, 84532);
  const baseScanLink = submittedTxHash ? `https://sepolia.basescan.org/tx/${submittedTxHash}` : "";
  const hashscanLink = "https://hashscan.io/testnet";
  const receipt = useWaitForTransactionReceipt({
    chainId: 84532,
    hash: submittedTxHash,
    query: { enabled: Boolean(submittedTxHash) },
  });
  const composePreview = useMemo(
    () => `mode=${mode};crossChain=${crossChain};amount=${amount};composer=MyOVaultComposerStrategy`,
    [mode, crossChain, amount],
  );

  const onSubmit = async () => {
    setSubmitError("");
    if (!isBase) {
      await switchChainAsync({ chainId: 84532 });
      return;
    }
    try {
      const hash = (await tx.send(amount, crossChain)) as `0x${string}`;
      setSubmittedTxHash(hash);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Transaction failed to submit");
    }
  };

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">OVault Deposit / Redeem</h1>
      <div className="tabs tabs-boxed">
        <button className={`tab ${mode === "deposit" ? "tab-active" : ""}`} onClick={() => setMode("deposit")}>
          Deposit
        </button>
        <button className={`tab ${mode === "redeem" ? "tab-active" : ""}`} onClick={() => setMode("redeem")}>
          Redeem
        </button>
      </div>
      <div className="card bg-base-200 p-4 space-y-3">
        <label className="label cursor-pointer justify-start gap-2">
          <input type="checkbox" className="checkbox checkbox-sm" checked={crossChain} onChange={(e) => setCrossChain(e.target.checked)} />
          <span>Cross-chain</span>
        </label>
        <input className="input input-bordered" value={amount} onChange={(e) => setAmount(e.target.value)} />
        <p className="text-sm text-base-content/70">Quote native fee: {quote.nativeFee}</p>
        <p className="text-xs font-mono bg-base-300 p-2 rounded">composeMsg preview: {composePreview}</p>
        {!isBase ? <div className="alert alert-warning">Switch to Base Sepolia to {mode}.</div> : null}
        <button className="btn btn-primary" onClick={onSubmit} disabled={tx.isPending || receipt.isLoading}>
          {tx.isPending || receipt.isLoading ? (
            <span className="loading loading-spinner loading-sm" />
          ) : null}
          {isBase ? `Submit ${mode}` : "Switch to Base Sepolia"}
        </button>
        {submitError ? <div className="alert alert-error text-sm">{submitError}</div> : null}

        {submittedTxHash ? (
          <div className="card bg-base-100 border border-base-300 p-3 space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-medium">Transaction receipt</span>
              <span
                className={`badge ${
                  receipt.isSuccess ? "badge-success" : receipt.isError ? "badge-error" : "badge-warning"
                }`}
              >
                {receipt.isSuccess ? "confirmed" : receipt.isError ? "failed" : "pending"}
              </span>
            </div>
            <p className="text-xs font-mono break-all">{submittedTxHash}</p>
            {!receipt.isSuccess ? (
              <progress className="progress progress-primary w-full" />
            ) : (
              <div className="text-sm text-success">Source tx confirmed on Base Sepolia.</div>
            )}
            <div className="flex flex-wrap gap-3 text-sm">
              <a className="link inline-flex items-center gap-1" href={baseScanLink} target="_blank" rel="noreferrer">
                BaseScan <ArrowTopRightOnSquareIcon className="h-3.5 w-3.5" />
              </a>
              {lzLink ? (
                <a className="link inline-flex items-center gap-1" href={lzLink} target="_blank" rel="noreferrer">
                  LayerZero Scan <ArrowTopRightOnSquareIcon className="h-3.5 w-3.5" />
                </a>
              ) : null}
              <a className="link inline-flex items-center gap-1" href={hashscanLink} target="_blank" rel="noreferrer">
                HashScan (destination) <ArrowTopRightOnSquareIcon className="h-3.5 w-3.5" />
              </a>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
