"use client";

import React, { useRef } from "react";
import {
  ArrowsRightLeftIcon,
  Bars3Icon,
  CircleStackIcon,
  QuestionMarkCircleIcon,
  WrenchScrewdriverIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { RainbowKitCustomConnectButton } from "~~/components/scaffold-hbar";
import { useOutsideClick } from "~~/hooks/scaffold-hbar";

type HeaderMenuLink = {
  label: string;
  href: string;
  icon?: React.ReactNode;
};

const menuLinks: HeaderMenuLink[] = [
  { href: "/bridge", label: "Bridge", icon: <ArrowsRightLeftIcon className="h-4 w-4" /> },
  { href: "/vault", label: "Vault", icon: <CircleStackIcon className="h-4 w-4" /> },
  { href: "/strategy", label: "Strategy", icon: <CircleStackIcon className="h-4 w-4" /> },
  { href: "/mock-workers", label: "Workers", icon: <WrenchScrewdriverIcon className="h-4 w-4" /> },
];

const HeaderMenuLinks = ({ onClick }: { onClick?: () => void }) => {
  const pathname = usePathname();

  return (
    <>
      {menuLinks.map(link => {
        const active = pathname === link.href;
        return (
          <li key={link.href}>
            <Link
              href={link.href}
              onClick={onClick}
              className={`${
                active ? "bg-primary/10 text-primary font-semibold" : "hover:bg-primary/5"
              } py-1.5 px-3 text-sm rounded-full gap-2`}
            >
              {link.icon}
              <span>{link.label}</span>
            </Link>
          </li>
        );
      })}
    </>
  );
};

export const Header = () => {
  const burgerMenuRef = useRef<HTMLDetailsElement>(null);
  const [helpOpen, setHelpOpen] = React.useState(false);

  useOutsideClick(burgerMenuRef, () => {
    burgerMenuRef?.current?.removeAttribute("open");
  });

  return (
    <>
      <header className="sticky lg:static top-0 z-20 navbar bg-base-100 border-b border-base-300 px-0 sm:px-2 shadow-sm min-h-0 shrink-0">
        <div className="navbar-start w-auto lg:w-1/2">
          <details className="dropdown lg:hidden" ref={burgerMenuRef}>
            <summary className="ml-1 btn btn-ghost hover:bg-transparent">
              <Bars3Icon className="h-1/2" />
            </summary>
            <ul className="menu menu-compact dropdown-content mt-3 p-2 shadow-sm bg-base-100 rounded-box w-56 z-30">
              <HeaderMenuLinks
                onClick={() => {
                  burgerMenuRef?.current?.removeAttribute("open");
                }}
              />
            </ul>
          </details>
          <Link href="/bridge" className="hidden lg:flex items-center gap-3 ml-4 mr-6 shrink-0">
            <div className="relative h-9 w-9">
              <Image src="/Hedera-Icon-Dark.svg" alt="Hedera logo" fill className="dark:hidden" priority />
              <Image src="/Hedera-Icon-White.svg" alt="Hedera logo" fill className="hidden dark:block" priority />
            </div>
            <div className="flex flex-col">
              <span className="font-bold leading-tight text-base">Scaffold-HBAR</span>
              <span className="text-[10px] uppercase tracking-wider text-base-content/50 font-medium">Built on Hedera</span>
            </div>
          </Link>
          <ul className="hidden lg:flex menu menu-horizontal gap-2 px-1">
            <HeaderMenuLinks />
          </ul>
        </div>
        <div className="navbar-end grow mr-4 gap-2">
          <button className="btn btn-ghost btn-sm" onClick={() => setHelpOpen(true)}>
            <QuestionMarkCircleIcon className="h-5 w-5" />
            <span className="hidden sm:inline">How it works</span>
          </button>
          <RainbowKitCustomConnectButton />
        </div>
      </header>

      {helpOpen && (
        <div className="fixed inset-0 z-40">
          <button
            aria-label="Close help drawer"
            className="absolute inset-0 bg-black/30"
            onClick={() => setHelpOpen(false)}
          />
          <aside className="absolute right-0 top-0 h-full w-full max-w-xl bg-base-100 border-l border-base-300 shadow-xl overflow-y-auto">
            <div className="p-4 sm:p-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-2xl font-semibold mb-1">How this app works</h2>
                  <p className="text-sm text-base-content/70 m-0">
                    What each screen does and the shortest path to run it successfully.
                  </p>
                </div>
                <button className="btn btn-ghost btn-sm" onClick={() => setHelpOpen(false)}>
                  <XMarkIcon className="h-5 w-5" />
                </button>
              </div>

              <div className="mt-5 space-y-4 text-sm">
                <section className="rounded-xl border border-primary/20 bg-primary/5 p-4">
                  <h3 className="font-semibold mb-2">Before using the UI</h3>
                  <ul className="list-disc ml-5 space-y-1.5">
                    <li>Deploy contracts and wire LayerZero paths using the setup commands.</li>
                    <li>Regenerate frontend bindings with <code>pnpm next:gen-contracts</code> after redeploys.</li>
                    <li>Set required values in both <code>.env</code> and <code>packages/nextjs/.env.local</code>.</li>
                  </ul>
                </section>

                <section className="rounded-xl border border-base-300 bg-base-200 p-4">
                  <h3 className="font-semibold mb-3">Pages and purpose</h3>
                  <div className="space-y-3">
                    <div className="flex items-start gap-3">
                      <ArrowsRightLeftIcon className="h-4 w-4 mt-0.5 text-primary shrink-0" />
                      <p className="m-0">
                        <strong>Bridge:</strong> transfer OFT value between Base and Hedera and follow cross-chain message
                        execution.
                      </p>
                    </div>
                    <div className="flex items-start gap-3">
                      <CircleStackIcon className="h-4 w-4 mt-0.5 text-primary shrink-0" />
                      <p className="m-0">
                        <strong>Vault:</strong> submit deposit/redeem intents. Deposits route through composer into the ETF strategy
                        vault flow.
                      </p>
                    </div>
                    <div className="flex items-start gap-3">
                      <CircleStackIcon className="h-4 w-4 mt-0.5 text-primary shrink-0" />
                      <p className="m-0">
                        <strong>Strategy:</strong> status dashboard only. It shows vault/strategy balances and events; it does not
                        submit user actions.
                      </p>
                    </div>
                    <div className="flex items-start gap-3">
                      <WrenchScrewdriverIcon className="h-4 w-4 mt-0.5 text-primary shrink-0" />
                      <p className="m-0">
                        <strong>Workers:</strong> manual recovery tooling for DVN/executor processing when relayer automation fails.
                      </p>
                    </div>
                  </div>
                </section>

                <section className="rounded-xl border border-base-300 bg-base-200 p-4">
                  <h3 className="font-semibold mb-2">First test flow</h3>
                  <ol className="list-decimal ml-5 space-y-1.5">
                    <li>Run Chapter 1 deploy + wire + send once to verify bridge path.</li>
                    <li>Run Chapter 2/3 deploy steps and strategy ownership setup.</li>
                    <li>
                      Run <code>pnpm next:gen-contracts</code> then <code>pnpm next:dev</code>.
                    </li>
                    <li>
                      Test pages in order: Bridge {"->"} Vault {"->"} Strategy (status check) {"->"} Workers (only if
                      recovery is needed).
                    </li>
                  </ol>
                </section>

                <section className="rounded-xl border border-base-300 bg-base-100 p-4">
                  <p className="m-0 text-sm text-base-content/80">
                    Canonical instructions: <code>README.md</code> (contracts/deploy/wire) and <code>RUNBOOK.md</code>{" "}
                    (frontend + operational checks).
                  </p>
                </section>
              </div>
            </div>
          </aside>
        </div>
      )}
    </>
  );
};
