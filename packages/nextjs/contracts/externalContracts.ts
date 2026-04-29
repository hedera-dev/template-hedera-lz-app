import addresses from "../../../env/addresses.testnet.json";

const hedera = (addresses as any)["hedera-testnet"];

const erc20Abi = [
  {
    inputs: [{ name: "account", type: "address" }],
    name: "balanceOf",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
];

export const externalContracts = {
  296: {
    Whbar: { address: hedera.whbarToken as `0x${string}`, abi: erc20Abi },
    WethHts: { address: hedera.wethToken as `0x${string}`, abi: erc20Abi },
    Hustlers: { address: hedera.hustlersToken as `0x${string}`, abi: erc20Abi },
    ReceiveUln302: { address: "0xc0c34919A04d69415EF2637A3Db5D637a7126cd0" as `0x${string}`, abi: [] },
    SaucerRouterV1: { address: hedera.routerV1 as `0x${string}`, abi: [] },
    SaucerFactoryV1: { address: hedera.factoryV1 as `0x${string}`, abi: [] },
  },
} as const;
