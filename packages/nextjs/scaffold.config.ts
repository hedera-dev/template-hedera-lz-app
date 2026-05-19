import { Chain } from "viem";
import { baseSepolia } from "viem/chains";

export const hederaTestnet = {
  id: 296,
  name: "Hedera Testnet",
  nativeCurrency: { name: "HBAR", symbol: "HBAR", decimals: 18 },
  rpcUrls: {
    default: { http: [process.env.NEXT_PUBLIC_RPC_URL_HEDERA_TESTNET || "https://testnet.hashio.io/api"] },
  },
  blockExplorers: {
    default: { name: "HashScan", url: "https://hashscan.io/testnet" },
  },
  testnet: true,
} as const satisfies Chain;

export const scaffoldConfig = {
  targetNetworks: [hederaTestnet, baseSepolia],
  walletConnectProjectId: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || "",
  rpcOverrides: {
    [hederaTestnet.id]: process.env.NEXT_PUBLIC_RPC_URL_HEDERA_TESTNET || "https://testnet.hashio.io/api",
    [baseSepolia.id]: process.env.NEXT_PUBLIC_RPC_URL_BASE_SEPOLIA || "https://sepolia.base.org",
  },
};
