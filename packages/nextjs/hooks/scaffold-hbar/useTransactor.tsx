"use client";

import toast from "react-hot-toast";

export const useTransactor = () => {
  const waitForTx = async (hash: `0x${string}`) => {
    toast.loading("Transaction submitted", { id: hash });
    return hash;
  };

  return { waitForTx };
};
