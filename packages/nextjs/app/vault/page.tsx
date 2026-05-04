"use client";

import { useMemo, useState } from "react";
import { encodeFunctionData, formatEther, formatUnits, parseAbiItem, parseEther } from "viem";
import { ArrowTopRightOnSquareIcon } from "@heroicons/react/24/outline";
import { useAccount, usePublicClient, useSwitchChain, useWaitForTransactionReceipt } from "wagmi";
import { deployedContracts } from "~~/contracts/deployedContracts";
import { useLayerZeroScanLink, useOvaultQuote, useOvaultSend, useProcessReceive } from "~~/hooks/lz-app";
import { buildOvaultSendParam, addressToBytes32 } from "~~/hooks/lz-app/ovaultSendParam";
import { generateGuid } from "~~/hooks/lz-app/utils/messageEncoding";
import { useDeployedContractInfo } from "~~/hooks/scaffold-hbar";

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

type CatchUpStatus = {
  isProcessing: boolean;
  currentNonce: bigint | null;
  processedCount: number;
  totalCount: number;
  errors: string[];
};

const BASE_CHAIN_ID = 84532;
const HEDERA_CHAIN_ID = 296;
const BASE_EID = 40245;
const HEDERA_EID = 40285;
const OFT_INFO_ABI = [
  { inputs: [], name: "endpoint", outputs: [{ type: "address" }], stateMutability: "view", type: "function" },
] as const;
const OAPP_PEER_ABI = [
  { inputs: [{ name: "_eid", type: "uint32" }], name: "peers", outputs: [{ type: "bytes32" }], stateMutability: "view", type: "function" },
] as const;
const ENDPOINT_ABI = [
  {
    inputs: [
      { name: "_sender", type: "address" },
      { name: "_dstEid", type: "uint32" },
      { name: "_receiver", type: "bytes32" },
    ],
    name: "outboundNonce",
    outputs: [{ type: "uint64" }],
    stateMutability: "view",
    type: "function",
  },
] as const;
const COMPOSER_OFTS_ABI = [
  { inputs: [], name: "ASSET_OFT", outputs: [{ type: "address" }], stateMutability: "view", type: "function" },
  { inputs: [], name: "SHARE_OFT", outputs: [{ type: "address" }], stateMutability: "view", type: "function" },
] as const;
const OFT_SENT_EVENT = parseAbiItem(
  "event OFTSent(bytes32 indexed guid, uint32 dstEid, address indexed fromAddress, uint256 amountSentLD, uint256 amountReceivedLD)"
);

