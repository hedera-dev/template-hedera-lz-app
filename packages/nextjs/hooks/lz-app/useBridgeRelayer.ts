"use client";

type BridgeRelayerRequest = {
  sourceTxHash: `0x${string}`;
  srcEid: number;
  dstEid: number;
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

export type BridgeRelayerResult = {
  status: "completed" | "failed";
  sourceTxHash?: `0x${string}`;
  verifyHash?: `0x${string}`;
  commitExecuteHash?: `0x${string}`;
  composeHash?: `0x${string}`;
  error?: string;
  debug?: Record<string, unknown>;
};

export const useBridgeRelayer = () => {
  const processBridge = async (request: BridgeRelayerRequest): Promise<BridgeRelayerResult> => {
    const response = await fetch("/api/relayer/bridge", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...request,
        nonce: request.nonce.toString(),
        composeGas: request.composeGas?.toString(),
        composeValue: request.composeValue?.toString(),
      }),
    });

    const result = (await response.json()) as BridgeRelayerResult;
    if (!response.ok || result.status === "failed") {
      throw new Error(result.error || "Relayer bridge processing failed");
    }
    return result;
  };

  return { processBridge };
};
