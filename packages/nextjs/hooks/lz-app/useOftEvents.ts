"use client";

import { useScaffoldEventHistory } from "~~/hooks/scaffold-hbar";

export const useOftEvents = () => {
  const invested = useScaffoldEventHistory("HederaEtfStrategy", 296, "Invested", { refetchInterval: 7_000 });
  const divested = useScaffoldEventHistory("HederaEtfStrategy", 296, "Divested", { refetchInterval: 7_000 });
  return { invested, divested };
};
