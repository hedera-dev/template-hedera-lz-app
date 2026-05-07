"use client";

import { useMemo, useState } from "react";
import { formatEther, formatUnits, parseAbiItem, parseEther } from "viem";
import { useAccount, usePublicClient, useSwitchChain, useWaitForTransactionReceipt } from "wagmi";
import { deployedContracts } from "~~/contracts/deployedContracts";
import { RelayerRequestError, useBridgeRelayer, useLayerZeroScanLink, useOvaultQuote, useOvaultSend, useProcessReceive } from "~~/hooks/lz-app";
import { addressToBytes32, buildOvaultSendParam, type RedeemMode } from "~~/hooks/lz-app/ovaultSendParam";
import { generateGuid } from "~~/hooks/lz-app/utils/messageEncoding";
import { useDeployedContractInfo } from "~~/hooks/scaffold-hbar";
import type {
  VaultCatchUpStatus,
  VaultFlowPhase,
  VaultIntent,
  VaultPendingMessage,
  VaultProcessTimeline,
  VaultStepStatus,
} from "./vaultFlowTypes";

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
const OFT_SENT_EVENT = parseAbiItem(
  "event OFTSent(bytes32 indexed guid, uint32 dstEid, address indexed fromAddress, uint256 amountSentLD, uint256 amountReceivedLD)",
);

const intentToModes = (intent: VaultIntent): { mode: "deposit" | "redeem"; redeemMode: RedeemMode } => {
  if (intent === "deposit_base_to_hedera") return { mode: "deposit", redeemMode: "local" };
  return { mode: "redeem", redeemMode: "crossChainToBase" };
};

