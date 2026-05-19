"use client";

import { useMemo, useState } from "react";
import { PublicClient, parseAbiItem, formatUnits, encodePacked, keccak256 } from "viem";
import { useAccount, usePublicClient } from "wagmi";
import { useDeployedContractInfo, useScaffoldReadContract, useScaffoldWriteContract } from "~~/hooks/scaffold-hbar";
import { buildComposePayload, buildOftMessage, computeAmountReceivedLD, decodeOftMessage, generateGuid, addressToBytes32 } from "./utils/messageEncoding";

const BASE_EID = 40245;
const HEDERA_EID = 40285;
const BASE_CHAIN_ID = 84532;
const HEDERA_CHAIN_ID = 296;

/**
 * Hedera RPC sometimes returns data that viem can't decode.
 * This helper uses raw eth_call and manual decoding as fallback.
 */
async function safeReadContract(
  client: PublicClient,
  params: { address: `0x${string}`; abi: readonly any[]; functionName: string; args?: readonly any[] }
): Promise<any> {
  try {
    return await client.readContract(params as any);
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    if (errMsg.includes("Position") && errMsg.includes("out of bounds")) {
      // Fallback to raw RPC call
      const { encodeFunctionData } = await import("viem");
      const data = encodeFunctionData({
        abi: params.abi as any,
        functionName: params.functionName,
        args: (params.args ?? []) as any,
      });
      
      const result = await client.request({
        method: "eth_call",
        params: [{ to: params.address, data }, "latest"],
      });
      
      const raw = (result as `0x${string}`) ?? "0x";
      if (raw === "0x") throw err;

      const normalizeAddress = (hex: `0x${string}`): `0x${string}` => {
        const body = hex.slice(2).padStart(64, "0");
        return (`0x${body.slice(-40)}` as `0x${string}`);
      };

      // Hedera RPC occasionally returns malformed payload lengths that viem rejects.
      // Manually parse common scalar return types used in this hook.
      if (params.functionName === "token" || params.functionName === "endpoint") {
        return normalizeAddress(raw);
      }
      if (
        params.functionName === "sharedDecimals" ||
        params.functionName === "decimals" ||
        params.functionName === "inboundNonce" ||
        params.functionName === "outboundNonce"
      ) {
        return BigInt(raw);
      }

      throw err;
    }
    throw err;
  }
}

/**
 * Hedera's JSON-RPC can return event logs in a format that viem can't decode properly.
 * This helper polls for the receipt and only checks the status, ignoring log decoding errors.
 */
async function waitForHederaReceipt(client: PublicClient, hash: `0x${string}`, maxAttempts = 30, intervalMs = 2000) {
  for (let i = 0; i < maxAttempts; i++) {
    try {
      const receipt = await client.getTransactionReceipt({ hash });
      if (receipt) {
        if (receipt.status === "reverted") {
          throw new Error(`Transaction reverted: ${hash}`);
        }
        return receipt;
      }
    } catch (err) {
      // If it's a "transaction not found" error, keep polling
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes("could not be found") || msg.includes("not found")) {
        await new Promise(r => setTimeout(r, intervalMs));
        continue;
      }
      // If it's a decoding error (Position out of bounds), the tx likely succeeded
      // Poll the raw RPC to check status without full decoding
      if (msg.includes("Position") && msg.includes("out of bounds")) {
        // Use a raw RPC call to get just the status
        const rawReceipt = await client.request({
          method: "eth_getTransactionReceipt",
          params: [hash],
        }) as { status: string } | null;
        if (rawReceipt && rawReceipt.status === "0x1") {
          return { status: "success" as const, transactionHash: hash };
        }
        if (rawReceipt && rawReceipt.status === "0x0") {
          throw new Error(`Transaction reverted: ${hash}`);
        }
      }
      throw err;
    }
    await new Promise(r => setTimeout(r, intervalMs));
  }
  throw new Error(`Timeout waiting for transaction receipt: ${hash}`);
}

