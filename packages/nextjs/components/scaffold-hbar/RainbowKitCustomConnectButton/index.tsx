"use client";

import { AddressInfoDropdown } from "./AddressInfoDropdown";
import { RevealBurnerPKModal } from "./RevealBurnerPKModal";
import { SetBurnerPKModal } from "./SetBurnerPKModal";
import { WrongNetworkDropdown } from "./WrongNetworkDropdown";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { Address } from "viem";
import { formatUnits } from "viem";
import { useAccount, useBalance } from "wagmi";
import { useNetworkColor } from "~~/hooks/scaffold-hbar";
import { useTargetNetwork } from "~~/hooks/scaffold-hbar/useTargetNetwork";

export const RainbowKitCustomConnectButton = () => {
  const networkColor = useNetworkColor();
  const targetNetwork = useTargetNetwork();
  const { address, chainId } = useAccount();
  const { data: accountBalance } = useBalance({
    address,
    chainId,
    query: {
      enabled: Boolean(address && chainId),
    },
  });

  const getBlockExplorerAddressLink = (address: string) => {
    const baseUrl = targetNetwork.blockExplorers?.default?.url ?? "https://hashscan.io/testnet";
    const pathSegment = targetNetwork.id === 296 ? "account" : "address";
    return `${baseUrl}/${pathSegment}/${address}`;
  };

  return (
    <ConnectButton.Custom>
      {({ account, chain, openConnectModal, mounted }) => {
        const connected = mounted && account && chain;
        const blockExplorerAddressLink = account ? getBlockExplorerAddressLink(account.address) : undefined;

        return (
          <>
            {(() => {
              if (!connected) {
                return (
                  <button className="btn btn-primary btn-sm" onClick={openConnectModal} type="button">
                    Connect Wallet
                  </button>
                );
              }

              if (chain.unsupported || chain.id !== targetNetwork.id) {
                return <WrongNetworkDropdown />;
              }

              return (
                <>
                  <div className="flex flex-col items-center mr-2">
                    <span className="text-xs">
                      {accountBalance
                        ? `${Number(formatUnits(accountBalance.value, accountBalance.decimals)).toFixed(4)} ${accountBalance.symbol}`
                        : "—"}
                    </span>
                    <span className="text-xs" style={{ color: networkColor }}>
                      {chain.name}
                    </span>
                  </div>
                  <AddressInfoDropdown
                    address={account.address as Address}
                    displayName={account.displayName}
                    ensAvatar={account.ensAvatar}
                    blockExplorerAddressLink={blockExplorerAddressLink}
                  />
                  <RevealBurnerPKModal />
                  <SetBurnerPKModal />
                </>
              );
            })()}
          </>
        );
      }}
    </ConnectButton.Custom>
  );
};
