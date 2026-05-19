"use client";

export type RelayerFlow = "bridge" | "ovault" | "ovault_redeem";

export type BridgeRelayerRequest = {
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
  flow?: RelayerFlow;
};

export type BridgeRelayerResult = {
  status: "completed" | "failed";
  sourceTxHash?: `0x${string}`;
  verifyHash?: `0x${string}`;
  commitExecuteHash?: `0x${string}`;
  composeHash?: `0x${string}`;
  composeWarning?: string;
  code?: string;
  error?: string;
  debug?: Record<string, unknown>;
};

export class RelayerRequestError extends Error {
  readonly code?: string;
  readonly httpStatus?: number;

  constructor(message: string, opts?: { code?: string; httpStatus?: number }) {
    super(message);
    this.name = "RelayerRequestError";
    this.code = opts?.code;
    this.httpStatus = opts?.httpStatus;
  }
}

export const useBridgeRelayer = () => {
  const processBridge = async (request: BridgeRelayerRequest): Promise<BridgeRelayerResult> => {
    const response = await fetch("/api/relayer/bridge", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...request,
        flow: request.flow ?? "bridge",
        nonce: request.nonce.toString(),
        composeGas: request.composeGas?.toString(),
        composeValue: request.composeValue?.toString(),
      }),
    });

    const result = (await response.json()) as BridgeRelayerResult;
    if (!response.ok || result.status === "failed") {
      throw new RelayerRequestError(result.error || "Relayer bridge processing failed", {
        code: result.code,
        httpStatus: response.status,
      });
    }
    return result;
  };

  return { processBridge };
};
