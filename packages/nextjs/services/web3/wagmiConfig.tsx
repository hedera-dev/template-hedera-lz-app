"use client";

import { wagmiConnectors } from "./wagmiConnectors";
import { QueryClient } from "@tanstack/react-query";
import { createConfig, http } from "wagmi";
import { baseSepolia } from "wagmi/chains";
import { hederaTestnet, scaffoldConfig } from "~~/scaffold.config";

export const wagmiConfig = createConfig({
  chains: [hederaTestnet, baseSepolia],
  connectors: wagmiConnectors(),
  ssr: true,
  transports: {
    [hederaTestnet.id]: http(scaffoldConfig.rpcOverrides[hederaTestnet.id]),
    [baseSepolia.id]: http(scaffoldConfig.rpcOverrides[baseSepolia.id]),
  },
});

export const queryClient = new QueryClient();
