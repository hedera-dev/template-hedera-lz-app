"use client";

import type { Address } from "viem";

export type VaultIntent = "deposit_base_to_hedera" | "redeem_cross_chain_base";

export type VaultFlowPhase =
  | "idle"
  | "source_pending"
  | "source_confirmed"
  | "relayer_processing"
  | "manual_required"
  | "manual_processing"
  | "completed"
  | "failed";

export type VaultStepStatus = "pending" | "active" | "done" | "error";

export type VaultPendingMessage = {
  nonce: bigint;
  srcEid: number;
  dstEid: number;
  sourceChainId: 84532 | 296;
  destinationChainId: 84532 | 296;
  amount: string;
  recipient: Address;
  srcOftAddress: Address;
  dstOftAddress: Address;
  composeMsg?: `0x${string}`;
  composeFrom?: Address;
  composeTo?: Address;
  composeGas?: bigint;
  composeValue?: bigint;
};

export type VaultProcessTimeline = {
  verifyHash?: `0x${string}`;
  commitExecuteHash?: `0x${string}`;
  composeHash?: `0x${string}`;
};

export type VaultCatchUpStatus = {
  isProcessing: boolean;
  currentNonce: bigint | null;
  processedCount: number;
  totalCount: number;
  errors: string[];
};