const OFT_INFO_ABI = [
  { inputs: [], name: "sharedDecimals", outputs: [{ type: "uint8" }], stateMutability: "view", type: "function" },
  { inputs: [], name: "token", outputs: [{ type: "address" }], stateMutability: "view", type: "function" },
  { inputs: [], name: "endpoint", outputs: [{ type: "address" }], stateMutability: "view", type: "function" },
] as const;
const ERC20_DECIMALS_ABI = [
  { inputs: [], name: "decimals", outputs: [{ type: "uint8" }], stateMutability: "view", type: "function" },
] as const;
const EXECUTOR_VIEW_ABI = [
  {
    inputs: [{ name: "receiveLib", type: "address" }],
    name: "receiveLibToView",
    outputs: [{ name: "receiveLibView", type: "address" }],
    stateMutability: "view",
    type: "function",
  },
] as const;
const RECEIVE_ULN_VIEW_ABI = [
  {
    inputs: [
      { name: "_packetHeader", type: "bytes" },
      { name: "_payloadHash", type: "bytes32" },
    ],
    name: "verifiable",
    outputs: [{ name: "state", type: "uint8" }],
    stateMutability: "view",
    type: "function",
  },
] as const;
const ENDPOINT_ABI = [
  {
    inputs: [
      { name: "_receiver", type: "address" },
      { name: "_srcEid", type: "uint32" },
      { name: "_sender", type: "bytes32" },
    ],
    name: "inboundNonce",
    outputs: [{ type: "uint64" }],
    stateMutability: "view",
    type: "function",
  },
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

const PACKET_SENT_EVENT = parseAbiItem(
  "event PacketSent(bytes encodedPayload, bytes options, address sendLibrary)"
);

const OFT_SENT_EVENT = parseAbiItem(
  "event OFTSent(bytes32 indexed guid, uint32 dstEid, address indexed fromAddress, uint256 amountSentLD, uint256 amountReceivedLD)"
);

type PendingMessage = {
  nonce: bigint;
  guid: `0x${string}`;
  recipient: `0x${string}`;
  amountSD: bigint;
  amountLD: string;
  sender: `0x${string}`;
  blockNumber: bigint;
};

const VERIFICATION_STATE = {
  Verifying: 0n,
  Verifiable: 1n,
  Verified: 2n,
  NotInitializable: 3n,
} as const;

const waitForVerificationState = async ({
  client,
  receiveLibView,
  packetHeader,
  payloadHash,
  attempts = 20,
  intervalMs = 1500,
}: {
  client: PublicClient;
  receiveLibView: `0x${string}`;
  packetHeader: `0x${string}`;
  payloadHash: `0x${string}`;
  attempts?: number;
  intervalMs?: number;
}) => {
  let lastState: bigint | undefined;
  for (let i = 0; i < attempts; i++) {
    const stateRaw = await client.readContract({
      address: receiveLibView,
      abi: RECEIVE_ULN_VIEW_ABI,
      functionName: "verifiable",
      args: [packetHeader, payloadHash],
    });
    lastState = BigInt(stateRaw);

    if (lastState === VERIFICATION_STATE.Verifiable || lastState === VERIFICATION_STATE.Verified) {
      return lastState;
    }
    if (lastState === VERIFICATION_STATE.NotInitializable) {
      throw new Error("LayerZero receive state is not initializable. Check nonce ordering before processing this message.");
    }

    await new Promise(resolve => setTimeout(resolve, intervalMs));
  }

  throw new Error(
    `LayerZero verification is still pending after ${attempts} checks. ` +
      `This usually means the verify transaction did not match the active DVN config or Base RPC state has not caught up. ` +
      `Last state: ${lastState?.toString() ?? "unknown"}.`,
  );
};

export type ProcessReceiveParams = {
  sourceChainId: 84532 | 296;
  destinationChainId: 84532 | 296;
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

export const useProcessReceive = (chainId: 296 | 84532 = 296) => {
  const { address } = useAccount();
  const destinationClient = usePublicClient({ chainId });
  const dvn = useScaffoldWriteContract("SimpleDVNMock", chainId);
  const executor = useScaffoldWriteContract("SimpleExecutorMock", chainId);
  const dvnReceiveUlnRead = useScaffoldReadContract({
    contractName: "SimpleDVNMock",
    chainId,
    functionName: "receiveUln",
  });
  const receiveUlnAddress = dvnReceiveUlnRead.data as `0x${string}` | undefined;
  const ownerRead = useScaffoldReadContract({
    contractName: "SimpleDVNMock",
    chainId,
    functionName: "owner",
  });

  const owner = ownerRead.data as `0x${string}` | undefined;
  const isOwner = Boolean(owner && address && owner.toLowerCase() === address.toLowerCase());

  const status = useMemo(() => {
    if (dvn.isPending || executor.isPending) return "pending";
    if (dvn.error || executor.error) return "error";
    return "idle";
  }, [dvn.isPending, executor.isPending, dvn.error, executor.error]);

  const process = async (params: ProcessReceiveParams) => {
    if (!destinationClient) throw new Error("Destination client unavailable");
    if (!receiveUlnAddress) throw new Error("Missing ReceiveUln302 address from SimpleDVNMock");
    if (!executor.deployment?.address) throw new Error("Missing SimpleExecutorMock deployment");
    if (!isOwner) throw new Error("Connected wallet is not owner of SimpleDVNMock");

    const sharedDecimalsRaw = await safeReadContract(destinationClient, {
      address: params.dstOftAddress,
      abi: OFT_INFO_ABI,
      functionName: "sharedDecimals",
    });
    const sharedDecimals = Number(sharedDecimalsRaw);

    const tokenAddress = (await safeReadContract(destinationClient, {
      address: params.dstOftAddress,
      abi: OFT_INFO_ABI,
      functionName: "token",
    })) as `0x${string}`;

    let localDecimals = sharedDecimals;
    if (tokenAddress.toLowerCase() === "0x0000000000000000000000000000000000000000") {
      localDecimals = 18;
    } else {
      const localDecimalsRaw = await safeReadContract(destinationClient, {
        address: tokenAddress,
        abi: ERC20_DECIMALS_ABI,
        functionName: "decimals",
      });
      localDecimals = Number(localDecimalsRaw);
    }

    const srcOappB32 = addressToBytes32(params.srcOftAddress);
    const dstOappB32 = addressToBytes32(params.dstOftAddress);

    // Validate nonce before executing to prevent reverts
    const endpointAddress = (await safeReadContract(destinationClient, {
      address: params.dstOftAddress,
      abi: OFT_INFO_ABI,
      functionName: "endpoint",
    })) as `0x${string}`;

    const currentInboundNonce = await safeReadContract(destinationClient, {
      address: endpointAddress,
      abi: ENDPOINT_ABI,
      functionName: "inboundNonce",
      args: [params.dstOftAddress, params.srcEid, srcOappB32],
    });

    const nextNonceToExecute = BigInt(currentInboundNonce) + 1n;
    if (params.nonce < nextNonceToExecute) {
      throw new Error(
        `Nonce ${params.nonce} has already been executed. The next nonce to process is ${nextNonceToExecute}.`,
      );
    }
    if (params.nonce > nextNonceToExecute) {
      throw new Error(
        `Nonce ${params.nonce} is ahead of sequence. You must process nonce ${nextNonceToExecute} first. ` +
          `Messages must be processed in order.`,
      );
    }

    const message = buildOftMessage({
      to: params.recipient,
      amount: params.amount,
      sharedDecimals,
      composeMsg: params.composeMsg,
      composeFrom: params.composeFrom,
    });
    const guid = generateGuid({
      nonce: params.nonce,
      srcEid: params.srcEid,
      srcOappB32,
      dstEid: params.dstEid,
      dstOappB32,
    });
    const packetHeader = encodePacked(
      ["uint8", "uint64", "uint32", "bytes32", "uint32", "bytes32"],
      [1, params.nonce, params.srcEid, srcOappB32, params.dstEid, dstOappB32],
    );
    const payloadHash = keccak256(encodePacked(["bytes32", "bytes"], [guid, message]));

    // Match CLI simple-workers defaults. For strategy vault compose operations,
    // the outer tx needs enough gas to forward composeGas (up to 12M) plus overhead.
    // Hedera max is 15M, so use that to give maximum headroom for SaucerSwap swaps.
    const HEDERA_GAS_LIMIT = 15_000_000n;

    const verifyHash = await dvn.writeContractAsync(
      "verify",
      [message, params.nonce, params.srcEid, srcOappB32, params.dstEid, params.dstOftAddress],
      { gas: HEDERA_GAS_LIMIT },
    );
    await waitForHederaReceipt(destinationClient, verifyHash as `0x${string}`);

    const receiveLibView = (await destinationClient.readContract({
      address: executor.deployment.address as `0x${string}`,
      abi: EXECUTOR_VIEW_ABI,
      functionName: "receiveLibToView",
      args: [receiveUlnAddress],
    })) as `0x${string}`;
    if (receiveLibView === "0x0000000000000000000000000000000000000000") {
      throw new Error("SimpleExecutorMock has no ReceiveUln302View configured for this receive library.");
    }
    await waitForVerificationState({
      client: destinationClient,
      receiveLibView,
      packetHeader,
      payloadHash,
    });

    const lzReceiveParam = {
      origin: {
        srcEid: params.srcEid,
        sender: srcOappB32,
        nonce: params.nonce,
      },
      receiver: params.dstOftAddress,
      guid,
      message,
      extraData: "0x",
      gas: 3_000_000n,
      value: 0n,
    };

    const commitExecuteHash = await executor.writeContractAsync(
      "commitAndExecute",
      [receiveUlnAddress, lzReceiveParam, []],
      { gas: HEDERA_GAS_LIMIT },
    );
    await waitForHederaReceipt(destinationClient, commitExecuteHash as `0x${string}`);

    let composeHash: `0x${string}` | undefined;
    let composeWarning: string | undefined;
    if (params.composeMsg && params.composeFrom && params.composeTo) {
      const amountReceivedLD = computeAmountReceivedLD({
        amount: params.amount,
        sharedDecimals,
        localDecimals,
      });
      const composePayload = buildComposePayload({
        nonce: params.nonce,
        srcEid: params.srcEid,
        amountReceivedLD,
        composeFrom: params.composeFrom,
        composeMsg: params.composeMsg,
      });
      // Strategy vault compose: vault deposit + strategy auto-invest (2 SaucerSwap swaps).
      // Floor Hedera compose gas: older UI sends embedded 395000 when compose gas was wrongly tied to second-hop dstEid.
      const MIN_HEDERA_COMPOSE_GAS = 12_000_000n;
      const effectiveComposeGas =
        params.composeGas != null && params.composeGas > MIN_HEDERA_COMPOSE_GAS
          ? params.composeGas
          : MIN_HEDERA_COMPOSE_GAS;
      try {
        composeHash = (await executor.writeContractAsync(
          "compose302",
          [
            params.dstOftAddress,
            params.composeTo,
            guid,
            0,
            composePayload,
            "0x",
            effectiveComposeGas,
          ],
          { value: params.composeValue ?? 0n, gas: HEDERA_GAS_LIMIT },
        )) as `0x${string}`;
        await waitForHederaReceipt(destinationClient, composeHash);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        // Preserve the first submitted compose tx (e.g. reverted) before retry overwrites `composeHash`.
        const firstComposeTxHash = composeHash;
        // Retry once with maximum compose gas budget for Hedera.
        try {
          const retryComposeGas = 14_000_000n; // Near Hedera's 15M limit
          composeHash = (await executor.writeContractAsync(
            "compose302",
            [
              params.dstOftAddress,
              params.composeTo,
              guid,
              0,
              composePayload,
              "0x",
              retryComposeGas,
            ],
            { value: params.composeValue ?? 0n, gas: HEDERA_GAS_LIMIT },
          )) as `0x${string}`;
          await waitForHederaReceipt(destinationClient, composeHash);
          composeWarning =
            "compose302 needed a higher gas budget on Hedera; retried successfully with elevated gas.";
          return {
            verifyHash,
            commitExecuteHash,
            composeHash,
            guid,
            debug: {
              srcEid: params.srcEid,
              dstEid: params.dstEid,
              nonce: params.nonce.toString(),
              srcOftAddress: params.srcOftAddress,
              dstOftAddress: params.dstOftAddress,
              receiver: lzReceiveParam.receiver,
              message,
              decodedMessage: decodeOftMessage(message as `0x${string}`),
              composeWarning,
            },
          };
        } catch (retryErr) {
          const retryMsg = retryErr instanceof Error ? retryErr.message : String(retryErr);
          const latestHash = composeHash ?? firstComposeTxHash;
          const isLzSendReentrant =
            msg.includes("LZ_SendReentrancy") ||
            msg.includes("0xee120b09") ||
            retryMsg.includes("LZ_SendReentrancy") ||
            retryMsg.includes("0xee120b09");
          const dualHashNote =
            firstComposeTxHash && composeHash && firstComposeTxHash !== composeHash
              ? ` First compose302 tx (HashScan): ${firstComposeTxHash}. Latest attempt: ${composeHash}.`
              : latestHash
                ? ` Open this compose302 transaction on HashScan: ${latestHash}.`
                : ` No compose302 transaction hash was returned (wallet rejected or the transaction was not broadcast).`;
          const noHashLzNote =
            " No standalone compose302 tx on HashScan is normal here: LZ_SendReentrancy stops the nested second send — " +
            "wagmi/simulation often reverts before a tx is broadcast, so there is nothing to open as a compose hash. " +
            "Confirm the deposit using your verify + commit txs above.";
          const dualHashNoteLz =
            firstComposeTxHash && composeHash && firstComposeTxHash !== composeHash
              ? ` First compose302 (HashScan): ${firstComposeTxHash}. Retry: ${composeHash}.`
              : latestHash
                ? ` Open compose302 on HashScan: ${latestHash}.`
                : noHashLzNote;

          if (isLzSendReentrant) {
            composeWarning =
              "Second-hop compose was blocked by LayerZero reentrancy guard (LZ_SendReentrancy). " +
              "First-hop lzReceive settled on Hedera; the embedded onward send inside compose was intentionally blocked. " +
              "Funds / vault position depend on composer strategy wiring — check balances and Vault UI; do not assume failure because no compose302 hash exists." +
              dualHashNoteLz;
          } else {
            composeWarning =
              "compose302 did not complete successfully (vault deposit / strategy on Hedera)." +
              dualHashNote +
              (retryMsg && retryMsg !== msg ? ` Initial error: ${msg}. Retry error: ${retryMsg}` : ` Details: ${msg}`);
          }
        }
      }
    }

    return {
      verifyHash,
      commitExecuteHash,
      composeHash,
      guid,
      debug: {
        srcEid: params.srcEid,
        dstEid: params.dstEid,
        nonce: params.nonce.toString(),
        srcOftAddress: params.srcOftAddress,
        dstOftAddress: params.dstOftAddress,
        receiver: lzReceiveParam.receiver,
        message,
        decodedMessage: decodeOftMessage(message as `0x${string}`),
        composeWarning,
      },
    };
  };

  const getNextNonce = async (srcOftAddress: `0x${string}`, dstOftAddress: `0x${string}`, srcEid: number) => {
    if (!destinationClient) throw new Error("Destination client unavailable");

    const srcOappB32 = addressToBytes32(srcOftAddress);
    const endpointAddress = (await safeReadContract(destinationClient, {
      address: dstOftAddress,
      abi: OFT_INFO_ABI,
      functionName: "endpoint",
    })) as `0x${string}`;

    const currentInboundNonce = await safeReadContract(destinationClient, {
      address: endpointAddress,
      abi: ENDPOINT_ABI,
      functionName: "inboundNonce",
      args: [dstOftAddress, srcEid, srcOappB32],
    });

    return BigInt(currentInboundNonce) + 1n;
  };

  return {
    process,
    getNextNonce,
    status,
    isOwner,
    owner,
    sourceEid: chainId === 296 ? BASE_EID : HEDERA_EID,
    destinationEid: chainId === 296 ? HEDERA_EID : BASE_EID,
    isPending: dvn.isPending || executor.isPending,
    error: dvn.error || executor.error,
  };
};

/**
 * Hook to fetch all pending messages from source chain and process them in order
 */
export const usePendingMessages = (route: { fromChain: "base" | "hedera"; toChain: "base" | "hedera" } = { fromChain: "base", toChain: "hedera" }) => {
  const baseClient = usePublicClient({ chainId: BASE_CHAIN_ID });
  const hederaClient = usePublicClient({ chainId: HEDERA_CHAIN_ID });
  const baseOft = useDeployedContractInfo("MyNativeOFTAdapter", BASE_CHAIN_ID);
  const hederaOft = useDeployedContractInfo("MyHTSConnector", HEDERA_CHAIN_ID);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const sourceClient = route.fromChain === "base" ? baseClient : hederaClient;
  const destinationClient = route.toChain === "base" ? baseClient : hederaClient;
  const sourceOft = route.fromChain === "base" ? baseOft : hederaOft;
  const destinationOft = route.toChain === "base" ? baseOft : hederaOft;
  const srcEid = route.fromChain === "base" ? BASE_EID : HEDERA_EID;
  const dstEid = route.toChain === "base" ? BASE_EID : HEDERA_EID;

  const fetchPendingMessages = async (): Promise<{
    pendingMessages: PendingMessage[];
    nextNonce: bigint;
    latestOutboundNonce: bigint;
    pendingCount: number;
  }> => {
    if (!sourceClient || !destinationClient) throw new Error("Clients unavailable");
    if (!sourceOft?.address || !destinationOft?.address) throw new Error("OFT deployments not found");

    setIsLoading(true);
    setError(null);

    try {
      const srcOappB32 = addressToBytes32(sourceOft.address);
      const dstOappB32 = addressToBytes32(destinationOft.address);

      // Use safe wrapper for destination calls to handle Hedera decoding issues
      const endpointAddress = (await safeReadContract(destinationClient, {
        address: destinationOft.address,
        abi: OFT_INFO_ABI,
        functionName: "endpoint",
      })) as `0x${string}`;

      const currentInboundNonce = await safeReadContract(destinationClient, {
        address: endpointAddress,
        abi: ENDPOINT_ABI,
        functionName: "inboundNonce",
        args: [destinationOft.address, srcEid, srcOappB32],
      });
      const nextNonce = BigInt(currentInboundNonce) + 1n;

      const sourceEndpoint = (await sourceClient.readContract({
        address: sourceOft.address,
        abi: OFT_INFO_ABI,
        functionName: "endpoint",
      })) as `0x${string}`;

      const latestOutboundNonce = await sourceClient.readContract({
        address: sourceEndpoint,
        abi: ENDPOINT_ABI,
        functionName: "outboundNonce",
        args: [sourceOft.address, dstEid, dstOappB32],
      });

      const pendingCount = Number(BigInt(latestOutboundNonce) - BigInt(currentInboundNonce));

      if (pendingCount <= 0) {
        return { pendingMessages: [], nextNonce, latestOutboundNonce: BigInt(latestOutboundNonce), pendingCount: 0 };
      }

      const sharedDecimalsRaw = await safeReadContract(destinationClient, {
        address: destinationOft.address,
        abi: OFT_INFO_ABI,
        functionName: "sharedDecimals",
      });
      const sharedDecimals = Number(sharedDecimalsRaw);

      const currentBlock = await sourceClient.getBlockNumber();
      
      // Base Sepolia RPC limits eth_getLogs to 10,000 blocks per request
      // Paginate through blocks to find all OFTSent events
      const MAX_BLOCK_RANGE = 9900n;
      const TOTAL_BLOCKS_TO_SEARCH = 50000n;
      const startBlock = currentBlock > TOTAL_BLOCKS_TO_SEARCH ? currentBlock - TOTAL_BLOCKS_TO_SEARCH : 0n;
      
      const oftSentLogs: Awaited<ReturnType<typeof sourceClient.getLogs<typeof OFT_SENT_EVENT>>>  = [];
      
      for (let fromBlock = startBlock; fromBlock < currentBlock; fromBlock += MAX_BLOCK_RANGE) {
        const toBlock = fromBlock + MAX_BLOCK_RANGE > currentBlock ? currentBlock : fromBlock + MAX_BLOCK_RANGE;
        const logs = await sourceClient.getLogs({
          address: sourceOft.address,
          event: OFT_SENT_EVENT,
          fromBlock,
          toBlock,
        });
        oftSentLogs.push(...logs);
      }

      const pendingMessages: PendingMessage[] = [];

      for (const log of oftSentLogs) {
        const amountReceivedLD = log.args.amountReceivedLD;
        const sender = log.args.fromAddress;
        const guid = log.args.guid;

        if (!amountReceivedLD || !sender || !guid) continue;

        const amountSD = amountReceivedLD / (10n ** BigInt(18 - sharedDecimals));

        for (let n = nextNonce; n <= BigInt(latestOutboundNonce); n++) {
          const expectedGuid = generateGuid({
            nonce: n,
            srcEid,
            srcOappB32,
            dstEid,
            dstOappB32,
          });

          if (expectedGuid.toLowerCase() === guid.toLowerCase()) {
            pendingMessages.push({
              nonce: n,
              guid: guid as `0x${string}`,
              recipient: sender as `0x${string}`,
              amountSD,
              amountLD: formatUnits(amountReceivedLD, 18),
              sender: sender as `0x${string}`,
              blockNumber: log.blockNumber,
            });
            break;
          }
        }
      }

      pendingMessages.sort((a, b) => (a.nonce < b.nonce ? -1 : a.nonce > b.nonce ? 1 : 0));

      return {
        pendingMessages,
        nextNonce,
        latestOutboundNonce: BigInt(latestOutboundNonce),
        pendingCount,
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to fetch pending messages";
      setError(msg);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  return {
    fetchPendingMessages,
    isLoading,
    error,
    srcOftAddress: sourceOft?.address as `0x${string}` | undefined,
    dstOftAddress: destinationOft?.address as `0x${string}` | undefined,
  };
};