export default function VaultPage() {
  const [mode, setMode] = useState<"deposit" | "redeem">("deposit");
  const [amount, setAmount] = useState("0.0005");
  const [submittedTxHash, setSubmittedTxHash] = useState<`0x${string}` | undefined>();
  const [processTimeline, setProcessTimeline] = useState<ProcessTimeline>({});
  const [submitError, setSubmitError] = useState<string>("");
  const [processError, setProcessError] = useState<string>("");
  const [processLog, setProcessLog] = useState<string>("");
  const [nextExpectedNonce, setNextExpectedNonce] = useState<bigint | null>(null);
  const [checkingNonce, setCheckingNonce] = useState(false);
  const [catchUpStatus, setCatchUpStatus] = useState<CatchUpStatus>({
    isProcessing: false,
    currentNonce: null,
    processedCount: 0,
    totalCount: 0,
    errors: [],
  });
  const [pendingMessage, setPendingMessage] = useState<PendingVaultMessage | undefined>();
  const baseClient = usePublicClient({ chainId: BASE_CHAIN_ID });
  const hederaClient = usePublicClient({ chainId: HEDERA_CHAIN_ID });
  const sourceOft = useDeployedContractInfo(mode === "deposit" ? "MyNativeOFTAdapter" : "MyShareOFT", BASE_CHAIN_ID);
  const vaultDeployment = useDeployedContractInfo("MyERC4626Strategy", HEDERA_CHAIN_ID);
  const composerDeployment = useDeployedContractInfo("MyOVaultComposerStrategy", HEDERA_CHAIN_ID);
  const shareOftHub = useDeployedContractInfo("MyShareOFTAdapterStrategy", HEDERA_CHAIN_ID);
  const assetOftHub = useDeployedContractInfo("MyHTSConnector", HEDERA_CHAIN_ID);
  const { chainId, address: userAddress } = useAccount();
  const { switchChainAsync } = useSwitchChain();
  const isBase = chainId === 84532;
  const isHedera = chainId === 296;
  const sourceChainId = mode === "deposit" ? BASE_CHAIN_ID : HEDERA_CHAIN_ID;
  const isOnSourceChain = mode === "deposit" ? isBase : isHedera;
  const quote = useOvaultQuote({ amount, side: mode });
  const tx = useOvaultSend(mode);
  const processReceive = useProcessReceive(296);
  const lzLink = useLayerZeroScanLink(submittedTxHash, sourceChainId === BASE_CHAIN_ID ? BASE_CHAIN_ID : HEDERA_CHAIN_ID);
  const sourceTxLink = submittedTxHash
    ? sourceChainId === BASE_CHAIN_ID
      ? `https://sepolia.basescan.org/tx/${submittedTxHash}`
      : `https://hashscan.io/testnet/tx/${submittedTxHash}`
    : "";
  const destinationContractAddress = deployedContracts[296]?.MyOVaultComposerStrategy?.address;
  const hashscanLink = destinationContractAddress
    ? `https://hashscan.io/testnet/account/${destinationContractAddress}`
    : "https://hashscan.io/testnet";
  const receipt = useWaitForTransactionReceipt({
    chainId: sourceChainId,
    hash: submittedTxHash,
    query: { enabled: Boolean(submittedTxHash) },
  });
  const processReceipt = useWaitForTransactionReceipt({
    chainId: 296,
    hash: processTimeline.commitExecuteHash,
    query: { enabled: Boolean(processTimeline.commitExecuteHash) },
  });
  const composePreview = useMemo(
    () => `mode=${mode};innerDstEid=40285(Hedera-local);amount=${amount};composer=MyOVaultComposerStrategy`,
    [mode, amount],
  );
  const processHadComposeWarning = useMemo(() => {
    if (!processLog) return false;
    try {
      return Boolean(JSON.parse(processLog).composeWarning);
    } catch {
      return false;
    }
  }, [processLog]);
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
    if (!isOnSourceChain) {
      await switchChainAsync({ chainId: sourceChainId });
      return;
    }
    try {
      const sent = await tx.send(amount);
      setSubmittedTxHash(sent.txHash);
      if (!sent.needsProcessing) {
        setPendingMessage(undefined);
        setProcessLog("Redeem/divest submitted locally on Hedera. No LayerZero worker processing is required.");
        return;
      }
      if (!sent.destinationOftAddress) {
        throw new Error("Missing destination OFT deployment for processing");
      }
      setPendingMessage({
        nonce: sent.outboundNonce,
        amount,
        // First-hop OFT message must target the composer contract (not the end user wallet).
        recipient: sent.composeTo as `0x${string}`,
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
      const resolvedDstOft = getDestinationOftAddress();
      if (!resolvedDstOft) {
        setProcessError("Missing destination OFT deployment");
        return;
      }
      const nextNonce = await processReceive.getNextNonce(
        pendingMessage.srcOftAddress,
        resolvedDstOft,
        40245,
      );
      setNextExpectedNonce(nextNonce);
      if (pendingMessage.nonce > nextNonce) {
        setProcessError(
          `Nonce gap detected. This message is nonce ${pendingMessage.nonce}, but destination expects nonce ${nextNonce}. ` +
            `Process earlier messages first (use the Workers page for manual catch-up).`,
        );
        return;
      }

      const processed = await processReceive.process({
        sourceChainId: 84532,
        destinationChainId: 296,
        srcEid: 40245,
        dstEid: 40285,
        nonce: pendingMessage.nonce,
        amount: pendingMessage.amount,
        recipient: pendingMessage.recipient,
        srcOftAddress: pendingMessage.srcOftAddress,
        dstOftAddress: resolvedDstOft,
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
      if (processed.debug?.composeWarning) {
        setProcessError(processed.debug.composeWarning);
      }
      setProcessLog(JSON.stringify(processed.debug, null, 2));
    } catch (err) {
      const raw = err instanceof Error ? err.message : "Processing failed";
      if (raw.includes("compose302")) {
        setProcessError(
          "compose302 failed. This is the Hedera vault execution step (not an extra user action). " +
            "Commit/execute may have succeeded, but compose needs more gas or retry. " +
            `Details: ${raw}`,
        );
      } else {
        setProcessError(raw);
      }
    }
  };

  const onCheckNextNonce = async () => {
    if (!pendingMessage) return;
    setCheckingNonce(true);
    try {
      const resolvedDstOft = getDestinationOftAddress();
      if (!resolvedDstOft) {
        setProcessError("Missing destination OFT deployment");
        return;
      }
      const nextNonce = await processReceive.getNextNonce(
        pendingMessage.srcOftAddress,
        resolvedDstOft,
        40245,
      );
      setNextExpectedNonce(nextNonce);
    } catch (err) {
      setProcessError(err instanceof Error ? err.message : "Failed to fetch next expected nonce");
    } finally {
      setCheckingNonce(false);
    }
  };

  const fetchPendingVaultMessages = async (): Promise<PendingVaultMessage[]> => {
    if (!baseClient || !hederaClient || !sourceOft || !vaultDeployment || !composerDeployment) {
      throw new Error("Missing clients/deployments for catch-up");
    }

    const dstOftAddress = getDestinationOftAddress();
    if (!dstOftAddress) {
      throw new Error("Missing destination OFT deployment");
    }

    const nextNonce = await processReceive.getNextNonce(sourceOft.address as `0x${string}`, dstOftAddress, BASE_EID);
    const endpointAddress = (await baseClient.readContract({
      address: sourceOft.address,
      abi: OFT_INFO_ABI,
      functionName: "endpoint",
    })) as `0x${string}`;
    const peer = (await baseClient.readContract({
      address: sourceOft.address,
      abi: OAPP_PEER_ABI,
      functionName: "peers",
      args: [HEDERA_EID],
    })) as `0x${string}`;
    const latestOutboundNonce = BigInt(
      await baseClient.readContract({
        address: endpointAddress,
        abi: ENDPOINT_ABI,
        functionName: "outboundNonce",
        args: [sourceOft.address, HEDERA_EID, peer],
      }),
    );

    if (latestOutboundNonce < nextNonce) return [];

    const currentBlock = await baseClient.getBlockNumber();
    const startBlock = currentBlock > 50000n ? currentBlock - 50000n : 0n;
    const logs = await baseClient.getLogs({
      address: sourceOft.address,
      event: OFT_SENT_EVENT,
      fromBlock: startBlock,
      toBlock: currentBlock,
    });

    const srcOappB32 = addressToBytes32(sourceOft.address as `0x${string}`);
    const dstOappB32 = addressToBytes32(dstOftAddress);
    const byGuid = new Map<string, (typeof logs)[number]>();
    for (const log of logs) {
      if (log.args.guid) byGuid.set(log.args.guid.toLowerCase(), log);
    }

    const messages: PendingVaultMessage[] = [];
    for (let nonce = nextNonce; nonce <= latestOutboundNonce; nonce++) {
      const guid = generateGuid({
        nonce,
        srcEid: BASE_EID,
        srcOappB32,
        dstEid: HEDERA_EID,
        dstOappB32,
      }).toLowerCase();
      const log = byGuid.get(guid);
      if (!log?.args.fromAddress) continue;

      const amountSent = (log.args.amountSentLD ?? log.args.amountReceivedLD) as bigint;
      const sender = log.args.fromAddress as `0x${string}`;
      const amountStr = formatUnits(amountSent, 18);
      const built = await buildOvaultSendParam({
        side: mode,
        amount: amountStr,
        receiverAddress: sender,
        hederaClient,
        vaultDeployment,
        composerDeployment,
        shareOftHub: shareOftHub || undefined,
        assetOftHub: assetOftHub || undefined,
      });

      messages.push({
        nonce,
        amount: amountStr,
        recipient: composerDeployment.address as `0x${string}`,
        srcOftAddress: sourceOft.address as `0x${string}`,
        dstOftAddress,
        composeMsg: built.sendParam.composeMsg as `0x${string}`,
        composeFrom: sender,
        composeTo: composerDeployment.address as `0x${string}`,
        composeGas: BigInt(built.composeGas),
        composeValue: built.composeValue,
      });
    }
    return messages;
  };

  // Use deployed contracts directly instead of reading from potentially stale composer
  const getDestinationOftAddress = (): `0x${string}` | null => {
    if (mode === "deposit") {
      return assetOftHub?.address as `0x${string}` | null;
    } else {
      return shareOftHub?.address as `0x${string}` | null;
    }
  };

  const onCatchUpVault = async (skipCompose = false) => {
    if (!isHedera) {
      await switchChainAsync({ chainId: HEDERA_CHAIN_ID });
      return;
    }

    setProcessError("");
    
    // For orphaned messages, use bridge-style catch-up (no compose)
    if (skipCompose) {
      if (!sourceOft || !composerDeployment || !hederaClient || !userAddress) {
        setProcessError("Missing deployment info or wallet not connected");
        return;
      }
      
      // Use deployed contracts directly (not potentially stale composer addresses)
      const resolvedDstOft = getDestinationOftAddress();
      if (!resolvedDstOft) {
        setProcessError("Missing destination OFT deployment");
        return;
      }
      
      // Get the target nonce - if we have a pending message, drain up to that. Otherwise use current message nonce.
      const targetNonce = pendingMessage ? BigInt(pendingMessage.nonce) : null;
      let nextNonce = await processReceive.getNextNonce(sourceOft.address as `0x${string}`, resolvedDstOft, BASE_EID);
      
      if (targetNonce && nextNonce >= targetNonce) {
        setProcessError(`Nonces already synced. Expected ${nextNonce}, target was ${targetNonce}.`);
        return;
      }
      
      const totalToDrain = targetNonce ? Number(targetNonce - nextNonce) : 1;
      
      setCatchUpStatus({
        isProcessing: true,
        currentNonce: nextNonce,
        processedCount: 0,
        totalCount: totalToDrain,
        errors: [],
      });
      
      let processed = 0;
      while (!targetNonce || nextNonce < targetNonce) {
        try {
          setCatchUpStatus(prev => ({ ...prev, currentNonce: nextNonce }));
          
          // Fabricate a simple OFT receive to increment the destination nonce
          await processReceive.process({
            sourceChainId: BASE_CHAIN_ID,
            destinationChainId: HEDERA_CHAIN_ID,
            srcEid: BASE_EID,
            dstEid: HEDERA_EID,
            nonce: nextNonce,
            amount: "0.0001", // Minimal dust amount
            recipient: userAddress, // Send dust to user's wallet
            srcOftAddress: sourceOft.address as `0x${string}`,
            dstOftAddress: resolvedDstOft,
            // No compose params = simple receive (skips compose step)
          });
          
          processed++;
          setCatchUpStatus(prev => ({ ...prev, processedCount: processed }));
          nextNonce++;
          
          // If no target, drain one at a time
          if (!targetNonce) break;
        } catch (err) {
          const errMsg = `Nonce ${nextNonce}: ${err instanceof Error ? err.message : "Failed"}`;
          setCatchUpStatus(prev => ({ ...prev, errors: [errMsg], isProcessing: false }));
          return;
        }
      }
      
      setCatchUpStatus(prev => ({ ...prev, isProcessing: false }));
      if (processed > 0 && targetNonce) {
        setProcessError(`Drained ${processed} orphan nonce(s). Ready to process your vault deposit.`);
      }
      return;
    }

    const pending = await fetchPendingVaultMessages();
    if (pending.length === 0) {
      setProcessError("No pending vault messages found on-chain. Use 'Drain Orphan Nonces' for old messages.");
      return;
    }

    setCatchUpStatus({
      isProcessing: true,
      currentNonce: null,
      processedCount: 0,
      totalCount: pending.length,
      errors: [],
    });

    for (let i = 0; i < pending.length; i++) {
      const msg = pending[i];
      setCatchUpStatus(prev => ({ ...prev, currentNonce: msg.nonce }));
      try {
        await processReceive.process({
          sourceChainId: BASE_CHAIN_ID,
          destinationChainId: HEDERA_CHAIN_ID,
          srcEid: BASE_EID,
          dstEid: HEDERA_EID,
          nonce: msg.nonce,
          amount: msg.amount,
          recipient: msg.recipient,
          srcOftAddress: msg.srcOftAddress,
          dstOftAddress: msg.dstOftAddress,
          composeMsg: msg.composeMsg,
          composeFrom: msg.composeFrom,
          composeTo: msg.composeTo,
          composeGas: msg.composeGas,
          composeValue: msg.composeValue,
        });
        setCatchUpStatus(prev => ({ ...prev, processedCount: prev.processedCount + 1 }));
      } catch (err) {
        const errMsg = `Nonce ${msg.nonce}: ${err instanceof Error ? err.message : "Failed"}`;
        setCatchUpStatus(prev => ({ ...prev, errors: [...prev.errors, errMsg] }));
        break;
      }
    }

    setCatchUpStatus(prev => ({ ...prev, isProcessing: false, currentNonce: null }));
  };

  const verifyLink = processTimeline.verifyHash ? `https://hashscan.io/testnet/tx/${processTimeline.verifyHash}` : "";
  const commitLink = processTimeline.commitExecuteHash ? `https://hashscan.io/testnet/tx/${processTimeline.commitExecuteHash}` : "";
  const composeLink = processTimeline.composeHash ? `https://hashscan.io/testnet/tx/${processTimeline.composeHash}` : "";
  const vaultLink = vaultDeployment?.address ? `https://hashscan.io/testnet/account/${vaultDeployment.address}` : "";
  const strategyAddress = deployedContracts[296]?.HederaEtfStrategy?.address;
  const strategyLink = strategyAddress ? `https://hashscan.io/testnet/account/${strategyAddress}` : "";
  const composerLink = composerDeployment?.address ? `https://hashscan.io/testnet/account/${composerDeployment.address}` : "";
  const assetOftLink = assetOftHub?.address ? `https://hashscan.io/testnet/account/${assetOftHub.address}` : "";
  const shareOftLink = shareOftHub?.address ? `https://hashscan.io/testnet/account/${shareOftHub.address}` : "";
  const routerLink = "https://hashscan.io/testnet/account/0x0000000000000000000000000000000000004b40";
  const factoryLink = "https://hashscan.io/testnet/account/0x00000000000000000000000000000000000026e7";
  const wethWhbarPairLink = "https://hashscan.io/testnet/account/0xa1Ada273b0D411F4B824B286558269fB08050B8f";
  const wethHustlersPairLink = "https://hashscan.io/testnet/account/0x34aBd28828C37c6f6a7009D7B6484983FB6289dA";
  const wethWhbarSaucerPoolLink = "https://testnet.saucerswap.finance/pool/0.0.8819477";
  const wethHustlersSaucerPoolLink = "https://testnet.saucerswap.finance/pool/0.0.8823364";

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
        <div className="alert alert-info text-sm py-2">
          Shares / assets from compose are delivered on <strong>Hedera</strong> only (local OFT path). Bridging to Base
          Sepolia must be a <strong>separate</strong> send from the hub after this flow completes — bundling a remote
          <code className="mx-1">dstEid</code> inside the same compose hit LayerZero <code className="mx-1">LZ_SendReentrancy</code>.
        </div>
        <input className="input input-bordered" value={amount} onChange={(e) => setAmount(e.target.value)} />
        <p className="text-sm text-base-content/70">Quote native fee: {quote.nativeFee}</p>
        <p className="text-sm text-base-content/70">Estimated msg.value: {formatEther(estimatedMsgValue)} ETH</p>
        <p className="text-xs text-base-content/60">
          Quote status: {quote.isFetching ? "refreshing" : quote.isLoading ? "loading" : quote.ok ? "ready" : "error"}
          {quote.updatedAt ? ` - updated ${new Date(quote.updatedAt).toLocaleTimeString()}` : ""}
        </p>
        <p className="text-xs font-mono bg-base-300 p-2 rounded">composeMsg preview: {composePreview}</p>
        {!isOnSourceChain ? (
          <div className="alert alert-warning">
            Switch to {mode === "deposit" ? "Base Sepolia" : "Hedera Testnet"} to {mode}.
          </div>
        ) : null}
        <button className="btn btn-primary" onClick={onSubmit} disabled={tx.isPending || receipt.isLoading}>
          {tx.isPending || receipt.isLoading ? (
            <span className="loading loading-spinner loading-sm" />
          ) : null}
          {isOnSourceChain ? `Submit ${mode}` : `Switch to ${mode === "deposit" ? "Base Sepolia" : "Hedera Testnet"}`}
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
              <div className="text-sm text-success">
                {mode === "deposit"
                  ? "Funds locked on Base. Ready for Hedera processing."
                  : "Redeem/divest submitted on Hedera. No worker processing is required."}
              </div>
            )}
            <div className="flex flex-wrap gap-3 text-sm">
              <a className="link inline-flex items-center gap-1" href={sourceTxLink} target="_blank" rel="noreferrer">
                {sourceChainId === BASE_CHAIN_ID ? "BaseScan" : "HashScan"} <ArrowTopRightOnSquareIcon className="h-3.5 w-3.5" />
              </a>
              {mode === "deposit" && lzLink ? (
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
            <div className="bg-base-200 border border-base-300 rounded p-2 text-xs space-y-1">
              <div className="flex items-center justify-between gap-3">
                <span>Message nonce: {pendingMessage.nonce.toString()}</span>
                <button className="btn btn-ghost btn-xs" onClick={onCheckNextNonce} disabled={checkingNonce}>
                  {checkingNonce ? "Checking..." : "Check expected nonce"}
                </button>
              </div>
              {nextExpectedNonce !== null ? (
                <div>
                  Destination expects nonce: {nextExpectedNonce.toString()}
                  {pendingMessage.nonce > nextExpectedNonce ? (
                    <span className="text-warning"> (earlier messages must be processed first)</span>
                  ) : null}
                </div>
              ) : null}
            </div>
            {!isHedera ? <div className="alert alert-warning text-sm">Switch to Hedera Testnet to process this message.</div> : null}
            <button className="btn btn-secondary" onClick={onProcess} disabled={processReceive.isPending}>
              {isHedera ? "Process on Hedera" : "Switch to Hedera Testnet"}
            </button>
            {processError ? <div className="alert alert-error text-sm whitespace-pre-wrap break-all">{processError}</div> : null}
            {processError.includes("Nonce gap detected") ? (
              <div className="space-y-2">
                <div className="text-xs text-base-content/70">
                  Process pending vault nonces automatically, or use <a className="link" href="/mock-workers">Workers</a> manually.
                </div>
                <div className="flex gap-2 flex-wrap">
                  <button className="btn btn-warning btn-sm" onClick={() => onCatchUpVault(false)} disabled={catchUpStatus.isProcessing}>
                    {catchUpStatus.isProcessing
                      ? `Processing nonce ${catchUpStatus.currentNonce?.toString()} (${catchUpStatus.processedCount}/${catchUpStatus.totalCount})`
                      : "Auto Catch-Up Vault Nonces"}
                  </button>
                  <button className="btn btn-error btn-sm" onClick={() => onCatchUpVault(true)} disabled={catchUpStatus.isProcessing}>
                    Drain Orphan Nonces
                  </button>
                </div>
                <p className="text-xs text-gray-400">
                  Use "Drain Orphan Nonces" to clear old messages sent before contract redeployment.
                  {assetOftHub && (
                    <span className="block mt-1">
                      Draining to: <code className="bg-base-300 px-1 rounded">{assetOftHub.address}</code> (MyHTSConnector)
                    </span>
                  )}
                </p>
                {catchUpStatus.processedCount > 0 && !catchUpStatus.isProcessing ? (
                  <div className="alert alert-success text-xs">Processed {catchUpStatus.processedCount} pending message(s).</div>
                ) : null}
                {catchUpStatus.errors.length > 0 ? (
                  <div className="alert alert-error text-xs whitespace-pre-wrap">{catchUpStatus.errors.join("\n")}</div>
                ) : null}
              </div>
            ) : null}
            {processTimeline.commitExecuteHash ? (
              <>
                <div className="text-sm">
                  {!processReceipt.isSuccess
                    ? "Waiting for commit + execute confirmation on Hedera..."
                    : processHadComposeWarning
                      ? "Commit + execute succeeded on Hedera, but compose302 reported an issue. Use the Compose line in the transaction timeline below on HashScan to inspect the vault execution transaction."
                      : "Hedera processing complete. Vault state should update shortly."}
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
                  {mode === "deposit" ? "Source send" : "Local redeem/divest"}:{" "}
                  <a className="link font-mono break-all" href={sourceTxLink} target="_blank" rel="noreferrer">
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

        {processTimeline.composeHash ? (
          <div className="card bg-base-100 border border-base-300 p-3 space-y-2">
            <div className="font-medium">Post-invest verification links</div>
            <div className="text-xs text-base-content/70">
              Use these after compose succeeds to verify where value sits and where swaps executed.
            </div>
            <div className="text-xs space-y-1">
              {vaultLink ? (
                <p>
                  Vault (share token):{" "}
                  <a className="link font-mono break-all" href={vaultLink} target="_blank" rel="noreferrer">
                    {vaultDeployment?.address}
                  </a>
                </p>
              ) : null}
              {strategyLink ? (
                <p>
                  ETF strategy basket:{" "}
                  <a className="link font-mono break-all" href={strategyLink} target="_blank" rel="noreferrer">
                    {strategyAddress}
                  </a>
                </p>
              ) : null}
              {composerLink ? (
                <p>
                  Composer:{" "}
                  <a className="link font-mono break-all" href={composerLink} target="_blank" rel="noreferrer">
                    {composerDeployment?.address}
                  </a>
                </p>
              ) : null}
              {assetOftLink ? (
                <p>
                  Asset OFT (hub):{" "}
                  <a className="link font-mono break-all" href={assetOftLink} target="_blank" rel="noreferrer">
                    {assetOftHub?.address}
                  </a>
                </p>
              ) : null}
              {shareOftLink ? (
                <p>
                  Share OFT (hub):{" "}
                  <a className="link font-mono break-all" href={shareOftLink} target="_blank" rel="noreferrer">
                    {shareOftHub?.address}
                  </a>
                </p>
              ) : null}
              <p>
                Saucer Router V1:{" "}
                <a className="link font-mono break-all" href={routerLink} target="_blank" rel="noreferrer">
                  0x0000000000000000000000000000000000004b40
                </a>
              </p>
              <p>
                Saucer Factory V1:{" "}
                <a className="link font-mono break-all" href={factoryLink} target="_blank" rel="noreferrer">
                  0x00000000000000000000000000000000000026e7
                </a>
              </p>
              <p>
                WETH/WHBAR pair:{" "}
                <a className="link font-mono break-all" href={wethWhbarPairLink} target="_blank" rel="noreferrer">
                  0xa1Ada273b0D411F4B824B286558269fB08050B8f
                </a>
                {" · "}
                <a className="link break-all" href={wethWhbarSaucerPoolLink} target="_blank" rel="noreferrer">
                  Saucer pool 0.0.8819477
                </a>
              </p>
              <p>
                WETH/HUSTLERS pair:{" "}
                <a className="link font-mono break-all" href={wethHustlersPairLink} target="_blank" rel="noreferrer">
                  0x34aBd28828C37c6f6a7009D7B6484983FB6289dA
                </a>
                {" · "}
                <a className="link break-all" href={wethHustlersSaucerPoolLink} target="_blank" rel="noreferrer">
                  Saucer pool 0.0.8823364
                </a>
              </p>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
