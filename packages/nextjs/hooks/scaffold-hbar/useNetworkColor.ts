import { useTheme } from "next-themes";
import { useMemo } from "react";
import { useTargetNetwork } from "~~/hooks/scaffold-hbar/useTargetNetwork";
import { scaffoldConfig } from "~~/scaffold.config";

export const DEFAULT_NETWORK_COLOR: [string, string] = ["#666666", "#bbbbbb"];

export function getNetworkColor(
  network: { id: number; color?: string | [string, string] },
  isDarkMode: boolean,
) {
  const fallbackColor = network.id === scaffoldConfig.targetNetworks[0].id ? ["#8259EF", "#A98AFF"] : DEFAULT_NETWORK_COLOR;
  const colorConfig = network.color ?? fallbackColor;
  return Array.isArray(colorConfig) ? (isDarkMode ? colorConfig[1] : colorConfig[0]) : colorConfig;
}

export const useNetworkColor = () => {
  const { resolvedTheme } = useTheme();
  const targetNetwork = useTargetNetwork();
  const isDarkMode = resolvedTheme === "dark";

  return useMemo(() => getNetworkColor(targetNetwork, isDarkMode), [targetNetwork, isDarkMode]);
};
