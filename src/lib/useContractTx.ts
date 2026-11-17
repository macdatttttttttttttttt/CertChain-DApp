"use client";

import { useState } from "react";
import { useAccount, usePublicClient, useWriteContract } from "wagmi";
import type { TransactionReceipt } from "viem";
import { registry } from "./contract";
import { toVietnameseError } from "./errors";

/**
 * Gửi giao dịch tới CertificateRegistry theo 3 bước:
 *  1. simulateContract – chạy thử để bắt lỗi (Custom Error) trước khi ký, không tốn Gas
 *  2. writeContract    – ví ký và phát tán giao dịch
 *  3. waitForReceipt   – chờ giao dịch được đóng vào khối
 */
export function useContractTx() {
  const { address } = useAccount();
  const client = usePublicClient();
  const { writeContractAsync } = useWriteContract();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [receipt, setReceipt] = useState<TransactionReceipt | null>(null);

  async function send(functionName: string, args: readonly unknown[]) {
    if (!client || !address) {
      setError("Vui lòng kết nối ví trước khi thực hiện giao dịch.");
      return null;
    }
    setPending(true);
    setError("");
    setReceipt(null);
    try {
      await client.simulateContract({ ...registry, functionName, args, account: address });
      const hash = await writeContractAsync({ ...registry, functionName, args });
      const rc = await client.waitForTransactionReceipt({ hash });
      setReceipt(rc);
      return rc;
    } catch (e) {
      setError(toVietnameseError(e));
      return null;
    } finally {
      setPending(false);
    }
  }

  return { send, pending, error, receipt, reset: () => (setError(""), setReceipt(null)) };
}
