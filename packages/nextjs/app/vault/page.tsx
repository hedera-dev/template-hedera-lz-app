"use client";

import {
  VaultActionForm,
  VaultExpectationCard,
  VaultFlowStepper,
  VaultIntentSelector,
  VaultRecoveryPanel,
  VaultTechnicalDetails,
  VaultTransactionTimeline,
} from "~~/components/vault";
import { useVaultFlowController } from "~~/hooks/lz-app";

const BASE_CHAIN_ID = 84532;

export default function VaultPage() {
  const flow = useVaultFlowController();

  const submitLabel =
    flow.relayerProcessing
      ? `Finalizing on ${flow.destinationChainId === BASE_CHAIN_ID ? "Base" : "Hedera"}...`
      : flow.isOnSourceChain
        ? "Submit"
        : `Switch to ${flow.sourceChainId === BASE_CHAIN_ID ? "Base Sepolia" : "Hedera Testnet"}`;

  const destinationLabel = flow.destinationChainId === BASE_CHAIN_ID ? "Base" : "Hedera";

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Vault Actions</h1>

      <VaultIntentSelector intent={flow.intent} onChange={flow.setIntent} disabled={flow.relayerProcessing || flow.receipt.isLoading} />

      <VaultExpectationCard
        title={flow.intentInfo.title}
        description={flow.intentInfo.description}
        source={flow.intentInfo.source}
        destination={flow.intentInfo.destination}
        amountLabel={flow.intentInfo.amountLabel}
        amountHint={flow.intentInfo.amountHint}
      />

      <VaultActionForm
        amount={flow.amount}
        onAmountChange={flow.setAmount}
        amountLabel={flow.intentInfo.amountLabel}
        amountPlaceholder={flow.intentInfo.amountPlaceholder}
        amountHint={flow.intentInfo.amountHint}
        quoteNativeFee={flow.quote.nativeFee}
        estimatedMsgValue={flow.estimatedMsgValue}
        onSubmit={flow.onSubmit}
        submitLabel={submitLabel}
        submitDisabled={flow.relayerProcessing || flow.receipt.isLoading || flow.quote.isFetching}
        busy={flow.relayerProcessing || flow.receipt.isLoading}
        submitError={flow.submitError}
      />

      <VaultFlowStepper
        source={flow.stepStatuses.source}
        destination={flow.stepStatuses.destination}
        funds={flow.stepStatuses.funds}
        destinationLabel={destinationLabel}
      />

      <VaultRecoveryPanel
        pendingMessage={flow.pendingMessage}
        relayerError={flow.relayerError}
        processError={flow.processError}
        isOnDestinationChain={flow.isOnDestinationChain}
        destinationLabel={destinationLabel}
        onManualProcess={flow.onManualProcess}
        onCheckNonce={flow.onCheckExpectedNonce}
        onCatchUp={flow.onCatchUpVault}
        manualPending={flow.phase === "manual_processing"}
        checkingNonce={flow.checkingNonce}
        nextExpectedNonce={flow.nextExpectedNonce}
        catchUpStatus={flow.catchUpStatus}
      />

      <VaultTransactionTimeline
        sourceTxHash={flow.submittedTxHash}
        sourceTxLink={flow.sourceTxLink}
        verifyHash={flow.timeline.verifyHash}
        verifyLink={flow.verifyLink}
        commitHash={flow.timeline.commitExecuteHash}
        commitLink={flow.commitLink}
        composeHash={flow.timeline.composeHash}
        composeLink={flow.composeLink}
      />

      <VaultTechnicalDetails
        open={flow.advancedOpen}
        onToggle={flow.setAdvancedOpen}
        processLog={flow.processLog}
        lzLink={flow.lzLink}
        strategyAddress={flow.strategyAddress}
      />
    </div>
  );
}
