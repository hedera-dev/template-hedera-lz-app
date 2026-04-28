"use client";

import "@rainbow-me/rainbowkit/styles.css";
import { RainbowKitProvider } from "@rainbow-me/rainbowkit";
import { QueryClientProvider } from "@tanstack/react-query";
import { ReactNode } from "react";
import { Toaster } from "react-hot-toast";
import { WagmiProvider } from "wagmi";
import { queryClient, wagmiConfig } from "~~/services/web3/wagmiConfig";
import { Footer } from "./Footer";
import { Header } from "./Header";
import { LocalChainErrorBanner } from "./LocalChainErrorBanner";

export const ScaffoldHbarAppWithProviders = ({ children }: { children: ReactNode }) => {
  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider>
          <div className="min-h-screen bg-base-200">
            <Header />
            <LocalChainErrorBanner />
            <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>
            <Footer />
          </div>
          <Toaster position="bottom-right" />
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
};
