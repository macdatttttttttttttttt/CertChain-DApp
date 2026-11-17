"use client";

import { useAccount, useReadContracts } from "wagmi";
import { registry, ISSUER_ROLE, DEFAULT_ADMIN_ROLE, IS_DEPLOYED, type IssuerView } from "./contract";
import { zeroAddress } from "viem";

/** Đọc vai trò của ví đang kết nối: Admin / Issuer / Khách */
export function useRoles() {
  const { address, isConnected } = useAccount();
  const acc = address ?? zeroAddress;
  const { data, refetch, isLoading } = useReadContracts({
    contracts: [
      { ...registry, functionName: "hasRole", args: [DEFAULT_ADMIN_ROLE, acc] },
      { ...registry, functionName: "hasRole", args: [ISSUER_ROLE, acc] },
      { ...registry, functionName: "getIssuer", args: [acc] },
      { ...registry, functionName: "paused" },
    ],
    query: { enabled: IS_DEPLOYED },
  });
  return {
    address,
    isConnected,
    isAdmin: isConnected && data?.[0]?.result === true,
    isIssuer: isConnected && data?.[1]?.result === true,
    issuer: data?.[2]?.result as IssuerView | undefined,
    paused: data?.[3]?.result === true,
    isLoading,
    refetch,
  };
}
