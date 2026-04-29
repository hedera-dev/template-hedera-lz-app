"use client";

import React, { useRef } from "react";
import {
  ArrowsRightLeftIcon,
  Bars3Icon,
  CircleStackIcon,
  WrenchScrewdriverIcon,
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
  { href: "/", label: "Home" },
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

  useOutsideClick(burgerMenuRef, () => {
    burgerMenuRef?.current?.removeAttribute("open");
  });

  return (
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
        <Link href="/" className="hidden lg:flex items-center gap-3 ml-4 mr-6 shrink-0">
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
      <div className="navbar-end grow mr-4">
        <RainbowKitCustomConnectButton />
      </div>
    </header>
  );
};
