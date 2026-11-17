import deployment from "@/contracts/deployment.json";
import type { Abi, Address } from "viem";

/** Địa chỉ + ABI được scripts/deploy.ts ghi ra sau khi triển khai */
export const REGISTRY_ADDRESS = deployment.address as Address;
export const REGISTRY_ABI = deployment.abi as Abi;
export const IS_DEPLOYED =
  REGISTRY_ADDRESS !== "0x0000000000000000000000000000000000000000" && deployment.abi.length > 0;

export const registry = { address: REGISTRY_ADDRESS, abi: REGISTRY_ABI } as const;

export const CERT_TYPES = [
  { value: 0, label: "Bằng Cử nhân / Kỹ sư" },
  { value: 1, label: "Bằng Thạc sĩ" },
  { value: 2, label: "Bằng Tiến sĩ" },
  { value: 3, label: "Chứng chỉ" },
] as const;

export const certTypeLabel = (v: number) => CERT_TYPES.find((c) => c.value === v)?.label ?? "Không xác định";

export enum CertStatus {
  NONE = 0,
  VALID = 1,
  REVOKED = 2,
}

export type CertificateView = {
  certHash: `0x${string}`;
  studentHash: `0x${string}`;
  issuer: Address;
  issuedAt: bigint;
  certType: number;
  status: number;
  revokedAt: bigint;
  serialNo: string;
  ipfsCid: string;
};

export type IssuerView = {
  name: string;
  active: boolean;
  issuedCount: number;
  registeredAt: bigint;
};

export const ISSUER_ROLE = "0x114e74f6ea3bd819998f78687bfcb11b140da08e9b7d222fa9c1f1ba1f2aa122" as const; // keccak256("ISSUER_ROLE")
export const DEFAULT_ADMIN_ROLE = "0x0000000000000000000000000000000000000000000000000000000000000000" as const;

export const IPFS_GATEWAY = process.env.NEXT_PUBLIC_IPFS_GATEWAY || "http://127.0.0.1:8080/ipfs/";

export const formatDate = (ts: bigint | number) =>
  Number(ts) === 0
    ? "—"
    : new Date(Number(ts) * 1000).toLocaleString("vi-VN", { dateStyle: "short", timeStyle: "short" });

export const shorten = (s: string, a = 6, b = 4) => (s.length > a + b + 2 ? `${s.slice(0, a)}…${s.slice(-b)}` : s);
