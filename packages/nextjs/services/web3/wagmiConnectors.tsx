"use client";

import { connectorsForWallets } from "@rainbow-me/rainbowkit";
import { metaMaskWallet, walletConnectWallet } from "@rainbow-me/rainbowkit/wallets";
import { rainbowkitBurnerWallet } from "burner-connector";
import { hederaTestnet, scaffoldConfig } from "~~/scaffold.config";

export const wagmiConnectors = () => {
  if (typeof window === "undefined") {
    return [];
  }

  const projectId = scaffoldConfig.walletConnectProjectId?.trim();
  const wallets = [metaMaskWallet, ...(projectId ? [walletConnectWallet] : [])];

  const walletGroups: Parameters<typeof connectorsForWallets>[0] = [
    {
      groupName: "Supported Wallets",
      wallets,
    },
  ];

  const hasDevNetwork = scaffoldConfig.targetNetworks.some(network => network.id === hederaTestnet.id);
  if (hasDevNetwork) {
    // burner-connector may resolve RainbowKit from a different pnpm subpath.
    // Cast to the local wallet factory type so connectorsForWallets accepts it.
    const burnerWallet = rainbowkitBurnerWallet as unknown as typeof metaMaskWallet;
    walletGroups.push({
      groupName: "Development",
      wallets: [burnerWallet],
    });
  }

  return connectorsForWallets(walletGroups, {
    appName: "template-hedera-lz-app",
    projectId: projectId || "00000000000000000000000000000000",
  });
};
