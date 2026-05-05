import { NextRequest, NextResponse } from "next/server";
import { baseSepolia } from "viem/chains";
import {
  createPublicClient,
  createWalletClient,
  encodePacked,
  http,
  keccak256,
  parseEther,
  type Address,
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
  const amountSD = parseEther(amount) / 10n ** BigInt(18 - sharedDecimals);

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

async function waitForReceipt(
  publicClient: ReturnType<typeof createPublicClient>,
  hash: `0x${string}`,
): Promise<void> {
  // Hedera RPC can fail to decode logs. Fall back to raw receipt status polling.
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

function resolveRouteContracts(srcEid: number, dstEid: number) {
  const srcChainId = srcEid === BASE_EID ? BASE_CHAIN_ID : HEDERA_CHAIN_ID;
  const dstChainId = dstEid === BASE_EID ? BASE_CHAIN_ID : HEDERA_CHAIN_ID;
  const srcName = srcEid === BASE_EID ? "MyNativeOFTAdapter" : "MyHTSConnector";
  const dstName = dstEid === BASE_EID ? "MyNativeOFTAdapter" : "MyHTSConnector";
  return { srcChainId, dstChainId, srcName, dstName };
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as RelayerBridgeRequest;
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
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }
    if (srcEid === dstEid) {
      return NextResponse.json({ error: "Relayer only supports cross-chain routes" }, { status: 400 });
    }
    if (!((srcEid === BASE_EID && dstEid === HEDERA_EID) || (srcEid === HEDERA_EID && dstEid === BASE_EID))) {
      return NextResponse.json({ error: "Unsupported route" }, { status: 400 });
    }

    const maxAmount = parseEther(process.env.RELAYER_MAX_BRIDGE_AMOUNT_ETH ?? "1");
    const amountWei = parseEther(amount);
    if (amountWei <= 0n || amountWei > maxAmount) {
      return NextResponse.json(
        { error: `Amount out of bounds. Max is ${(Number(maxAmount) / 1e18).toString()} ETH-equivalent` },
        { status: 400 },
      );
    }

    const privateKeyRaw = process.env.RELAYER_PRIVATE_KEY;
    if (!privateKeyRaw) {
      return NextResponse.json({ error: "RELAYER_PRIVATE_KEY is not configured" }, { status: 500 });
    }
    const privateKey = (privateKeyRaw.startsWith("0x") ? privateKeyRaw : `0x${privateKeyRaw}`) as `0x${string}`;
    const account = privateKeyToAccount(privateKey);

    const { srcChainId, dstChainId, srcName, dstName } = resolveRouteContracts(srcEid, dstEid);
    const expectedSrc = deployedContracts[srcChainId]?.[srcName]?.address;
    const expectedDst = deployedContracts[dstChainId]?.[dstName]?.address;
    if (!expectedSrc || !expectedDst) {
      return NextResponse.json({ error: "Missing OFT deployments for route" }, { status: 500 });
    }
    if (expectedSrc.toLowerCase() !== srcOftAddress.toLowerCase() || expectedDst.toLowerCase() !== dstOftAddress.toLowerCase()) {
      return NextResponse.json({ error: "OFT address mismatch (blocked by allowlist)" }, { status: 400 });
    }

    const dvnAddress = deployedContracts[dstChainId]?.SimpleDVNMock?.address as Address | undefined;
    const executorAddress = deployedContracts[dstChainId]?.SimpleExecutorMock?.address as Address | undefined;
    if (!dvnAddress || !executorAddress) {
      return NextResponse.json({ error: "Missing mock worker deployments on destination chain" }, { status: 500 });
    }

    const dstChain = dstChainId === HEDERA_CHAIN_ID ? hederaTestnet : baseSepolia;
    const publicClient = createPublicClient({
      chain: dstChain,
      transport: http(scaffoldConfig.rpcOverrides[dstChainId]),
    });
    const walletClient = createWalletClient({
      account,
      chain: dstChain,
      transport: http(scaffoldConfig.rpcOverrides[dstChainId]),
    });

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
      return NextResponse.json(
        {
          error: `Nonce mismatch. Expected next nonce ${nextNonce.toString()}, got ${nonceBigInt.toString()}`,
        },
        { status: 409 },
      );
    }

    const message = buildOftMessage({
      to: recipient,
      amount,
      sharedDecimals,
      composeMsg,
      composeFrom,
    });
    const guid = generateGuid({
      nonce: nonceBigInt,
      srcEid,
      srcOappB32,
      dstEid,
      dstOappB32,
    });

    const verifyHash = await walletClient.writeContract({
      address: dvnAddress,
      abi: SIMPLE_DVN_ABI,
      functionName: "verify",
      args: [message, nonceBigInt, srcEid, srcOappB32, dstEid, dstOftAddress],
      gas: HEDERA_GAS_LIMIT,
    });
    await waitForReceipt(publicClient, verifyHash);

    const receiveUln = (await publicClient.readContract({
      address: dvnAddress,
      abi: SIMPLE_DVN_ABI,
      functionName: "receiveUln",
    })) as Address;

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
    await waitForReceipt(publicClient, commitExecuteHash);

    let composeHash: `0x${string}` | undefined;
    if (composeMsg && composeFrom && composeTo) {
      const amountSD = parseEther(amount) / 10n ** BigInt(18 - sharedDecimals);
      const amountReceivedLD =
        localDecimals >= sharedDecimals
          ? amountSD * 10n ** BigInt(localDecimals - sharedDecimals)
          : amountSD / 10n ** BigInt(sharedDecimals - localDecimals);
      const composePayload = encodePacked(
        ["uint64", "uint32", "uint256", "bytes32", "bytes"],
        [nonceBigInt, srcEid, amountReceivedLD, addressToBytes32(composeFrom), composeMsg],
      );

      composeHash = await walletClient.writeContract({
        address: executorAddress,
        abi: SIMPLE_EXECUTOR_ABI,
        functionName: "compose302",
        args: [
          dstOftAddress,
          composeTo,
          guid,
          0,
          composePayload,
          "0x",
          composeGas ? BigInt(composeGas) : 12_000_000n,
        ],
        value: composeValue ? BigInt(composeValue) : 0n,
        gas: HEDERA_GAS_LIMIT,
      });
      await waitForReceipt(publicClient, composeHash);
    }

    return NextResponse.json({
      status: "completed",
      sourceTxHash,
      verifyHash,
      commitExecuteHash,
      composeHash,
      debug: {
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
    return NextResponse.json({ status: "failed", error: message }, { status: 500 });
  }
}
