"use client";

import { useState } from "react";
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
        <input className="input input-bordered" placeholder="Source EID (40245)" value={srcEid} onChange={(e) => setSrcEid(e.target.value)} />
        <input className="input input-bordered" placeholder="Destination EID (40285)" value={dstEid} onChange={(e) => setDstEid(e.target.value)} />
        <input className="input input-bordered" placeholder="Source OFT address" value={srcOftAddress} onChange={(e) => setSrcOftAddress(e.target.value)} />
        <input className="input input-bordered" placeholder="Destination OFT address" value={dstOftAddress} onChange={(e) => setDstOftAddress(e.target.value)} />
        <div className="flex gap-2 items-center">
          <input className="input input-bordered flex-1" placeholder="Outbound nonce" value={nonce} onChange={(e) => setNonce(e.target.value)} />
          <button className="btn btn-secondary btn-sm" onClick={onFetchNextNonce} disabled={loadingNonce}>
            {loadingNonce ? "..." : "Get Next Nonce"}
          </button>
        </div>
        {nextNonce && (
          <div className="text-sm text-info">
            Next expected nonce: <strong>{nextNonce}</strong>
            {nonce && BigInt(nonce) > BigInt(nextNonce) && (
              <span className="text-warning ml-2">
                (You entered {nonce} - there are {BigInt(nonce) - BigInt(nextNonce)} pending messages before this one)
              </span>
            )}
          </div>
        )}
        <input className="input input-bordered" placeholder="Amount (shared decimals units)" value={amount} onChange={(e) => setAmount(e.target.value)} />
        <input className="input input-bordered" placeholder="Recipient 0x..." value={recipient} onChange={(e) => setRecipient(e.target.value)} />
        <input className="input input-bordered" placeholder="Compose message (optional 0x...)" value={composeMsg} onChange={(e) => setComposeMsg(e.target.value)} />
        <input className="input input-bordered" placeholder="Compose from (optional 0x...)" value={composeFrom} onChange={(e) => setComposeFrom(e.target.value)} />
        <input className="input input-bordered" placeholder="Compose to (optional 0x...)" value={composeTo} onChange={(e) => setComposeTo(e.target.value)} />
        <button className="btn btn-primary" disabled={!workers.isOwner || processor.isPending} onClick={onProcess}>
          {processor.isPending ? "Processing..." : "verify + commitAndExecute"}
        </button>
        {error ? <div className="alert alert-error text-sm whitespace-pre-wrap">{error}</div> : null}
        {result ? <div className="text-xs font-mono break-all text-success">commitAndExecute tx: {result}</div> : null}
      </div>
    </div>
  );
}
