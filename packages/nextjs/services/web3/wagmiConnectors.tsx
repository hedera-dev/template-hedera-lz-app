"use client";

import { connectorsForWallets } from "@rainbow-me/rainbowkit";
import { metaMaskWallet, walletConnectWallet } from "@rainbow-me/rainbowkit/wallets";
import { rainbowkitBurnerWallet } from "burner-connector";
import { hederaTestnet, scaffoldConfig } from "~~/scaffold.config";

const wallets = [metaMaskWallet, walletConnectWallet];

export const wagmiConnectors = () => {
  if (typeof window === "undefined") {
    return [];
  }

  const walletGroups: Parameters<typeof connectorsForWallets>[0] = [
    {
      groupName: "Supported Wallets",
      wallets,
    },
  ];

  const hasDevNetwork = scaffoldConfig.targetNetworks.some(network => network.id === hederaTestnet.id);
  if (hasDevNetwork) {
    walletGroups.push({
      groupName: "Development",
      wallets: [rainbowkitBurnerWallet],
    });
  }

  return connectorsForWallets(walletGroups, {
    appName: "template-hedera-lz-app",
    projectId: scaffoldConfig.walletConnectProjectId || "demo",
  });
};
