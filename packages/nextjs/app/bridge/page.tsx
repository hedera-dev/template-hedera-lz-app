"use client";

import { useEffect, useMemo, useState } from "react";
import { formatEther, parseEther } from "viem";
import { ArrowTopRightOnSquareIcon } from "@heroicons/react/24/outline";
import { useAccount, useSwitchChain, useWaitForTransactionReceipt } from "wagmi";
import { useBridgeQuote, useBridgeSend, useLayerZeroScanLink, useProcessReceive, usePendingMessages } from "~~/hooks/lz-app";

type PendingBridgeMessage = {
  nonce: bigint;
  amount: string;
  recipient: `0x${string}`;
  srcOftAddress: `0x${string}`;
  dstOftAddress: `0x${string}`;
};

type ProcessTimeline = {
  verifyHash?: `0x${string}`;
  commitExecuteHash?: `0x${string}`;
  composeHash?: `0x${string}`;
};

type CatchUpStatus = {
  isProcessing: boolean;
  currentNonce: bigint | null;
  processedCount: number;
  totalCount: number;
  errors: string[];
};

export default function BridgePage() {
  const [amount, setAmount] = useState("0.001");
  const [fromChain, setFromChain] = useState<"base" | "hedera">("base");
  const [toChain, setToChain] = useState<"base" | "hedera">("hedera");
  const [submittedTxHash, setSubmittedTxHash] = useState<`0x${string}` | undefined>();
  const [processTimeline, setProcessTimeline] = useState<ProcessTimeline>({});
  const [bridgeError, setBridgeError] = useState("");
  const [processError, setProcessError] = useState("");
  const [processLog, setProcessLog] = useState("");
  const [processCompleted, setProcessCompleted] = useState(false);
  const [processInFlight, setProcessInFlight] = useState(false);
  const [pendingMessage, setPendingMessage] = useState<PendingBridgeMessage | undefined>();
  const [showCatchUp, setShowCatchUp] = useState(false);
  const [showRecoveryPanel, setShowRecoveryPanel] = useState(false);
  const [pendingInfo, setPendingInfo] = useState<{
    pendingMessages: Array<{ nonce: bigint; recipient: `0x${string}`; amountLD: string }>;
    nextNonce: bigint;
    latestOutboundNonce: bigint;
    pendingCount: number;
  } | null>(null);
  const [catchUpStatus, setCatchUpStatus] = useState<CatchUpStatus>({
    isProcessing: false,
    currentNonce: null,
    processedCount: 0,
    totalCount: 0,
    errors: [],
  });
  const { chainId, address } = useAccount();
  const { switchChainAsync } = useSwitchChain();
  const isBase = chainId === 84532;
  const isHedera = chainId === 296;
  const quote = useBridgeQuote(amount);
  const bridge = useBridgeSend();
  const processReceive = useProcessReceive(296);
  const pendingMessages = usePendingMessages();
  const sourceReceipt = useWaitForTransactionReceipt({
    chainId: 84532,
    hash: submittedTxHash,
    query: { enabled: Boolean(submittedTxHash) },
  });
  const amountWei = (() => {
    try {
      return parseEther(amount || "0");
    } catch {
      return 0n;
    }
  })();
  const amountOutEstimate = amountWei;
  const routeSupported = fromChain === "base" && toChain === "hedera";
  const estimatedTotal = quote.fee + amountWei;
  const lzLink = useLayerZeroScanLink(submittedTxHash, 84532);
  const processSucceeded = Boolean(processTimeline.commitExecuteHash && processCompleted);
  const hasStartedFlow = Boolean(submittedTxHash || pendingMessage || processTimeline.verifyHash || processTimeline.commitExecuteHash);
  const sourceStepStatus = !submittedTxHash ? "idle" : sourceReceipt.isSuccess ? "success" : sourceReceipt.isError ? "error" : "pending";
  const verifyStepStatus = !submittedTxHash
    ? "idle"
    : processTimeline.verifyHash
      ? "success"
      : processInFlight || processReceive.isPending
        ? "pending"
        : "idle";
  const commitStepStatus = !submittedTxHash
    ? "idle"
    : processTimeline.commitExecuteHash && processCompleted
      ? "success"
      : processTimeline.commitExecuteHash || processInFlight || processReceive.isPending
        ? "pending"
        : "idle";
  const userFacingProcessError = useMemo(() => {
    if (!processError) return "";
    if (processError.includes("Position") && processError.includes("out of bounds")) {
      return "Processing submitted, but the node returned an unreadable debug payload. Check the tx links below for confirmation.";
    }
    return processError;
  }, [processError]);

  useEffect(() => {
    // Clear stale network-gated errors when wallet chain changes.
    if (isBase) setBridgeError("");
    if (isHedera) setProcessError("");
  }, [isBase, isHedera]);

  const onCheckPending = async () => {
    try {
      const info = await pendingMessages.fetchPendingMessages();
      setPendingInfo(info);
      setShowCatchUp(true);
    } catch (err) {
      setProcessError(err instanceof Error ? err.message : "Failed to fetch pending messages");
    }
  };

  const onCatchUp = async () => {
    if (!pendingInfo || !pendingMessages.srcOftAddress || !pendingMessages.dstOftAddress) return;
    if (!isHedera) {
      await switchChainAsync({ chainId: 296 });
      return;
    }

    const messagesToProcess = pendingInfo.pendingMessages;
    if (messagesToProcess.length === 0) {
      setProcessError("No pending messages found on-chain to process");
      return;
    }

    setCatchUpStatus({
      isProcessing: true,
      currentNonce: null,
      processedCount: 0,
      totalCount: messagesToProcess.length,
      errors: [],
    });

    for (let i = 0; i < messagesToProcess.length; i++) {
      const msg = messagesToProcess[i];
      setCatchUpStatus(prev => ({ ...prev, currentNonce: msg.nonce }));

      try {
        await processReceive.process({
          sourceChainId: 84532,
          destinationChainId: 296,
          srcEid: 40245,
          dstEid: 40285,
          nonce: msg.nonce,
          amount: msg.amountLD,
          recipient: msg.recipient,
          srcOftAddress: pendingMessages.srcOftAddress!,
          dstOftAddress: pendingMessages.dstOftAddress!,
        });

        setCatchUpStatus(prev => ({ ...prev, processedCount: prev.processedCount + 1 }));
      } catch (err) {
        const errMsg = `Nonce ${msg.nonce}: ${err instanceof Error ? err.message : "Failed"}`;
        setCatchUpStatus(prev => ({ ...prev, errors: [...prev.errors, errMsg] }));
        break;
      }
    }

    setCatchUpStatus(prev => ({ ...prev, isProcessing: false, currentNonce: null }));
    const refreshed = await pendingMessages.fetchPendingMessages();
    setPendingInfo(refreshed);
  };

  const onSend = async () => {
    setBridgeError("");
    if (!routeSupported) {
      setBridgeError("Currently only Base Sepolia → Hedera Testnet is supported on this bridge page.");
      return;
    }
    if (!isBase) {
      await switchChainAsync({ chainId: 84532 });
      return;
    }
    if (!address) {
      setBridgeError("Connect wallet first");
      return;
    }
    try {
      const sent = await bridge.send(amount);
      setSubmittedTxHash(sent.txHash);
      setPendingMessage({
        nonce: sent.outboundNonce,
        amount,
        recipient: address,
        srcOftAddress: sent.sourceOftAddress,
        dstOftAddress: sent.destinationOftAddress,
      });
    } catch (error) {
      setBridgeError(error instanceof Error ? error.message : "Bridge send failed");
    }
  };

  const onProcess = async () => {
    setProcessError("");
    setProcessLog("");
    setProcessCompleted(false);
    setProcessInFlight(true);
    if (!isHedera) {
      await switchChainAsync({ chainId: 296 });
      setProcessInFlight(false);
      return;
    }
    if (!pendingMessage) {
      setProcessError("No pending message to process");
      setProcessInFlight(false);
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
      });
      setProcessTimeline({
        verifyHash: processed.verifyHash,
        commitExecuteHash: processed.commitExecuteHash,
        composeHash: processed.composeHash,
      });
      setProcessCompleted(true);
      setProcessLog(JSON.stringify(processed.debug, null, 2));
    } catch (error) {
      setProcessError(error instanceof Error ? error.message : "Processing failed");
    } finally {
      setProcessInFlight(false);
    }
  };

  const baseTxLink = submittedTxHash ? `https://sepolia.basescan.org/tx/${submittedTxHash}` : "";
  const verifyLink = processTimeline.verifyHash ? `https://hashscan.io/testnet/tx/${processTimeline.verifyHash}` : "";
  const commitLink = processTimeline.commitExecuteHash ? `https://hashscan.io/testnet/tx/${processTimeline.commitExecuteHash}` : "";
  const composeLink = processTimeline.composeHash ? `https://hashscan.io/testnet/tx/${processTimeline.composeHash}` : "";

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Bridge (Chapter 1)</h1>
      <div className="card bg-base-200 p-4 md:p-5 space-y-4 border border-base-300">
        <div className="card bg-base-100 border border-base-300 rounded-2xl p-4 md:p-5 space-y-5 overflow-hidden">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-sm font-semibold">Bridge Route</div>
              <div className="text-xs text-base-content/60">Base Sepolia to Hedera Testnet</div>
            </div>
            <div className="badge badge-outline badge-sm">Chapter 1</div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_1fr] gap-3 items-end">
            <label className="form-control">
              <span className="label-text text-[11px] uppercase tracking-wide text-base-content/60">From chain</span>
              <div className="h-12 rounded-xl border border-base-300 bg-base-200/60 px-3 flex items-center">
                <select
                  className="w-full bg-transparent border-0 outline-none text-base font-medium"
                  value={fromChain}
                  onChange={(e) => {
                    const nextFrom = e.target.value as "base" | "hedera";
                    setFromChain(nextFrom);
                    setToChain(nextFrom === "base" ? "hedera" : "base");
                  }}
                >
                  <option value="base">Base Sepolia</option>
                  <option value="hedera">Hedera Testnet</option>
                </select>
              </div>
            </label>
            <button
              className="btn btn-circle btn-ghost btn-sm mb-1 border border-base-300 self-end bg-base-200/60"
              onClick={() => {
                const nextFrom = toChain;
                const nextTo = fromChain;
                setFromChain(nextFrom);
                setToChain(nextTo);
              }}
              type="button"
              aria-label="Swap chains"
            >
              ⇅
            </button>
            <label className="form-control">
              <span className="label-text text-[11px] uppercase tracking-wide text-base-content/60">To chain</span>
              <div className="h-12 rounded-xl border border-base-300 bg-base-200/60 px-3 flex items-center">
                <select
                  className="w-full bg-transparent border-0 outline-none text-base font-medium"
                  value={toChain}
                  onChange={(e) => {
                    const nextTo = e.target.value as "base" | "hedera";
                    setToChain(nextTo);
                    setFromChain(nextTo === "base" ? "hedera" : "base");
                  }}
                >
                  <option value="base">Base Sepolia</option>
                  <option value="hedera">Hedera Testnet</option>
                </select>
              </div>
            </label>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <label className="form-control bg-base-200/50 border border-base-300 rounded-xl px-3 py-2">
              <span className="label-text text-[11px] uppercase tracking-wide text-base-content/60">You send (ETH)</span>
              <div className="h-10 grid grid-cols-[1fr_auto] items-center gap-2">
                <input
                  className="input input-ghost h-10 px-0 text-lg font-semibold focus:outline-none min-w-0"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                />
                <span className="text-sm font-medium text-base-content/60">ETH</span>
              </div>
            </label>
            <div className="form-control bg-base-200/50 border border-base-300 rounded-xl px-3 py-2">
              <span className="label-text text-[11px] uppercase tracking-wide text-base-content/60">Estimated receive</span>
              <div className="h-10 grid grid-cols-[1fr_auto] items-center gap-2">
                <span className="text-lg font-semibold text-base-content/85">{formatEther(amountOutEstimate)}</span>
                <span className="text-sm font-medium text-base-content/60">WETH-HTS</span>
              </div>
            </div>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
          <div className="bg-base-100 border border-base-300 rounded-lg px-3 py-2">
            <span className="text-base-content/60">Estimated fee</span>{" "}
            <span className="font-medium">{quote.fee.toString()} wei</span>
          </div>
          <div className="bg-base-100 border border-base-300 rounded-lg px-3 py-2">
            <span className="text-base-content/60">Estimated total msg.value</span>{" "}
            <span className="font-medium">{formatEther(estimatedTotal)} ETH</span>
          </div>
        </div>
        <p className="text-xs text-base-content/60">
          Quote status: {quote.isFetching ? "refreshing" : quote.isLoading ? "loading" : quote.ok ? "ready" : "error"}
          {quote.updatedAt ? ` - updated ${new Date(quote.updatedAt).toLocaleTimeString()}` : ""}
        </p>
        {!routeSupported ? (
          <div className="alert alert-warning text-sm">This page currently supports Base Sepolia → Hedera Testnet only.</div>
        ) : !isBase ? (
          <div className="alert alert-warning text-sm">Switch to Base Sepolia to submit the source bridge transaction.</div>
        ) : null}
        <button className="btn btn-primary" onClick={onSend} disabled={bridge.isPending}>
          {bridge.isPending ? <span className="loading loading-spinner loading-sm" /> : null}
          {routeSupported ? (isBase ? "Bridge now" : "Switch to Base Sepolia") : "Route not supported yet"}
        </button>
        {bridgeError ? <div className="alert alert-error text-sm">{bridgeError}</div> : null}

        {hasStartedFlow ? (
          <div className="card bg-base-100 border border-base-300 p-3 space-y-2">
            <div className="font-medium">Progress</div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-xs">
              <div className="border border-base-300 rounded p-2">
                <div className="font-semibold mb-1">1. Source sent</div>
                <span
                  className={`badge ${
                    sourceStepStatus === "success"
                      ? "badge-success"
                      : sourceStepStatus === "error"
                        ? "badge-error"
                        : sourceStepStatus === "pending"
                          ? "badge-warning"
                          : "badge-ghost"
                  }`}
                >
                  {sourceStepStatus}
                </span>
              </div>
              <div className="border border-base-300 rounded p-2">
                <div className="font-semibold mb-1">2. DVN verify</div>
                <span className={`badge ${verifyStepStatus === "success" ? "badge-success" : verifyStepStatus === "pending" ? "badge-warning" : "badge-ghost"}`}>
                  {verifyStepStatus}
                </span>
              </div>
              <div className="border border-base-300 rounded p-2">
                <div className="font-semibold mb-1">3. Commit execute</div>
                <span className={`badge ${commitStepStatus === "success" ? "badge-success" : commitStepStatus === "pending" ? "badge-warning" : "badge-ghost"}`}>
                  {commitStepStatus}
                </span>
              </div>
            </div>
          </div>
        ) : null}

        {submittedTxHash ? (
          <div className="card bg-base-100 border border-base-300 p-3 space-y-2">
            <div className="font-medium">Phase 1: Source send</div>
            <p className="text-xs font-mono break-all">{submittedTxHash}</p>
            <div className="text-sm">
              {sourceReceipt.isSuccess ? "Funds locked on Base. Ready to process on Hedera." : "Waiting for Base confirmation..."}
            </div>
            {sourceReceipt.isSuccess ? (
              <div className="flex flex-wrap gap-3 text-sm">
                <a className="link inline-flex items-center gap-1" href={baseTxLink} target="_blank" rel="noreferrer">
                  BaseScan <ArrowTopRightOnSquareIcon className="h-3.5 w-3.5" />
                </a>
                {lzLink ? (
                  <a className="link inline-flex items-center gap-1" href={lzLink} target="_blank" rel="noreferrer">
                    LayerZero Scan <ArrowTopRightOnSquareIcon className="h-3.5 w-3.5" />
                  </a>
                ) : null}
              </div>
            ) : null}
          </div>
        ) : null}

        {pendingMessage ? (
          <div className="card bg-base-100 border border-base-300 p-3 space-y-2">
            <div className="font-medium">Phase 2: Process on Hedera</div>
            {!isHedera ? <div className="alert alert-warning text-sm">Switch to Hedera Testnet to process message.</div> : null}
            <button
              className={`btn btn-secondary ${processInFlight ? "btn-disabled opacity-70 cursor-not-allowed" : ""}`}
              onClick={onProcess}
              disabled={processReceive.isPending || processInFlight}
            >
              {processInFlight ? (
                <span className="inline-flex items-center gap-2">
                  <span className="loading loading-spinner loading-sm" />
                  Processing on Hedera...
                </span>
              ) : isHedera ? (
                "Process on Hedera"
              ) : (
                "Switch to Hedera Testnet"
              )}
            </button>
            {userFacingProcessError ? (
              <div className="alert alert-error text-sm whitespace-pre-wrap break-all">{userFacingProcessError}</div>
            ) : null}
            {processTimeline.commitExecuteHash ? (
              <>
                <div className="text-sm">
                  {processCompleted ? "Complete - WETH-HTS should be received on Hedera." : "Processing on Hedera..."}
                </div>
              </>
            ) : null}
            {processLog ? (
              <div className="bg-base-200 border border-base-300 rounded p-2 max-w-full overflow-x-auto">
                <div className="text-xs font-semibold mb-1">Decoded process payload</div>
                <pre className="text-xs whitespace-pre-wrap break-all">{processLog}</pre>
              </div>
            ) : null}
            {processSucceeded ? (
              <div className="flex flex-wrap gap-3 text-sm">
                {processTimeline.verifyHash ? (
                  <a className="link inline-flex items-center gap-1" href={verifyLink} target="_blank" rel="noreferrer">
                    HashScan Verify <ArrowTopRightOnSquareIcon className="h-3.5 w-3.5" />
                  </a>
                ) : null}
                {processTimeline.commitExecuteHash ? (
                  <a className="link inline-flex items-center gap-1" href={commitLink} target="_blank" rel="noreferrer">
                    HashScan Commit/Execute <ArrowTopRightOnSquareIcon className="h-3.5 w-3.5" />
                  </a>
                ) : null}
              </div>
            ) : null}
          </div>
        ) : null}

        <div className="card bg-base-100 border border-base-300 p-3 space-y-2">
          <div className="flex items-center justify-between gap-2">
            <div className="font-medium">Advanced: Nonce Gap Recovery</div>
            <button className="btn btn-ghost btn-xs" onClick={() => setShowRecoveryPanel(v => !v)}>
              {showRecoveryPanel ? "Hide" : "Show"}
            </button>
          </div>
          {showRecoveryPanel ? (
            <>
              <p className="text-xs text-base-content/70">
                If you see &quot;Nonce X is ahead of sequence&quot; errors, process pending messages in order.
              </p>
              <button className="btn btn-warning btn-sm" onClick={onCheckPending} disabled={pendingMessages.isLoading}>
                {pendingMessages.isLoading ? "Checking..." : "Check Pending Messages"}
              </button>

              {showCatchUp && pendingInfo ? (
                <div className="bg-base-200 border border-base-300 rounded p-3 space-y-2">
                  <div className="text-sm">
                    <span className="font-medium">Status:</span> Next expected nonce: {pendingInfo.nextNonce.toString()}, Latest sent:{" "}
                    {pendingInfo.latestOutboundNonce.toString()}
                  </div>
                  <div className="text-sm">
                    <span className="font-medium">Pending messages:</span> {pendingInfo.pendingCount} total, {pendingInfo.pendingMessages.length} found on-chain
                  </div>

                  {pendingInfo.pendingMessages.length > 0 ? (
                    <>
                      <div className="max-h-32 overflow-y-auto text-xs space-y-1">
                        {pendingInfo.pendingMessages.slice(0, 10).map((msg) => (
                          <div key={msg.nonce.toString()} className="flex justify-between">
                            <span>Nonce {msg.nonce.toString()}</span>
                            <span>{msg.amountLD} ETH → {msg.recipient.slice(0, 8)}...</span>
                          </div>
                        ))}
                        {pendingInfo.pendingMessages.length > 10 ? (
                          <div className="text-base-content/50">...and {pendingInfo.pendingMessages.length - 10} more</div>
                        ) : null}
                      </div>

                      <button className="btn btn-primary btn-sm w-full" onClick={onCatchUp} disabled={catchUpStatus.isProcessing || !isHedera}>
                        {!isHedera
                          ? "Switch to Hedera First"
                          : catchUpStatus.isProcessing
                            ? `Processing nonce ${catchUpStatus.currentNonce?.toString()} (${catchUpStatus.processedCount}/${catchUpStatus.totalCount})`
                            : `Process All ${pendingInfo.pendingMessages.length} Messages`}
                      </button>

                      {catchUpStatus.processedCount > 0 && !catchUpStatus.isProcessing ? (
                        <div className="alert alert-success text-xs">Successfully processed {catchUpStatus.processedCount} messages!</div>
                      ) : null}

                      {catchUpStatus.errors.length > 0 ? (
                        <div className="alert alert-error text-xs whitespace-pre-wrap">{catchUpStatus.errors.join("\n")}</div>
                      ) : null}
                    </>
                  ) : pendingInfo.pendingCount > 0 ? (
                    <div className="alert alert-warning text-xs">
                      {pendingInfo.pendingCount} messages are pending but couldn&apos;t find them in recent blocks. They may be too old. Try the Simple
                      Workers page with manual nonce entry.
                    </div>
                  ) : (
                    <div className="alert alert-success text-xs">All messages have been processed. No pending nonces.</div>
                  )}
                </div>
              ) : null}
            </>
          ) : null}
        </div>

        {(submittedTxHash || processTimeline.verifyHash || processTimeline.commitExecuteHash || processTimeline.composeHash) ? (
          <div className="card bg-base-100 border border-base-300 p-3 space-y-2">
            <div className="font-medium">Transaction timeline</div>
            {processSucceeded ? (
              <div className="alert alert-success text-sm">
                Bridge complete. Tokens should now be available on the destination chain.
              </div>
            ) : null}
            <div className="text-xs space-y-1">
              {submittedTxHash ? (
                <p>
                  Source send:{" "}
                  <a className="link font-mono break-all" href={baseTxLink} target="_blank" rel="noreferrer">
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
