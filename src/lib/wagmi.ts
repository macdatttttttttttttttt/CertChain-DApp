import { createConfig, http } from "wagmi";
import { defineChain } from "viem";
// Import trực tiếp từ @wagmi/core để tránh nạp các connector không dùng (Coinbase, WalletConnect...)
import { injected, mock } from "@wagmi/core";

const RPC_URL = process.env.NEXT_PUBLIC_RPC_URL || "http://127.0.0.1:8545";

export const localChain = defineChain({
  id: 31337,
  name: "Hardhat Local",
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: { default: { http: [RPC_URL] } },
  testnet: true,
});

/**
 * Ví demo: 3 tài khoản mặc định công khai của Hardhat Node (chỉ dùng trên mạng local 31337).
 * Hardhat Node tự ký giao dịch cho các tài khoản này nên có thể demo mà không cần MetaMask.
 */
export const DEMO_ACCOUNTS = [
  { label: "Quản trị viên (Bộ GD&ĐT)", address: "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266" },
  { label: "Trường ĐH Hải Phòng", address: "0x70997970C51812dc3A010C7d01b50e0d17dc79C8" },
  { label: "Trung tâm NN-TH HPU", address: "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC" },
] as const;

export const config = createConfig({
  chains: [localChain],
  connectors: [
    injected(),
    ...DEMO_ACCOUNTS.map((a) => mock({ accounts: [a.address], features: { reconnect: true } })),
  ],
  transports: { [localChain.id]: http(RPC_URL) },
  ssr: true,
});
