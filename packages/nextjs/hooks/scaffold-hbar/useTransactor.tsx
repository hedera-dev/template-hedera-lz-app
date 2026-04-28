"use client";

import toast from "react-hot-toast";
import { usePublicClient } from "wagmi";
import { TransactionReceipt } from "viem";

export const useTransactor = () => {
  const publicClient = usePublicClient();

  const waitForTx = async (hash: `0x${string}`) => {
    if (!publicClient) {
      toast.error("Public client unavailable");
      throw new Error("Public client unavailable");
    }

    toast.loading("Transaction submitted", { id: hash });

    try {
      const receipt: TransactionReceipt = await publicClient.waitForTransactionReceipt({ hash });

      if (receipt.status === "reverted") {
        toast.error("Transaction reverted", { id: hash });
        throw new Error("Transaction reverted");
      }

      toast.success("Transaction confirmed", { id: hash });
      return receipt;
    } catch (error) {
      toast.error("Transaction failed", { id: hash });
      throw error;
    }
  };

  return { waitForTx };
};
