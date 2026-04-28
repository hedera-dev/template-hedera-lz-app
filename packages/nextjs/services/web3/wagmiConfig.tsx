"use client";

import { QueryClient } from "@tanstack/react-query";
import { createConfig, http } from "wagmi";
import { baseSepolia } from "wagmi/chains";
import { hederaTestnet, scaffoldConfig } from "~~/scaffold.config";
import { injected, walletConnect } from "wagmi/connectors";

export const wagmiConfig = createConfig({
  chains: [hederaTestnet, baseSepolia],
  connectors: [
    injected(),
    walletConnect({
      projectId: scaffoldConfig.walletConnectProjectId || "demo",
      showQrModal: true,
    }),
  ],
  transports: {
    [hederaTestnet.id]: http(scaffoldConfig.rpcOverrides[hederaTestnet.id]),
    [baseSepolia.id]: http(scaffoldConfig.rpcOverrides[baseSepolia.id]),
  },
});

export const queryClient = new QueryClient();
