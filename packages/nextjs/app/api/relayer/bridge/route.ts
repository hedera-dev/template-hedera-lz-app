import { NextRequest, NextResponse } from "next/server";
import { baseSepolia } from "viem/chains";
import {
  createPublicClient,
  createWalletClient,
  encodePacked,
  http,
  keccak256,
  parseEther,
  parseUnits,
  type Address,
  type PublicClient,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { deployedContracts } from "~~/contracts/deployedContracts";
import { hederaTestnet, scaffoldConfig } from "~~/scaffold.config";

export const runtime = "nodejs";

const BASE_EID = 40245;
const HEDERA_EID = 40285;
const BASE_CHAIN_ID = 84532;
const HEDERA_CHAIN_ID = 296;
const HEDERA_GAS_LIMIT = 15_000_000n;

const VERIFICATION_STATE = {
  Verifying: 0n,
  Verifiable: 1n,
  Verified: 2n,
  NotInitializable: 3n,
} as const;

const OFT_INFO_ABI = [
  { inputs: [], name: "sharedDecimals", outputs: [{ type: "uint8" }], stateMutability: "view", type: "function" },
  { inputs: [], name: "token", outputs: [{ type: "address" }], stateMutability: "view", type: "function" },
  { inputs: [], name: "endpoint", outputs: [{ type: "address" }], stateMutability: "view", type: "function" },
] as const;

const ERC20_DECIMALS_ABI = [
  { inputs: [], name: "decimals", outputs: [{ type: "uint8" }], stateMutability: "view", type: "function" },
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

const SIMPLE_DVN_ABI = [
  {
    inputs: [],
    name: "receiveUln",
    outputs: [{ internalType: "contract IReceiveUlnE2", name: "", type: "address" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      { internalType: "bytes", name: "_message", type: "bytes" },
      { internalType: "uint64", name: "_nonce", type: "uint64" },
      { internalType: "uint32", name: "_srcEid", type: "uint32" },
      { internalType: "bytes32", name: "_remoteOApp", type: "bytes32" },
      { internalType: "uint32", name: "_dstEid", type: "uint32" },
      { internalType: "address", name: "_localOApp", type: "address" },
    ],
    name: "verify",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
] as const;

const SIMPLE_EXECUTOR_ABI = [
  {
    inputs: [
      { internalType: "address", name: "_receiveLib", type: "address" },
      {
        components: [
          {
            components: [
              { internalType: "uint32", name: "srcEid", type: "uint32" },
              { internalType: "bytes32", name: "sender", type: "bytes32" },
              { internalType: "uint64", name: "nonce", type: "uint64" },
            ],
            internalType: "struct Origin",
            name: "origin",
            type: "tuple",
          },
          { internalType: "address", name: "receiver", type: "address" },
          { internalType: "bytes32", name: "guid", type: "bytes32" },
          { internalType: "bytes", name: "message", type: "bytes" },
          { internalType: "bytes", name: "extraData", type: "bytes" },
          { internalType: "uint256", name: "gas", type: "uint256" },
          { internalType: "uint256", name: "value", type: "uint256" },
        ],
        internalType: "struct SimpleExecutorMock.LzReceiveParam",
        name: "_lzReceiveParam",
        type: "tuple",
      },
      {
        components: [
          { internalType: "address", name: "_receiver", type: "address" },
          { internalType: "uint256", name: "_amount", type: "uint256" },
        ],
        internalType: "struct SimpleExecutorMock.NativeDropParam[]",
        name: "_nativeDropParams",
        type: "tuple[]",
      },
    ],
    name: "commitAndExecute",
    outputs: [],
    stateMutability: "payable",
    type: "function",
  },
  {
    inputs: [
      { internalType: "address", name: "_from", type: "address" },
      { internalType: "address", name: "_to", type: "address" },
      { internalType: "bytes32", name: "_guid", type: "bytes32" },
      { internalType: "uint16", name: "_index", type: "uint16" },
      { internalType: "bytes", name: "_message", type: "bytes" },
      { internalType: "bytes", name: "_extraData", type: "bytes" },
      { internalType: "uint256", name: "_gasLimit", type: "uint256" },
    ],
    name: "compose302",
    outputs: [],
    stateMutability: "payable",
    type: "function",
  },
] as const;

type RelayerFlow = "bridge" | "ovault" | "ovault_redeem";

type RelayerBridgeRequest = {
  sourceTxHash: `0x${string}`;
  srcEid: number;
  dstEid: number;
  nonce: string;
  amount: string;
  recipient: Address;
  srcOftAddress: Address;
  dstOftAddress: Address;
  composeMsg?: `0x${string}`;
  composeFrom?: Address;
  composeTo?: Address;
  composeGas?: string;
  composeValue?: string;
  /** bridge = simple OFT; ovault = Base->Hedera deposit; ovault_redeem = Hedera->Base redeem */
  flow?: RelayerFlow;
};

const addressToBytes32 = (address: Address): `0x${string}` => {
  return `0x${address.slice(2).padStart(64, "0")}` as `0x${string}`;
};

const buildOftMessage = ({
  to,
  amount,
  sharedDecimals,
  composeMsg,
  composeFrom,
}: {
  to: Address;
  amount: string;
  sharedDecimals: number;
  composeMsg?: `0x${string}`;
  composeFrom?: Address;
}) => {
  const toB32 = addressToBytes32(to);
  const amountSD = parseUnits(amount, sharedDecimals);

  if (composeMsg && composeFrom) {
    const composeFromB32 = addressToBytes32(composeFrom);
    return encodePacked(["bytes32", "uint64", "bytes32", "bytes"], [toB32, amountSD, composeFromB32, composeMsg]);
  }
  return encodePacked(["bytes32", "uint64"], [toB32, amountSD]);
};

const generateGuid = ({
  nonce,
  srcEid,
  srcOappB32,
  dstEid,
  dstOappB32,
}: {
  nonce: bigint;
  srcEid: number;
  srcOappB32: `0x${string}`;
  dstEid: number;
  dstOappB32: `0x${string}`;
}) => {
  return keccak256(
    encodePacked(["uint64", "uint32", "bytes32", "uint32", "bytes32"], [nonce, srcEid, srcOappB32, dstEid, dstOappB32]),
  );
};

type RpcChainId = keyof typeof scaffoldConfig.rpcOverrides;

async function waitForReceipt(publicClient: PublicClient, hash: `0x${string}`): Promise<void> {
  for (let i = 0; i < 40; i++) {
    try {
      const receipt = await publicClient.waitForTransactionReceipt({ hash, timeout: 15_000 });
      if (receipt.status !== "success") {
        throw new Error(`Transaction reverted: ${hash}`);
      }
      return;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      const decodeError = msg.includes("Position") && msg.includes("out of bounds");
      const timeoutError = msg.toLowerCase().includes("timed out");
      if (!decodeError && !timeoutError) {
        throw err;
      }
      const rawReceipt = (await publicClient.request({
        method: "eth_getTransactionReceipt",
        params: [hash],
      })) as { status?: string } | null;
      if (rawReceipt?.status === "0x1") return;
      if (rawReceipt?.status === "0x0") {
        throw new Error(`Transaction reverted: ${hash}`);
      }
    }
  }
  throw new Error(`Timeout waiting for receipt: ${hash}`);
}

async function waitForVerificationState({
  publicClient,
  receiveLibView,
  packetHeader,
  payloadHash,
  attempts = 20,
  intervalMs = 1500,
}: {
  publicClient: PublicClient;
  receiveLibView: Address;
  packetHeader: `0x${string}`;
  payloadHash: `0x${string}`;
  attempts?: number;
  intervalMs?: number;
}) {
  let lastState: bigint | undefined;
  for (let i = 0; i < attempts; i++) {
    const stateRaw = await publicClient.readContract({
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
      throw new Error(
        "LayerZero receive state is not initializable. Check nonce ordering before processing this message.",
      );
    }

    await new Promise(resolve => setTimeout(resolve, intervalMs));
  }

  throw new Error(
    `LayerZero verification is still pending after ${attempts} checks. Last state: ${lastState?.toString() ?? "unknown"}.`,
  );
}

function resolveRouteContracts(srcEid: number, dstEid: number) {
  const srcChainId = srcEid === BASE_EID ? BASE_CHAIN_ID : HEDERA_CHAIN_ID;
  const dstChainId = dstEid === BASE_EID ? BASE_CHAIN_ID : HEDERA_CHAIN_ID;
  const srcName = srcEid === BASE_EID ? "MyNativeOFTAdapter" : "MyHTSConnector";
  const dstName = dstEid === BASE_EID ? "MyNativeOFTAdapter" : "MyHTSConnector";
  return { srcChainId, dstChainId, srcName, dstName };
}

function getAllowedComposerAddresses(): Address[] {
  const strategy = deployedContracts[HEDERA_CHAIN_ID]?.MyOVaultComposerStrategy?.address;
  const basic = deployedContracts[HEDERA_CHAIN_ID]?.MyOVaultComposer?.address;
  const list: Address[] = [];
  if (strategy) list.push(strategy as Address);
  if (basic) list.push(basic as Address);
  return list;
}

function validateOvaultPayload(body: RelayerBridgeRequest): string | null {
  if (body.srcEid !== BASE_EID || body.dstEid !== HEDERA_EID) {
    return "ovault flow only supports Base → Hedera";
  }
  const allowedComposers = getAllowedComposerAddresses();
  if (allowedComposers.length === 0) {
    return "Missing MyOVaultComposerStrategy / MyOVaultComposer deployment on Hedera";
  }
  const recipientOk = allowedComposers.some(c => c.toLowerCase() === body.recipient.toLowerCase());
  if (!recipientOk) {
    return "recipient must be a deployed OVault composer on Hedera";
  }
  if (!body.composeTo || body.composeTo.toLowerCase() !== body.recipient.toLowerCase()) {
    return "composeTo must match recipient (composer address)";
  }
  if (!body.composeFrom) {
    return "composeFrom is required for ovault";
  }
  if (!body.composeMsg || body.composeMsg === "0x" || body.composeMsg.length <= 2) {
    return "composeMsg is required for ovault";
  }
  return null;
}

function validateOvaultRedeemPayload(body: RelayerBridgeRequest): string | null {
  if (body.srcEid !== HEDERA_EID || body.dstEid !== BASE_EID) {
    return "ovault_redeem flow only supports Hedera → Base";
  }
  if (body.composeMsg || body.composeFrom || body.composeTo) {
    return "ovault_redeem must not include compose payload fields";
  }
  return null;
}

function jsonError(status: number, code: string, message: string) {
  return NextResponse.json({ status: "failed" as const, code, error: message }, { status });
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as RelayerBridgeRequest;
    const flow: RelayerFlow =
      body.flow === "ovault" || body.flow === "ovault_redeem" ? body.flow : "bridge";
    const {
      sourceTxHash,
      srcEid,
      dstEid,
      nonce,
      amount,
      recipient,
      srcOftAddress,
      dstOftAddress,
      composeMsg,
      composeFrom,
      composeTo,
      composeGas,
      composeValue,
    } = body;

    if (!sourceTxHash || !srcEid || !dstEid || !nonce || !amount || !recipient || !srcOftAddress || !dstOftAddress) {
      return jsonError(400, "missing_fields", "Missing required fields");
    }
    if (srcEid === dstEid) {
      return jsonError(400, "unsupported_route", "Relayer only supports cross-chain routes");
    }
    if (!((srcEid === BASE_EID && dstEid === HEDERA_EID) || (srcEid === HEDERA_EID && dstEid === BASE_EID))) {
      return jsonError(400, "unsupported_route", "Unsupported route");
    }

    const maxBridge = parseEther(process.env.RELAYER_MAX_BRIDGE_AMOUNT_ETH ?? "1");
    const maxVault = parseEther(
      process.env.RELAYER_MAX_VAULT_AMOUNT_ETH ?? process.env.RELAYER_MAX_BRIDGE_AMOUNT_ETH ?? "1",
    );
    const maxVaultRedeem = parseEther(
      process.env.RELAYER_MAX_VAULT_REDEEM_AMOUNT_ETH ??
        process.env.RELAYER_MAX_VAULT_AMOUNT_ETH ??
        process.env.RELAYER_MAX_BRIDGE_AMOUNT_ETH ??
        "1",
    );
    const maxAmount = flow === "ovault" ? maxVault : flow === "ovault_redeem" ? maxVaultRedeem : maxBridge;
    const amountWei = parseEther(amount);
    if (amountWei <= 0n || amountWei > maxAmount) {
      return jsonError(
        400,
        "amount_out_of_bounds",
        `Amount out of bounds. Max is ${(Number(maxAmount) / 1e18).toString()} ETH-equivalent`,
      );
    }

    if (flow === "ovault") {
      const ovaultErr = validateOvaultPayload(body);
      if (ovaultErr) {
        return jsonError(400, "allowlist_mismatch", ovaultErr);
      }
    }
    if (flow === "ovault_redeem") {
      const ovaultRedeemErr = validateOvaultRedeemPayload(body);
      if (ovaultRedeemErr) {
        return jsonError(400, "allowlist_mismatch", ovaultRedeemErr);
      }
    }

    const privateKeyRaw = process.env.RELAYER_PRIVATE_KEY;
    if (!privateKeyRaw) {
      return jsonError(500, "config", "RELAYER_PRIVATE_KEY is not configured");
    }
    const privateKey = (privateKeyRaw.startsWith("0x") ? privateKeyRaw : `0x${privateKeyRaw}`) as `0x${string}`;
    const account = privateKeyToAccount(privateKey);

    const { srcChainId, dstChainId, srcName, dstName } = resolveRouteContracts(srcEid, dstEid);
    const expectedSrc = deployedContracts[srcChainId]?.[srcName]?.address;
    const expectedDst = deployedContracts[dstChainId]?.[dstName]?.address;
    if (!expectedSrc || !expectedDst) {
      return jsonError(500, "config", "Missing OFT deployments for route");
    }
    if (expectedSrc.toLowerCase() !== srcOftAddress.toLowerCase() || expectedDst.toLowerCase() !== dstOftAddress.toLowerCase()) {
      return jsonError(400, "allowlist_mismatch", "OFT address mismatch (blocked by allowlist)");
    }

    const dvnAddress = deployedContracts[dstChainId as keyof typeof deployedContracts]?.SimpleDVNMock?.address as
      | Address
      | undefined;
    const executorAddress = deployedContracts[dstChainId as keyof typeof deployedContracts]?.SimpleExecutorMock
      ?.address as Address | undefined;
    if (!dvnAddress || !executorAddress) {
      return jsonError(500, "config", "Missing mock worker deployments on destination chain");
    }

    const dstChain = dstChainId === HEDERA_CHAIN_ID ? hederaTestnet : baseSepolia;
    const dstRpc = scaffoldConfig.rpcOverrides[dstChainId as RpcChainId];
    const publicClient = createPublicClient({
      chain: dstChain,
      transport: http(dstRpc),
    });
    const walletClient = createWalletClient({
      account,
      chain: dstChain,
      transport: http(dstRpc),
    });
    // viem's PublicClient is chain-parameterized; Hedera vs Base clients are not assignable to each other.
    const destinationPublicClient = publicClient as unknown as PublicClient;

    const nonceBigInt = BigInt(nonce);
    const sharedDecimalsRaw = await publicClient.readContract({
      address: dstOftAddress,
      abi: OFT_INFO_ABI,
      functionName: "sharedDecimals",
    });
    const sharedDecimals = Number(sharedDecimalsRaw);

    const tokenAddress = (await publicClient.readContract({
      address: dstOftAddress,
      abi: OFT_INFO_ABI,
      functionName: "token",
    })) as Address;
    const localDecimals =
      tokenAddress.toLowerCase() === "0x0000000000000000000000000000000000000000"
        ? 18
        : Number(
            await publicClient.readContract({
              address: tokenAddress,
              abi: ERC20_DECIMALS_ABI,
              functionName: "decimals",
            }),
          );

    const endpointAddress = (await publicClient.readContract({
      address: dstOftAddress,
      abi: OFT_INFO_ABI,
      functionName: "endpoint",
    })) as Address;

    const srcOappB32 = addressToBytes32(srcOftAddress);
    const dstOappB32 = addressToBytes32(dstOftAddress);

    const currentInboundNonce = await publicClient.readContract({
      address: endpointAddress,
      abi: ENDPOINT_ABI,
      functionName: "inboundNonce",
      args: [dstOftAddress, srcEid, srcOappB32],
    });
    const nextNonce = BigInt(currentInboundNonce) + 1n;
    if (nonceBigInt !== nextNonce) {
      return jsonError(
        409,
        "nonce_mismatch",
        `Nonce mismatch. Expected next nonce ${nextNonce.toString()}, got ${nonceBigInt.toString()}`,
      );
    }

    const message = buildOftMessage({
      to: recipient,
      amount,
      sharedDecimals,
      composeMsg:
        flow === "ovault"
          ? composeMsg
          : flow === "bridge" && composeMsg && composeFrom
            ? composeMsg
            : undefined,
      composeFrom:
        flow === "ovault"
          ? composeFrom
          : flow === "bridge" && composeMsg && composeFrom
            ? composeFrom
            : undefined,
    });
    const guid = generateGuid({
      nonce: nonceBigInt,
      srcEid,
      srcOappB32,
      dstEid,
      dstOappB32,
    });

    const packetHeader = encodePacked(
      ["uint8", "uint64", "uint32", "bytes32", "uint32", "bytes32"],
      [1, nonceBigInt, srcEid, srcOappB32, dstEid, dstOappB32],
    );
    const payloadHash = keccak256(encodePacked(["bytes32", "bytes"], [guid, message]));

    const verifyHash = await walletClient.writeContract({
      address: dvnAddress,
      abi: SIMPLE_DVN_ABI,
      functionName: "verify",
      args: [message, nonceBigInt, srcEid, srcOappB32, dstEid, dstOftAddress],
      gas: HEDERA_GAS_LIMIT,
    });
    await waitForReceipt(destinationPublicClient, verifyHash);

    const receiveUln = (await publicClient.readContract({
      address: dvnAddress,
      abi: SIMPLE_DVN_ABI,
      functionName: "receiveUln",
    })) as Address;

    const receiveLibView = (await publicClient.readContract({
      address: executorAddress,
      abi: EXECUTOR_VIEW_ABI,
      functionName: "receiveLibToView",
      args: [receiveUln],
    })) as Address;
    if (receiveLibView === "0x0000000000000000000000000000000000000000") {
      return jsonError(500, "config", "SimpleExecutorMock has no ReceiveUln302View configured for this receive library.");
    }

    await waitForVerificationState({
      publicClient: destinationPublicClient,
      receiveLibView,
      packetHeader,
      payloadHash,
    });

    const commitExecuteHash = await walletClient.writeContract({
      address: executorAddress,
      abi: SIMPLE_EXECUTOR_ABI,
      functionName: "commitAndExecute",
      args: [
        receiveUln,
        {
          origin: {
            srcEid,
            sender: srcOappB32,
            nonce: nonceBigInt,
          },
          receiver: dstOftAddress,
          guid,
          message,
          extraData: "0x",
          gas: 3_000_000n,
          value: 0n,
        },
        [],
      ],
      gas: HEDERA_GAS_LIMIT,
    });
    await waitForReceipt(destinationPublicClient, commitExecuteHash);

    let composeHash: `0x${string}` | undefined;
    let composeWarning: string | undefined;
    if (composeMsg && composeFrom && composeTo) {
      const amountSD = parseUnits(amount, sharedDecimals);
      const amountReceivedLD =
        localDecimals >= sharedDecimals
          ? amountSD * 10n ** BigInt(localDecimals - sharedDecimals)
          : amountSD / 10n ** BigInt(sharedDecimals - localDecimals);
      const composePayload = encodePacked(
        ["uint64", "uint32", "uint256", "bytes32", "bytes"],
        [nonceBigInt, srcEid, amountReceivedLD, addressToBytes32(composeFrom), composeMsg],
      );

      const MIN_HEDERA_COMPOSE_GAS = 12_000_000n;
      const requestedGas = composeGas ? BigInt(composeGas) : MIN_HEDERA_COMPOSE_GAS;
      const effectiveComposeGas = requestedGas > MIN_HEDERA_COMPOSE_GAS ? requestedGas : MIN_HEDERA_COMPOSE_GAS;
      const composeValueBn = composeValue ? BigInt(composeValue) : 0n;

      const runCompose = async (gas: bigint) => {
        return walletClient.writeContract({
          address: executorAddress,
          abi: SIMPLE_EXECUTOR_ABI,
          functionName: "compose302",
          args: [dstOftAddress, composeTo, guid, 0, composePayload, "0x", gas],
          value: composeValueBn,
          gas: HEDERA_GAS_LIMIT,
        });
      };

      try {
        composeHash = await runCompose(effectiveComposeGas);
        await waitForReceipt(destinationPublicClient, composeHash);
      } catch (firstErr) {
        const firstMsg = firstErr instanceof Error ? firstErr.message : String(firstErr);
        try {
          const retryGas = 14_000_000n;
          composeHash = await runCompose(retryGas);
          await waitForReceipt(destinationPublicClient, composeHash);
          composeWarning = `compose302 retried with higher gas (${retryGas}). Initial: ${firstMsg}`;
        } catch (retryErr) {
          const retryMsg = retryErr instanceof Error ? retryErr.message : String(retryErr);
          return jsonError(
            500,
            "compose_failed",
            `compose302 failed after retry. Initial: ${firstMsg}. Retry: ${retryMsg}`,
          );
        }
      }
    }

    return NextResponse.json({
      status: "completed",
      sourceTxHash,
      verifyHash,
      commitExecuteHash,
      composeHash,
      composeWarning,
      debug: {
        flow,
        srcEid,
        dstEid,
        nonce: nonceBigInt.toString(),
        srcOftAddress,
        dstOftAddress,
        recipient,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Relayer failed";
    return NextResponse.json({ status: "failed" as const, code: "relayer_error", error: message }, { status: 500 });
  }
}
