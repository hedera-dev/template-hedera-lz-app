"use client";

import "@rainbow-me/rainbowkit/styles.css";
import { RainbowKitProvider, darkTheme, lightTheme } from "@rainbow-me/rainbowkit";
import { QueryClientProvider } from "@tanstack/react-query";
import { AppProgressBar as ProgressBar } from "next-nprogress-bar";
import { ReactNode, useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { Toaster } from "react-hot-toast";
import { WagmiProvider } from "wagmi";
import { hederaTestnet } from "~~/scaffold.config";
import { queryClient, wagmiConfig } from "~~/services/web3/wagmiConfig";
import { Footer } from "./Footer";
import { Header } from "./Header";
import { LocalChainErrorBanner } from "./LocalChainErrorBanner";
import { BlockieAvatar } from "./scaffold-hbar";

export const ScaffoldHbarAppWithProviders = ({ children }: { children: ReactNode }) => {
  const { resolvedTheme } = useTheme();
  const isDarkMode = resolvedTheme === "dark";
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const rainbowKitTheme = mounted
    ? isDarkMode
      ? darkTheme({
          accentColor: "#8259ef",
          accentColorForeground: "white",
          borderRadius: "large",
          fontStack: "system",
          overlayBlur: "small",
        })
      : lightTheme({
          accentColor: "#4f46e5",
          accentColorForeground: "white",
          borderRadius: "large",
          fontStack: "system",
          overlayBlur: "small",
        })
    : lightTheme({
        accentColor: "#4f46e5",
        accentColorForeground: "white",
        borderRadius: "large",
        fontStack: "system",
        overlayBlur: "small",
      });

  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <ProgressBar height="3px" color="#2299dd" />
        <RainbowKitProvider avatar={BlockieAvatar} coolMode initialChain={hederaTestnet} theme={rainbowKitTheme}>
          <div className="min-h-screen bg-base-200 flex flex-col">
            <Header />
            <LocalChainErrorBanner />
            <main className="relative flex flex-col flex-1 mx-auto max-w-6xl px-4 py-6 w-full">{children}</main>
            <Footer />
          </div>
          <Toaster />
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
};
