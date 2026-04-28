"use client";

import { useTheme } from "next-themes";
import { MoonIcon, SunIcon } from "@heroicons/react/24/outline";

export const SwitchTheme = ({ className = "" }: { className?: string }) => {
  const { theme, setTheme } = useTheme();
  const isDark = theme === "dark";
  const next = isDark ? "light" : "dark";
  return (
    <button className={`btn btn-circle btn-sm ${className}`} onClick={() => setTheme(next)} aria-label="Toggle theme">
      {isDark ? <SunIcon className="h-4 w-4" /> : <MoonIcon className="h-4 w-4" />}
    </button>
  );
};
