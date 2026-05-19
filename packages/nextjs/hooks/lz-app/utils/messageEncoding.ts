"use client";

import { encodeAbiParameters, encodePacked, keccak256, parseUnits } from "viem";

export const addressToBytes32 = (address: `0x${string}`): `0x${string}` =>
  `0x${address.slice(2).padStart(64, "0")}` as `0x${string}`;

export const buildOftMessage = ({
  to,
  amount,
  sharedDecimals,
  composeMsg,
  composeFrom,
}: {
  to: `0x${string}`;
  amount: string;
  sharedDecimals: number;
  composeMsg?: `0x${string}`;
  composeFrom?: `0x${string}`;
}): `0x${string}` => {
  const toB32 = addressToBytes32(to);
  const amountSD = parseUnits(amount, sharedDecimals);

  if (composeMsg && composeFrom) {
    const composeFromB32 = addressToBytes32(composeFrom);
    return encodePacked(["bytes32", "uint64", "bytes32", "bytes"], [toB32, amountSD, composeFromB32, composeMsg]);
  }

  return encodePacked(["bytes32", "uint64"], [toB32, amountSD]);
};

export const generateGuid = ({
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
}): `0x${string}` => {
  return keccak256(
    encodePacked(["uint64", "uint32", "bytes32", "uint32", "bytes32"], [nonce, srcEid, srcOappB32, dstEid, dstOappB32]),
  );
};

export const buildComposePayload = ({
  nonce,
  srcEid,
  amountReceivedLD,
  composeFrom,
  composeMsg,
}: {
  nonce: bigint;
  srcEid: number;
  amountReceivedLD: bigint;
  composeFrom: `0x${string}`;
  composeMsg: `0x${string}`;
}): `0x${string}` => {
  const composeFromB32 = addressToBytes32(composeFrom);
  return encodePacked(
    ["uint64", "uint32", "uint256", "bytes32", "bytes"],
    [nonce, srcEid, amountReceivedLD, composeFromB32, composeMsg],
  );
};

export const computeAmountReceivedLD = ({
  amount,
  sharedDecimals,
  localDecimals,
}: {
  amount: string;
  sharedDecimals: number;
  localDecimals: number;
}): bigint => {
  const amountSD = parseUnits(amount, sharedDecimals);
  const diff = localDecimals - sharedDecimals;
  if (diff >= 0) {
    return amountSD * 10n ** BigInt(diff);
  }
  return amountSD / 10n ** BigInt(Math.abs(diff));
};

export const encodeNativeDropParams = (params: Array<{ receiver: `0x${string}`; amount: bigint }>): `0x${string}` => {
  return encodeAbiParameters(
    [
      {
        type: "tuple[]",
        components: [
          { name: "_receiver", type: "address" },
          { name: "_amount", type: "uint256" },
        ],
      },
    ],
    [params.map(p => ({ _receiver: p.receiver, _amount: p.amount }))],
  );
};

export const decodeOftMessage = (message: `0x${string}`) => {
  const raw = message.startsWith("0x") ? message.slice(2) : message;
  // OFT message is packed: bytes32 to (32 bytes) + uint64 amountSD (8 bytes) [+ bytes32 composeFrom + bytes composeMsg]
  if (raw.length < 80) {
    throw new Error(`Invalid OFT message length: expected at least 40 bytes, got ${raw.length / 2}`);
  }

  const toHex = raw.slice(0, 64);
  const amountHex = raw.slice(64, 80);
  const remainder = raw.slice(80);

  const toBytes32 = `0x${toHex}` as `0x${string}`;
  const toAddress = `0x${toHex.slice(-40)}` as `0x${string}`;
  const amountSD = BigInt(`0x${amountHex}`).toString();

  if (remainder.length >= 64) {
    const composeFromHex = remainder.slice(0, 64);
    const composeMsgHex = remainder.slice(64);
    return {
      mode: "sendAndCall" as const,
      toBytes32,
      toAddress,
      amountSD,
      composeFromBytes32: `0x${composeFromHex}` as `0x${string}`,
      composeFromAddress: `0x${composeFromHex.slice(-40)}` as `0x${string}`,
      composeMsg: `0x${composeMsgHex}` as `0x${string}`,
    };
  }

  return {
    mode: "send" as const,
    toBytes32,
    toAddress,
    amountSD,
  };
};
