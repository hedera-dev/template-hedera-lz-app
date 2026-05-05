"use client";

import { CurrencyDollarIcon } from "@heroicons/react/24/outline";
import { SwitchTheme } from "./SwitchTheme";
import { useAccount, useBalance } from "wagmi";
import { hederaTestnet } from "~~/scaffold.config";
import { useTargetNetwork } from "~~/hooks/scaffold-hbar";

export const Footer = () => {
  const targetNetwork = useTargetNetwork();
  const { address } = useAccount();
  const isTestnet = targetNetwork.id === hederaTestnet.id;
  const { data: testnetBalance } = useBalance({
    address,
    chainId: hederaTestnet.id,
    query: {
      enabled: Boolean(address),
    },
  });

  return (
    <footer className="border-t border-base-300 mt-8">
      <div className="mx-auto max-w-6xl px-4 py-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <div className="btn btn-primary btn-sm font-normal gap-1 cursor-auto rounded-full">
            <span>{targetNetwork.name}</span>
          </div>
          {isTestnet ? (
            <a
              className="btn btn-secondary btn-sm font-normal gap-1 rounded-full"
              href="https://portal.hedera.com/faucet"
              target="_blank"
              rel="noreferrer"
            >
              Faucet
            </a>
          ) : null}
          {testnetBalance ? (
            <div className="btn btn-ghost btn-sm font-normal gap-1 cursor-auto rounded-full">
              <CurrencyDollarIcon className="h-4 w-4" />
              <span>{Number(testnetBalance.formatted).toFixed(2)} HBAR</span>
            </div>
          ) : null}
          <SwitchTheme />
        </div>

        <div className="flex flex-wrap items-center gap-3 text-sm text-base-content/60 md:justify-end">
          <a
            href="https://github.com/buidler-labs/scaffold-hbar"
            target="_blank"
            rel="noreferrer"
            className="link hover:text-primary"
          >
            GitHub
          </a>
          <span className="opacity-30">|</span>
          <span>Template Hedera LZ App</span>
          <span className="opacity-30">|</span>
          <a href="https://docs.hedera.com/" target="_blank" rel="noreferrer" className="link hover:text-primary">
            Docs
          </a>
        </div>
      </div>
    </footer>
  );
};
