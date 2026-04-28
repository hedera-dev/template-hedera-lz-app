"use client";

import { useMemo } from "react";
import { useAccount } from "wagmi";
import { scaffoldConfig } from "~~/scaffold.config";

export const useTargetNetwork = () => {
  const { chainId } = useAccount();

  return useMemo(() => {
    return scaffoldConfig.targetNetworks.find((n) => n.id === chainId) || scaffoldConfig.targetNetworks[0];
  }, [chainId]);
};
