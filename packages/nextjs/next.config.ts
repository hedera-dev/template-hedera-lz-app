import dotenv from "dotenv";
import path from "path";
import type { NextConfig } from "next";

// Single-key setup: fall back to the repo-root .env so one key drives both the
// hardhat tasks and the server-side relayer API. Vars already set (including
// via packages/nextjs/.env.local) always win; empty values get filled.
const rootEnv = dotenv.config({ path: path.resolve(__dirname, "../../.env") }).parsed ?? {};
for (const [key, value] of Object.entries(rootEnv)) {
  if (!process.env[key]) process.env[key] = value;
}

const nextConfig: NextConfig = {
  reactStrictMode: true,
  outputFileTracingRoot: __dirname,
  eslint: {
    ignoreDuringBuilds: true,
  },
  webpack: (config) => {
    config.resolve.fallback = {
      ...config.resolve.fallback,
      fs: false,
      net: false,
      tls: false,
    };
    return config;
  },
};

export default nextConfig;
