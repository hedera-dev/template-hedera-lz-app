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
    <footer className="min-h-0 py-5 px-1 mb-11 lg:mb-0">
      <div className="fixed flex justify-between items-center w-full z-10 p-4 bottom-0 left-0 pointer-events-none">
        <div className="flex flex-col md:flex-row gap-2 pointer-events-auto">
          <div className="btn btn-primary btn-sm font-normal gap-1 cursor-auto rounded-full">
            <span>{targetNetwork.name}</span>
          </div>
          {isTestnet && (
            <a
              className="btn btn-secondary btn-sm font-normal gap-1 rounded-full"
              href="https://portal.hedera.com/faucet"
              target="_blank"
              rel="noreferrer"
            >
              Faucet
            </a>
          )}
          {testnetBalance && (
            <div className="btn btn-ghost btn-sm font-normal gap-1 cursor-auto rounded-full">
              <CurrencyDollarIcon className="h-4 w-4" />
              <span>{Number(testnetBalance.formatted).toFixed(2)} HBAR</span>
            </div>
          )}
        </div>
        <SwitchTheme className="pointer-events-auto" />
      </div>
      <div className="w-full">
        <ul className="menu menu-horizontal w-full">
          <li className="w-full">
            <div className="flex justify-center items-center gap-3 text-sm w-full text-base-content/60">
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
          </li>
        </ul>
      </div>
    </footer>
  );
};
