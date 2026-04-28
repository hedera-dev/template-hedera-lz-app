"use client";

import { parseEther } from "viem";
import { useMemo } from "react";

export const useOvaultQuote = ({ amount }: { amount: string }) => {
  return useMemo(() => {
    try {
      const wei = parseEther(amount || "0");
      const fee = (wei / 1000n).toString();
      return { nativeFee: fee, ok: true };
    } catch {
      return { nativeFee: "0", ok: false };
    }
  }, [amount]);
};
