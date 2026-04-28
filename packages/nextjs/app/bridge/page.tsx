"use client";

import { useState } from "react";
import { formatEther, parseEther } from "viem";
import { useAccount, useSwitchChain } from "wagmi";
import { useBridgeQuote, useBridgeSend } from "~~/hooks/lz-app";

export default function BridgePage() {
  const [amount, setAmount] = useState("0.001");
  const { chainId } = useAccount();
  const { switchChainAsync } = useSwitchChain();
  const isBase = chainId === 84532;
  const quote = useBridgeQuote(amount);
  const bridge = useBridgeSend();
  const amountWei = (() => {
    try {
      return parseEther(amount || "0");
    } catch {
      return 0n;
    }
  })();
  const estimatedTotal = quote.fee + amountWei;

  const onSend = async () => {
    if (!isBase) {
      await switchChainAsync({ chainId: 84532 });
      return;
    }
    await bridge.send(amount);
  };

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Bridge (Chapter 1)</h1>
      <div className="card bg-base-200 p-4 space-y-3">
        <label className="form-control">
          <span className="label-text">Amount ETH</span>
          <input className="input input-bordered" value={amount} onChange={(e) => setAmount(e.target.value)} />
        </label>
        <p className="text-sm text-base-content/70">Estimated fee: {quote.fee.toString()} wei</p>
        <p className="text-sm text-base-content/70">Estimated total msg.value: {formatEther(estimatedTotal)} ETH</p>
        <p className="text-xs text-base-content/60">
          Quote status: {quote.isFetching ? "refreshing" : quote.isLoading ? "loading" : quote.ok ? "ready" : "error"}
          {quote.updatedAt ? ` - updated ${new Date(quote.updatedAt).toLocaleTimeString()}` : ""}
        </p>
        {!isBase ? <div className="alert alert-warning">Switch to Base Sepolia to bridge.</div> : null}
        <button className="btn btn-primary" onClick={onSend}>
          {isBase ? "Send Bridge Tx" : "Switch to Base Sepolia"}
        </button>
      </div>
    </div>
  );
}
