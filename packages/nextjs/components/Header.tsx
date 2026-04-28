"use client";

import { Bars3Icon, BugAntIcon, ArrowsRightLeftIcon, CircleStackIcon, WrenchScrewdriverIcon } from "@heroicons/react/24/outline";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { RainbowKitCustomConnectButton } from "~~/components/scaffold-hbar";

const menuLinks = [
  { href: "/", label: "Home" },
  { href: "/bridge", label: "Bridge", icon: <ArrowsRightLeftIcon className="h-4 w-4" /> },
  { href: "/vault", label: "Vault", icon: <CircleStackIcon className="h-4 w-4" /> },
  { href: "/strategy", label: "Strategy", icon: <CircleStackIcon className="h-4 w-4" /> },
  { href: "/admin", label: "Admin", icon: <WrenchScrewdriverIcon className="h-4 w-4" /> },
  { href: "/mock-workers", label: "Workers", icon: <WrenchScrewdriverIcon className="h-4 w-4" /> },
  { href: "/debug", label: "Debug", icon: <BugAntIcon className="h-4 w-4" /> },
];

export const Header = () => {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-20 navbar bg-base-100 border-b border-base-300 px-2 shadow-sm">
      <div className="navbar-start w-auto lg:w-1/2">
        <details className="dropdown lg:hidden">
          <summary className="btn btn-ghost">
            <Bars3Icon className="h-5 w-5" />
          </summary>
          <ul className="menu menu-compact dropdown-content mt-3 p-2 shadow-sm bg-base-100 rounded-box w-56 z-30">
            {menuLinks.map(link => (
              <li key={link.href}>
                <Link href={link.href}>{link.label}</Link>
              </li>
            ))}
          </ul>
        </details>
        <Link href="/" className="hidden lg:flex items-center gap-3 ml-3 mr-4">
          <div className="relative h-8 w-8">
            <Image src="/Hedera-Icon-Dark.svg" alt="Hedera logo" width={32} height={32} className="dark:hidden" priority />
            <Image src="/Hedera-Icon-White.svg" alt="Hedera logo" width={32} height={32} className="hidden dark:block" priority />
          </div>
          <div className="leading-tight">
            <div className="font-bold text-sm">Scaffold-HBAR</div>
            <div className="text-[10px] uppercase tracking-wider text-base-content/60">Built on Hedera</div>
          </div>
        </Link>
        <ul className="hidden lg:flex menu menu-horizontal gap-2 px-1">
          {menuLinks.map(link => {
            const active = pathname === link.href;
            return (
              <li key={link.href}>
                <Link
                  href={link.href}
                  className={`${active ? "bg-primary/10 text-primary font-semibold" : "hover:bg-primary/5"} py-1.5 px-3 text-sm rounded-full gap-2`}
                >
                  {link.icon}
                  <span>{link.label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
      <div className="navbar-end">
        <RainbowKitCustomConnectButton />
      </div>
    </header>
  );
};