export const useVaultFlowController = () => {
  const [intent, setIntent] = useState<VaultIntent>("deposit_base_to_hedera");
  const [amount, setAmount] = useState("0.0005");
  const [submittedTxHash, setSubmittedTxHash] = useState<`0x${string}` | undefined>();
  const [timeline, setTimeline] = useState<VaultProcessTimeline>({});
  const [submitError, setSubmitError] = useState("");
  const [processError, setProcessError] = useState("");
  const [relayerError, setRelayerError] = useState("");
  const [processLog, setProcessLog] = useState("");
  const [nextExpectedNonce, setNextExpectedNonce] = useState<bigint | null>(null);
  const [checkingNonce, setCheckingNonce] = useState(false);
  const [pendingMessage, setPendingMessage] = useState<VaultPendingMessage | undefined>();
  const [relayerProcessing, setRelayerProcessing] = useState(false);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [catchUpStatus, setCatchUpStatus] = useState<VaultCatchUpStatus>({
    isProcessing: false,
    currentNonce: null,
    processedCount: 0,
    totalCount: 0,
    errors: [],
  });

  const { mode, redeemMode } = intentToModes(intent);
  const baseClient = usePublicClient({ chainId: BASE_CHAIN_ID });
  const hederaClient = usePublicClient({ chainId: HEDERA_CHAIN_ID });
  const sourceOft = useDeployedContractInfo(mode === "deposit" ? "MyNativeOFTAdapter" : "MyShareOFT", BASE_CHAIN_ID);
  const vaultDeployment = useDeployedContractInfo("MyERC4626Strategy", HEDERA_CHAIN_ID);
  const composerDeployment = useDeployedContractInfo("MyOVaultComposerStrategy", HEDERA_CHAIN_ID);
  const shareOftHub = useDeployedContractInfo("MyShareOFTAdapterStrategy", HEDERA_CHAIN_ID);
  const assetOftHub = useDeployedContractInfo("MyHTSConnector", HEDERA_CHAIN_ID);

  const relayer = useBridgeRelayer();
  const { chainId, address } = useAccount();
  const { switchChainAsync } = useSwitchChain();
  const quote = useOvaultQuote({ amount, side: mode, redeemMode });
  const sender = useOvaultSend(mode, redeemMode);
  const processReceiveHedera = useProcessReceive(296);
  const processReceiveBase = useProcessReceive(84532);
  const processReceive = pendingMessage?.destinationChainId === BASE_CHAIN_ID ? processReceiveBase : processReceiveHedera;

  const sourceChainId = mode === "deposit" ? BASE_CHAIN_ID : HEDERA_CHAIN_ID;
  const destinationChainId = pendingMessage?.destinationChainId ?? (intent === "redeem_cross_chain_base" ? BASE_CHAIN_ID : HEDERA_CHAIN_ID);
  const isOnSourceChain = chainId === sourceChainId;
  const isOnDestinationChain = chainId === destinationChainId;

  const receipt = useWaitForTransactionReceipt({
    chainId: sourceChainId,
    hash: submittedTxHash,
    query: { enabled: Boolean(submittedTxHash) },
  });
  const processReceipt = useWaitForTransactionReceipt({
    chainId: destinationChainId,
    hash: timeline.commitExecuteHash,
    query: { enabled: Boolean(timeline.commitExecuteHash) },
  });

  const lzLink = useLayerZeroScanLink(submittedTxHash, sourceChainId);
  const sourceTxLink = submittedTxHash
    ? sourceChainId === BASE_CHAIN_ID
      ? `https://sepolia.basescan.org/tx/${submittedTxHash}`
      : `https://hashscan.io/testnet/tx/${submittedTxHash}`
    : "";

  const stepStatuses = useMemo(() => {
    if (!submittedTxHash) {
      return { source: "pending", destination: "pending", funds: "pending" } as const;
    }
    const source: VaultStepStatus =
      receipt.isError || Boolean(submitError) ? "error" : receipt.isSuccess ? "done" : submittedTxHash ? "active" : "pending";
    const needsDestination = true;
    let destination: VaultStepStatus = "pending";
    if (relayerError || processError) destination = "error";
    else if (timeline.commitExecuteHash) destination = processReceipt.isSuccess ? "done" : "active";
    else if (relayerProcessing || processReceive.isPending) destination = "active";

    const funds: VaultStepStatus = destination === "done" && source === "done" ? "done" : destination === "error" || source === "error" ? "error" : "pending";
    return { source, destination, funds };
  }, [intent, receipt.isError, receipt.isSuccess, submitError, submittedTxHash, relayerError, processError, timeline.commitExecuteHash, processReceipt.isSuccess, relayerProcessing, processReceive.isPending]);

  const phase: VaultFlowPhase = useMemo(() => {
    if (!submittedTxHash) return "idle";
    if (!receipt.isSuccess) return "source_pending";
    if (relayerProcessing) return "relayer_processing";
    if (relayerError) return "manual_required";
    if (processReceive.isPending) return "manual_processing";
    if (timeline.commitExecuteHash && processReceipt.isSuccess) return "completed";
    if (submitError || processError) return "failed";
    return "source_confirmed";
  }, [submittedTxHash, receipt.isSuccess, intent, relayerProcessing, relayerError, processReceive.isPending, timeline.commitExecuteHash, processReceipt.isSuccess, submitError, processError]);

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

  const getIntentDescription = () => {
    if (intent === "deposit_base_to_hedera") {
      return {
        title: "Deposit to Hedera vault",
        description: "Allocate Base ETH into the Hedera strategy vault with relayer-assisted destination finalization.",
        source: "Base ETH",
        destination: "Hedera vault shares",
        amountLabel: "Deposit amount (ETH)",
        amountPlaceholder: "e.g. 0.05",
        amountHint: "You specify ETH to deposit. Shares are minted based on vault conversion rate at execution.",
      };
    }
    if (intent === "redeem_cross_chain_base") {
      return {
        title: "Redeem to Base ETH",
        description: "Redeem shares on Hedera, then bridge resulting assets back to Base for native ETH unlock.",
        source: "Hedera vault shares",
        destination: "Base ETH wallet balance",
        amountLabel: "Redeem amount (shares)",
        amountPlaceholder: "e.g. 0.05",
        amountHint:
          "You redeem a portion of your vault shares (not ETH). Final ETH received depends on preview, strategy unwind, and routing fees.",
      };
    }
    return {
      title: "Redeem to Base ETH",
      description: "Redeem shares on Hedera, then bridge resulting assets back to Base for native ETH unlock.",
      source: "Hedera vault shares",
      destination: "Base ETH wallet balance",
      amountLabel: "Redeem amount (shares)",
      amountPlaceholder: "e.g. 0.05",
      amountHint:
        "You redeem a portion of your vault shares (not ETH). Final ETH received depends on preview, strategy unwind, and routing fees.",
    };
  };

  const onSubmit = async () => {
    setSubmitError("");
    setProcessError("");
    setRelayerError("");
    setProcessLog("");
    setTimeline({});

    if (!isOnSourceChain) {
      await switchChainAsync({ chainId: sourceChainId });
      return;
    }
    try {
      const sent = await sender.send(amount);
      setSubmittedTxHash(sent.txHash);
      if (!sent.needsProcessing) throw new Error("Unexpected local path: redeem is configured as cross-chain only");

      const pending: VaultPendingMessage = {
        nonce: sent.outboundNonce,
        srcEid: sent.srcEid,
        dstEid: sent.dstEid,
        sourceChainId: sent.srcEid === BASE_EID ? BASE_CHAIN_ID : HEDERA_CHAIN_ID,
        destinationChainId: sent.dstEid === BASE_EID ? BASE_CHAIN_ID : HEDERA_CHAIN_ID,
        amount,
        recipient: (sent.composeTo ?? address ?? "0x0000000000000000000000000000000000000000") as `0x${string}`,
        srcOftAddress: sent.sourceOftAddress,
        dstOftAddress: sent.destinationOftAddress,
        composeMsg: sent.composeMsg,
        composeFrom: sent.composeFrom,
        composeTo: sent.composeTo,
        composeGas: sent.composeGas,
        composeValue: sent.composeValue,
      };
      setPendingMessage(pending);
      setRelayerProcessing(true);
      try {
        const sourceClient = pending.sourceChainId === BASE_CHAIN_ID ? baseClient : hederaClient;
        if (!sourceClient) throw new Error("Missing source RPC client");
        const sourceReceipt = await sourceClient.waitForTransactionReceipt({ hash: sent.txHash });
        if (sourceReceipt.status !== "success") throw new Error("Source transaction reverted");
        if (!sent.relayerFlow) throw new Error("Missing relayer flow metadata");

        const result = await relayer.processBridge({
          flow: sent.relayerFlow,
          sourceTxHash: sent.txHash,
          srcEid: sent.srcEid,
          dstEid: sent.dstEid,
          nonce: sent.outboundNonce,
          amount,
          recipient: pending.recipient,
          srcOftAddress: pending.srcOftAddress,
          dstOftAddress: pending.dstOftAddress,
          composeMsg: pending.composeMsg,
          composeFrom: pending.composeFrom,
          composeTo: pending.composeTo,
          composeGas: pending.composeGas,
          composeValue: pending.composeValue,
        });
        setTimeline({
          verifyHash: result.verifyHash,
          commitExecuteHash: result.commitExecuteHash,
          composeHash: result.composeHash,
        });
        setProcessLog(JSON.stringify({ ...(result.debug ?? {}), composeWarning: result.composeWarning, relayer: true }, null, 2));
        if (result.composeWarning) setProcessError(result.composeWarning);
        setPendingMessage(undefined);
      } catch (err) {
        const relayerErr = err instanceof RelayerRequestError ? err : null;
        const code = relayerErr?.code ? `[${relayerErr.code}] ` : "";
        setRelayerError(code + (err instanceof Error ? err.message : "Relayer failed"));
      } finally {
        setRelayerProcessing(false);
      }
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Transaction failed to submit");
    }
  };

  const onChangeIntent = (nextIntent: VaultIntent) => {
    setIntent(nextIntent);
    // Clear transient flow state so a new intent starts clean.
    setSubmittedTxHash(undefined);
    setTimeline({});
    setSubmitError("");
    setProcessError("");
    setRelayerError("");
    setProcessLog("");
    setPendingMessage(undefined);
    setRelayerProcessing(false);
    setNextExpectedNonce(null);
    setCheckingNonce(false);
    setCatchUpStatus({
      isProcessing: false,
      currentNonce: null,
      processedCount: 0,
      totalCount: 0,
      errors: [],
    });
  };

  const onManualProcess = async () => {
    setProcessError("");
    setRelayerError("");
    if (!pendingMessage) {
      setProcessError("No pending message to process");
      return;
    }
    if (!isOnDestinationChain) {
      await switchChainAsync({ chainId: destinationChainId });
      return;
    }
    try {
      const nextNonce = await processReceive.getNextNonce(pendingMessage.srcOftAddress, pendingMessage.dstOftAddress, pendingMessage.srcEid);
      setNextExpectedNonce(nextNonce);
      if (pendingMessage.nonce > nextNonce) {
        setProcessError(
          `Nonce gap detected. Message nonce ${pendingMessage.nonce.toString()} but destination expects ${nextNonce.toString()}.`,
        );
        return;
      }
      const processed = await processReceive.process({
        sourceChainId: pendingMessage.sourceChainId,
        destinationChainId: pendingMessage.destinationChainId,
        srcEid: pendingMessage.srcEid,
        dstEid: pendingMessage.dstEid,
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
      setTimeline({
        verifyHash: processed.verifyHash,
        commitExecuteHash: processed.commitExecuteHash,
        composeHash: processed.composeHash,
      });
      setProcessLog(JSON.stringify({ ...processed.debug, relayer: false }, null, 2));
      setPendingMessage(undefined);
    } catch (err) {
      setProcessError(err instanceof Error ? err.message : "Manual processing failed");
    }
  };

  const onCheckExpectedNonce = async () => {
    if (!pendingMessage) return;
    setCheckingNonce(true);
    try {
      const nonce = await processReceive.getNextNonce(
        pendingMessage.srcOftAddress,
        pendingMessage.dstOftAddress,
        pendingMessage.srcEid,
      );
      setNextExpectedNonce(nonce);
    } catch (err) {
      setProcessError(err instanceof Error ? err.message : "Failed to fetch expected nonce");
    } finally {
      setCheckingNonce(false);
    }
  };

  const fetchPendingVaultMessages = async (): Promise<VaultPendingMessage[]> => {
    if (!baseClient || !hederaClient || !sourceOft || !vaultDeployment || !composerDeployment) {
      throw new Error("Missing clients/deployments for catch-up");
    }
    const dstOftAddress = assetOftHub?.address as `0x${string}` | undefined;
    if (!dstOftAddress) throw new Error("Missing destination OFT deployment");
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
    const logs = await baseClient.getLogs({ address: sourceOft.address, event: OFT_SENT_EVENT, fromBlock: startBlock, toBlock: currentBlock });
    const srcOappB32 = addressToBytes32(sourceOft.address as `0x${string}`);
    const dstOappB32 = addressToBytes32(dstOftAddress);
    const byGuid = new Map<string, (typeof logs)[number]>();
    for (const log of logs) {
      if (log.args.guid) byGuid.set(log.args.guid.toLowerCase(), log);
    }

    const messages: VaultPendingMessage[] = [];
    for (let nonce = nextNonce; nonce <= latestOutboundNonce; nonce++) {
      const guid = generateGuid({ nonce, srcEid: BASE_EID, srcOappB32, dstEid: HEDERA_EID, dstOappB32 }).toLowerCase();
      const log = byGuid.get(guid);
      if (!log?.args.fromAddress) continue;
      const amountSent = (log.args.amountSentLD ?? log.args.amountReceivedLD) as bigint;
      const senderAddr = log.args.fromAddress as `0x${string}`;
      const amountStr = formatUnits(amountSent, 18);
      const built = await buildOvaultSendParam({
        side: "deposit",
        amount: amountStr,
        receiverAddress: senderAddr,
        hederaClient,
        vaultDeployment,
        composerDeployment,
        shareOftHub: shareOftHub || undefined,
        assetOftHub: assetOftHub || undefined,
      });
      messages.push({
        nonce,
        srcEid: BASE_EID,
        dstEid: HEDERA_EID,
        sourceChainId: BASE_CHAIN_ID,
        destinationChainId: HEDERA_CHAIN_ID,
        amount: amountStr,
        recipient: composerDeployment.address as `0x${string}`,
        srcOftAddress: sourceOft.address as `0x${string}`,
        dstOftAddress,
        composeMsg: built.sendParam.composeMsg as `0x${string}`,
        composeFrom: senderAddr,
        composeTo: composerDeployment.address as `0x${string}`,
        composeGas: BigInt(built.composeGas),
        composeValue: built.composeValue,
      });
    }
    return messages;
  };

  const onCatchUpVault = async () => {
    if (!address) return;
    if (chainId !== HEDERA_CHAIN_ID) {
      await switchChainAsync({ chainId: HEDERA_CHAIN_ID });
      return;
    }
    try {
      const pending = await fetchPendingVaultMessages();
      if (pending.length === 0) {
        setProcessError("No pending vault nonces found.");
        return;
      }
      setCatchUpStatus({ isProcessing: true, currentNonce: null, processedCount: 0, totalCount: pending.length, errors: [] });
      for (let i = 0; i < pending.length; i++) {
        const msg = pending[i];
        setCatchUpStatus(prev => ({ ...prev, currentNonce: msg.nonce }));
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
      }
      setCatchUpStatus(prev => ({ ...prev, isProcessing: false, currentNonce: null }));
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Catch-up failed";
      setCatchUpStatus(prev => ({ ...prev, isProcessing: false, errors: [...prev.errors, msg] }));
    }
  };

  const verifyLink = timeline.verifyHash ? `https://hashscan.io/testnet/tx/${timeline.verifyHash}` : "";
  const commitLink = timeline.commitExecuteHash ? `https://hashscan.io/testnet/tx/${timeline.commitExecuteHash}` : "";
  const composeLink = timeline.composeHash ? `https://hashscan.io/testnet/tx/${timeline.composeHash}` : "";
  const strategyAddress = deployedContracts[296]?.HederaEtfStrategy?.address;

  return {
    intent,
    setIntent: onChangeIntent,
    amount,
    setAmount,
    phase,
    stepStatuses,
    submitError,
    processError,
    relayerError,
    processLog,
    advancedOpen,
    setAdvancedOpen,
    pendingMessage,
    nextExpectedNonce,
    checkingNonce,
    catchUpStatus,
    relayerProcessing,
    receipt,
    processReceipt,
    submittedTxHash,
    timeline,
    estimatedMsgValue: formatEther(estimatedMsgValue),
    quote,
    sourceChainId,
    destinationChainId,
    isOnSourceChain,
    isOnDestinationChain,
    sourceTxLink,
    lzLink,
    verifyLink,
    commitLink,
    composeLink,
    strategyAddress,
    intentInfo: getIntentDescription(),
    onSubmit,
    onManualProcess,
    onCheckExpectedNonce,
    onCatchUpVault,
  };
};
