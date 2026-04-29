"use client";

import { useMemo, useState } from "react";
import { formatEther, parseEther } from "viem";
import { ArrowTopRightOnSquareIcon } from "@heroicons/react/24/outline";
import { useAccount, useSwitchChain, useWaitForTransactionReceipt } from "wagmi";
import { deployedContracts } from "~~/contracts/deployedContracts";
import { useLayerZeroScanLink, useOvaultQuote, useOvaultSend, useProcessReceive } from "~~/hooks/lz-app";

type PendingVaultMessage = {
  nonce: bigint;
  amount: string;
  recipient: `0x${string}`;
  srcOftAddress: `0x${string}`;
  dstOftAddress: `0x${string}`;
  composeMsg?: `0x${string}`;
  composeFrom?: `0x${string}`;
  composeTo?: `0x${string}`;
  composeGas?: bigint;
  composeValue?: bigint;
};

type ProcessTimeline = {
  verifyHash?: `0x${string}`;
  commitExecuteHash?: `0x${string}`;
  composeHash?: `0x${string}`;
};

export default function VaultPage() {
  const [mode, setMode] = useState<"deposit" | "redeem">("deposit");
  const [amount, setAmount] = useState("0.0005");
  const [crossChain, setCrossChain] = useState(true);
  const [submittedTxHash, setSubmittedTxHash] = useState<`0x${string}` | undefined>();
  const [processTimeline, setProcessTimeline] = useState<ProcessTimeline>({});
  const [submitError, setSubmitError] = useState<string>("");
  const [processError, setProcessError] = useState<string>("");
  const [processLog, setProcessLog] = useState<string>("");
  const [pendingMessage, setPendingMessage] = useState<PendingVaultMessage | undefined>();
  const { chainId } = useAccount();
  const { switchChainAsync } = useSwitchChain();
  const isBase = chainId === 84532;
  const isHedera = chainId === 296;
  const quote = useOvaultQuote({ amount, side: mode, crossChain });
  const tx = useOvaultSend(mode);
  const processReceive = useProcessReceive(296);
  const lzLink = useLayerZeroScanLink(submittedTxHash, 84532);
  const baseScanLink = submittedTxHash ? `https://sepolia.basescan.org/tx/${submittedTxHash}` : "";
  const destinationContractAddress = deployedContracts[296]?.MyOVaultComposerStrategy?.address;
  const hashscanLink = destinationContractAddress
    ? `https://hashscan.io/testnet/account/${destinationContractAddress}`
    : "https://hashscan.io/testnet";
  const receipt = useWaitForTransactionReceipt({
    chainId: 84532,
    hash: submittedTxHash,
    query: { enabled: Boolean(submittedTxHash) },
  });
  const processReceipt = useWaitForTransactionReceipt({
    chainId: 296,
    hash: processTimeline.commitExecuteHash,
    query: { enabled: Boolean(processTimeline.commitExecuteHash) },
  });
  const composePreview = useMemo(
    () => `mode=${mode};crossChain=${crossChain};amount=${amount};composer=MyOVaultComposerStrategy`,
    [mode, crossChain, amount],
  );
  const amountWei = (() => {
    try {
      return parseEther(amount || "0");
    } catch {
      return 0n;
    }
  })();
  const quoteFeeWei = (() => {
    try {
      return BigInt(quote.nativeFee || "0");
    } catch {
      return 0n;
    }
  })();
  const estimatedMsgValue = mode === "deposit" ? quoteFeeWei + amountWei : quoteFeeWei;

  const onSubmit = async () => {
    setSubmitError("");
    setProcessError("");
    if (!isBase) {
      await switchChainAsync({ chainId: 84532 });
      return;
    }
    try {
      const sent = await tx.send(amount, crossChain);
      setSubmittedTxHash(sent.txHash);
      if (!sent.destinationOftAddress) {
        throw new Error("Missing destination OFT deployment for processing");
      }
      setPendingMessage({
        nonce: sent.outboundNonce,
        amount,
        recipient: sent.composeFrom as `0x${string}`,
        srcOftAddress: sent.sourceOftAddress,
        dstOftAddress: sent.destinationOftAddress,
        composeMsg: sent.composeMsg,
        composeFrom: sent.composeFrom,
        composeTo: sent.composeTo,
        composeGas: sent.composeGas,
        composeValue: sent.composeValue,
      });
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Transaction failed to submit");
    }
  };

  const onProcess = async () => {
    setProcessError("");
    setProcessLog("");
    if (!isHedera) {
      await switchChainAsync({ chainId: 296 });
      return;
    }
    if (!pendingMessage) {
      setProcessError("No pending vault message to process");
      return;
    }
    try {
      const processed = await processReceive.process({
        sourceChainId: 84532,
        destinationChainId: 296,
        srcEid: 40245,
        dstEid: 40285,
        nonce: pendingMessage.nonce,
        amount: pendingMessage.amount,
        recipient: pendingMessage.recipient,
        srcOftAddress: pendingMessage.srcOftAddress,
        dstOftAddress: pendingMessage.dstOftAddress,
        composeMsg: pendingMessage.composeMsg && pendingMessage.composeMsg !== "0x" ? pendingMessage.composeMsg : undefined,
        composeFrom: pendingMessage.composeFrom,
        composeTo: pendingMessage.composeTo,
        composeGas: pendingMessage.composeGas,
        composeValue: pendingMessage.composeValue,
      });
      setProcessTimeline({
        verifyHash: processed.verifyHash,
        commitExecuteHash: processed.commitExecuteHash,
        composeHash: processed.composeHash,
      });
      setProcessLog(JSON.stringify(processed.debug, null, 2));
    } catch (err) {
      setProcessError(err instanceof Error ? err.message : "Processing failed");
    }
  };

  const verifyLink = processTimeline.verifyHash ? `https://hashscan.io/testnet/tx/${processTimeline.verifyHash}` : "";
  const commitLink = processTimeline.commitExecuteHash ? `https://hashscan.io/testnet/tx/${processTimeline.commitExecuteHash}` : "";
  const composeLink = processTimeline.composeHash ? `https://hashscan.io/testnet/tx/${processTimeline.composeHash}` : "";

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
        <p className="text-sm text-base-content/70">Estimated msg.value: {formatEther(estimatedMsgValue)} ETH</p>
        <p className="text-xs text-base-content/60">
          Quote status: {quote.isFetching ? "refreshing" : quote.isLoading ? "loading" : quote.ok ? "ready" : "error"}
          {quote.updatedAt ? ` - updated ${new Date(quote.updatedAt).toLocaleTimeString()}` : ""}
        </p>
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
              <span className="font-medium">Phase 1: Source transaction</span>
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
              <div className="text-sm text-success">Funds locked on Base. Ready for Hedera processing.</div>
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
                HashScan (destination contract) <ArrowTopRightOnSquareIcon className="h-3.5 w-3.5" />
              </a>
            </div>
          </div>
        ) : null}

        {pendingMessage ? (
          <div className="card bg-base-100 border border-base-300 p-3 space-y-2">
            <div className="font-medium">Phase 2: Process on Hedera</div>
            {!isHedera ? <div className="alert alert-warning text-sm">Switch to Hedera Testnet to process this message.</div> : null}
            <button className="btn btn-secondary" onClick={onProcess} disabled={processReceive.isPending}>
              {isHedera ? "Process on Hedera" : "Switch to Hedera Testnet"}
            </button>
            {processError ? <div className="alert alert-error text-sm whitespace-pre-wrap break-all">{processError}</div> : null}
            {processTimeline.commitExecuteHash ? (
              <>
                <div className="text-sm">
                  {processReceipt.isSuccess ? "Hedera processing complete. Vault state should update shortly." : "Processing on Hedera..."}
                </div>
              </>
            ) : null}
            {processLog ? (
              <div className="bg-base-200 border border-base-300 rounded p-2 max-w-full overflow-x-auto">
                <div className="text-xs font-semibold mb-1">Decoded process payload</div>
                <pre className="text-xs whitespace-pre-wrap break-all">{processLog}</pre>
              </div>
            ) : null}
          </div>
        ) : null}

        {(submittedTxHash || processTimeline.verifyHash || processTimeline.commitExecuteHash || processTimeline.composeHash) ? (
          <div className="card bg-base-100 border border-base-300 p-3 space-y-2">
            <div className="font-medium">Transaction timeline</div>
            <div className="text-xs space-y-1">
              {submittedTxHash ? (
                <p>
                  Source send:{" "}
                  <a className="link font-mono break-all" href={baseScanLink} target="_blank" rel="noreferrer">
                    {submittedTxHash}
                  </a>
                </p>
              ) : null}
              {processTimeline.verifyHash ? (
                <p>
                  DVN verify:{" "}
                  <a className="link font-mono break-all" href={verifyLink} target="_blank" rel="noreferrer">
                    {processTimeline.verifyHash}
                  </a>
                </p>
              ) : null}
              {processTimeline.commitExecuteHash ? (
                <p>
                  Commit + execute:{" "}
                  <a className="link font-mono break-all" href={commitLink} target="_blank" rel="noreferrer">
                    {processTimeline.commitExecuteHash}
                  </a>
                </p>
              ) : null}
              {processTimeline.composeHash ? (
                <p>
                  Compose:{" "}
                  <a className="link font-mono break-all" href={composeLink} target="_blank" rel="noreferrer">
                    {processTimeline.composeHash}
                  </a>
                </p>
              ) : null}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
