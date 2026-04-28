export const useLayerZeroScanLink = (txHash?: string, srcChainId?: number) => {
  if (!txHash) return "";
  const chain = srcChainId === 84532 ? "base-sepolia" : "hedera-testnet";
  return `https://testnet.layerzeroscan.com/tx/${txHash}?srcChain=${chain}`;
};
