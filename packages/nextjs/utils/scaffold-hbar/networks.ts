import { baseSepolia } from "viem/chains";
import { hederaTestnet } from "~~/scaffold.config";

export const networkById = {
  [hederaTestnet.id]: hederaTestnet,
  [baseSepolia.id]: baseSepolia,
};
