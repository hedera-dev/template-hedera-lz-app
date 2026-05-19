"use client";

import { useAccount, useSwitchChain } from "wagmi";
import { baseSepolia } from "wagmi/chains";
import { hederaTestnet } from "~~/scaffold.config";

export const LocalChainErrorBanner = () => {
  const { chainId } = useAccount();
  const { switchChain } = useSwitchChain();

  const supported = chainId === hederaTestnet.id || chainId === baseSepolia.id;
  if (!chainId || supported) {
    return null;
  }

  return (
    <div className="alert alert-warning rounded-none">
      <span>Unsupported network. Switch to Hedera Testnet or Base Sepolia.</span>
      <div className="flex gap-2">
        <button className="btn btn-xs" onClick={() => switchChain({ chainId: hederaTestnet.id })}>
          Hedera
        </button>
        <button className="btn btn-xs" onClick={() => switchChain({ chainId: baseSepolia.id })}>
          Base Sepolia
        </button>
      </div>
    </div>
  );
};
