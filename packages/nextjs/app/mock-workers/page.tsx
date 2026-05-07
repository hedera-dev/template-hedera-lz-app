"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowTopRightOnSquareIcon } from "@heroicons/react/24/outline";
import { useMockWorkers, useProcessReceive } from "~~/hooks/lz-app";

export default function MockWorkersPage() {
  const [chainId, setChainId] = useState<296 | 84532>(296);
  const [srcEid, setSrcEid] = useState("40245");
  const [dstEid, setDstEid] = useState("40285");
  const [nonce, setNonce] = useState("");
  const [amount, setAmount] = useState("0.0005");
  const [recipient, setRecipient] = useState("");
  const [srcOftAddress, setSrcOftAddress] = useState("");
  const [dstOftAddress, setDstOftAddress] = useState("");
  const [composeMsg, setComposeMsg] = useState("");
  const [composeFrom, setComposeFrom] = useState("");
  const [composeTo, setComposeTo] = useState("");
  const [result, setResult] = useState<`0x${string}` | undefined>();
  const [error, setError] = useState("");
  const [nextNonce, setNextNonce] = useState<string | null>(null);
  const [loadingNonce, setLoadingNonce] = useState(false);
  const workers = useMockWorkers(chainId);
  const processor = useProcessReceive(chainId);
  const destinationLabel = chainId === 296 ? "Hedera" : "Base";
  const sourceLabel = chainId === 296 ? "Base" : "Hedera";
  const destinationTxBase = chainId === 84532 ? "https://sepolia.basescan.org/tx/" : "https://hashscan.io/testnet/tx/";
  const resultLink = result ? `${destinationTxBase}${result}` : "";

  useEffect(() => {
    if (chainId === 296) {
      setSrcEid("40245");
      setDstEid("40285");
      return;
    }
    setSrcEid("40285");
    setDstEid("40245");
  }, [chainId]);

  const nonceWarning = useMemo(() => {
    if (!nextNonce || !nonce) return "";
    try {
      const typed = BigInt(nonce);
      const expected = BigInt(nextNonce);
      if (typed <= expected) return "";
      return `You entered nonce ${typed.toString()}. There are ${String(typed - expected)} pending message(s) before it.`;
    } catch {
      return "";
    }
  }, [nextNonce, nonce]);

  const onFetchNextNonce = async () => {
    if (!srcOftAddress || !dstOftAddress) {
      setError("Please enter source and destination OFT addresses first");
      return;
    }
    setLoadingNonce(true);
    setError("");
    try {
      const next = await processor.getNextNonce(
        srcOftAddress as `0x${string}`,
        dstOftAddress as `0x${string}`,
        Number(srcEid),
      );
      setNextNonce(next.toString());
      if (!nonce) {
        setNonce(next.toString());
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch nonce");
    } finally {
      setLoadingNonce(false);
    }
  };

  const onProcess = async () => {
    setError("");
    setResult(undefined);
    try {
      const processed = await processor.process({
        sourceChainId: chainId === 296 ? 84532 : 296,
        destinationChainId: chainId,
        srcEid: Number(srcEid),
        dstEid: Number(dstEid),
        nonce: BigInt(nonce),
        amount,
        recipient: recipient as `0x${string}`,
        srcOftAddress: srcOftAddress as `0x${string}`,
        dstOftAddress: dstOftAddress as `0x${string}`,
        composeMsg: composeMsg ? (composeMsg as `0x${string}`) : undefined,
        composeFrom: composeFrom ? (composeFrom as `0x${string}`) : undefined,
        composeTo: composeTo ? (composeTo as `0x${string}`) : undefined,
      });
      setResult(processed.commitExecuteHash);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Processing failed");
    }
  };

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Manual Workers Recovery</h1>
      <p className="text-sm text-base-content/70">
        Advanced console for owner-triggered destination processing when relayer automation fails.
      </p>

      {!workers.isOwner ? <div className="alert alert-warning">Operator access required. Only worker owner can run processing.</div> : null}

      <div className="card bg-base-200 border border-base-300 rounded-xl p-4 space-y-4">
        <div className="card bg-base-100 border border-base-300 rounded-xl p-4 space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="font-semibold">Recovery Route</p>
              <p className="text-xs text-base-content/60">
                Source {sourceLabel} {"->"} Destination {destinationLabel}
              </p>
            </div>
            <div className="join">
              <button className={`btn btn-sm join-item ${chainId === 296 ? "btn-primary" : ""}`} onClick={() => setChainId(296)}>
                Destination Hedera
              </button>
              <button className={`btn btn-sm join-item ${chainId === 84532 ? "btn-primary" : ""}`} onClick={() => setChainId(84532)}>
                Destination Base
              </button>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            <label className="form-control">
              <span className="label-text text-xs text-base-content/70">Source EID</span>
              <input className="input input-bordered rounded-lg" value={srcEid} onChange={(e) => setSrcEid(e.target.value)} />
            </label>
            <label className="form-control">
              <span className="label-text text-xs text-base-content/70">Destination EID</span>
              <input className="input input-bordered rounded-lg" value={dstEid} onChange={(e) => setDstEid(e.target.value)} />
            </label>
          </div>
        </div>

        <div className="card bg-base-100 border border-base-300 rounded-xl p-4 space-y-3">
          <p className="font-semibold">Message Payload</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            <input className="input input-bordered rounded-lg" placeholder="Source OFT address" value={srcOftAddress} onChange={(e) => setSrcOftAddress(e.target.value)} />
            <input className="input input-bordered rounded-lg" placeholder="Destination OFT address" value={dstOftAddress} onChange={(e) => setDstOftAddress(e.target.value)} />
          </div>
          <div className="flex gap-2 items-center">
            <input className="input input-bordered rounded-lg flex-1" placeholder="Outbound nonce" value={nonce} onChange={(e) => setNonce(e.target.value)} />
            <button className="btn btn-secondary btn-sm rounded-lg" onClick={onFetchNextNonce} disabled={loadingNonce}>
              {loadingNonce ? "Checking..." : "Get Next Nonce"}
            </button>
          </div>
          {nextNonce ? (
            <div className="text-xs text-base-content/80">
              Next expected nonce on destination worker: <strong>{nextNonce}</strong>
            </div>
          ) : null}
          {nonceWarning ? <div className="alert alert-warning text-xs py-2">{nonceWarning}</div> : null}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            <input className="input input-bordered rounded-lg" placeholder="Amount (shared decimals units)" value={amount} onChange={(e) => setAmount(e.target.value)} />
            <input className="input input-bordered rounded-lg" placeholder="Recipient 0x..." value={recipient} onChange={(e) => setRecipient(e.target.value)} />
          </div>
          <details className="collapse collapse-arrow bg-base-200 border border-base-300 rounded-lg">
            <summary className="collapse-title text-sm font-medium py-2 min-h-0">Optional compose payload</summary>
            <div className="collapse-content pt-2 space-y-2">
              <input className="input input-bordered rounded-lg w-full" placeholder="Compose message (optional 0x...)" value={composeMsg} onChange={(e) => setComposeMsg(e.target.value)} />
              <input className="input input-bordered rounded-lg w-full" placeholder="Compose from (optional 0x...)" value={composeFrom} onChange={(e) => setComposeFrom(e.target.value)} />
              <input className="input input-bordered rounded-lg w-full" placeholder="Compose to (optional 0x...)" value={composeTo} onChange={(e) => setComposeTo(e.target.value)} />
            </div>
          </details>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-base-300 bg-base-100 px-3 py-2">
          <p className="text-xs text-base-content/65">Runs verify + commitAndExecute on {destinationLabel} worker contracts.</p>
          <button className="btn btn-primary btn-sm rounded-lg px-4" disabled={!workers.isOwner || processor.isPending} onClick={onProcess}>
            {processor.isPending ? "Processing..." : `Process on ${destinationLabel}`}
          </button>
        </div>

        {error ? <div className="alert alert-error text-sm whitespace-pre-wrap">{error}</div> : null}
        {result ? (
          <div className="card bg-base-100 border border-base-300 rounded-xl p-3">
            <p className="text-xs text-base-content/70 mb-1">commitAndExecute transaction</p>
            <a className="link inline-flex items-center gap-1 font-mono break-all text-xs" href={resultLink} target="_blank" rel="noreferrer">
              {result}
              <ArrowTopRightOnSquareIcon className="h-3.5 w-3.5 shrink-0" />
            </a>
          </div>
        ) : null}
      </div>
    </div>
  );
}
