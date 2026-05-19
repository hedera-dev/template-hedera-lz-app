"use client";

import { MoonIcon, SunIcon } from "@heroicons/react/24/outline";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";

export const SwitchTheme = ({ className = "" }: { className?: string }) => {
  const [mounted, setMounted] = useState(false);
  const { resolvedTheme, setTheme } = useTheme();
  useEffect(() => setMounted(true), []);

  const isDark = resolvedTheme === "dark";
  const next = isDark ? "light" : "dark";

  return (
    <button
      type="button"
      className={`btn btn-circle btn-sm ${className}`}
      onClick={() => setTheme(next)}
      aria-label="Toggle theme"
    >
      {!mounted ? (
        <MoonIcon className="invisible h-4 w-4" aria-hidden />
      ) : isDark ? (
        <SunIcon className="h-4 w-4" />
      ) : (
        <MoonIcon className="h-4 w-4" />
      )}
    </button>
  );
};
