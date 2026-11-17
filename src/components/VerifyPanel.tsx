"use client";

import { useCallback, useEffect, useState } from "react";
import { usePublicClient } from "wagmi";
import { registry, type CertificateView } from "@/lib/contract";
import { isBytes32 } from "@/lib/crypto";
import { toVietnameseError } from "@/lib/errors";
import FileDrop from "./FileDrop";
import CertificateResult from "./CertificateResult";

type Result = { cert: CertificateView; issuerName: string; revokeReason: string; queried: string };
type Mode = "file" | "serial" | "hash";

/**
 * Cổng xác minh công khai dành cho nhà tuyển dụng / đơn vị tiếp nhận hồ sơ.
 * Chỉ gọi hàm view nên KHÔNG cần ví và KHÔNG tốn phí Gas.
 */
export default function VerifyPanel({ initialHash, initialSerial }: { initialHash?: string; initialSerial?: string }) {
  const client = usePublicClient();
  const [mode, setMode] = useState<Mode>(initialSerial ? "serial" : initialHash ? "hash" : "file");
  const [serial, setSerial] = useState(initialSerial ?? "");
  const [hashInput, setHashInput] = useState(initialHash ?? "");
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const verifyHash = useCallback(
    async (hash: `0x${string}`) => {
      if (!client) return;
      setLoading(true);
      setError("");
      try {
        const [cert, issuerName, revokeReason] = (await client.readContract({
          ...registry,
          functionName: "verifyCertificate",
          args: [hash],
        })) as [CertificateView, string, string];
        setResult({ cert: { ...cert, certHash: cert.certHash === ("0x" + "0".repeat(64)) ? hash : cert.certHash }, issuerName, revokeReason, queried: hash });
      } catch (e) {
        setError(toVietnameseError(e));
      } finally {
        setLoading(false);
      }
    },
    [client]
  );

  const verifySerial = useCallback(
    async (s: string) => {
      if (!client || !s.trim()) return;
      setLoading(true);
      setError("");
      try {
        const [cert, issuerName, revokeReason] = (await client.readContract({
          ...registry,
          functionName: "verifyBySerial",
          args: [s.trim()],
        })) as [CertificateView, string, string];
        setResult({ cert, issuerName, revokeReason, queried: s.trim() });
      } catch (e) {
        setError(toVietnameseError(e));
      } finally {
        setLoading(false);
      }
    },
    [client]
  );

  // Tự động xác minh khi mở liên kết từ mã QR (?hash=... hoặc ?serial=...)
  useEffect(() => {
    if (initialHash && isBytes32(initialHash)) verifyHash(initialHash as `0x${string}`);
    else if (initialSerial) verifySerial(initialSerial);
  }, [initialHash, initialSerial, verifyHash, verifySerial]);

  const tabs: { id: Mode; label: string }[] = [
    { id: "file", label: "Tải tệp văn bằng" },
    { id: "serial", label: "Nhập số hiệu" },
    { id: "hash", label: "Nhập mã băm / QR" },
  ];

  return (
    <div className="space-y-6">
      <div className="card">
        <h2 className="text-lg font-bold text-navy-900">Xác minh văn bằng / chứng chỉ</h2>
        <p className="text-sm text-slate-500">
          Dành cho nhà tuyển dụng, cơ quan tiếp nhận hồ sơ. Không cần ví, không mất phí – dữ liệu đọc trực tiếp từ
          Smart Contract.
        </p>

        <div className="mt-4 flex gap-2">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => {
                setMode(t.id);
                setResult(null);
                setError("");
              }}
              className={`rounded-full px-4 py-1.5 text-sm font-semibold ${
                mode === t.id ? "bg-navy-900 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="mt-4">
          {mode === "file" && (
            <FileDrop
              hint="Tệp PDF ứng viên nộp – hệ thống tính SHA-256 rồi đối chiếu với Blockchain"
              onHashed={(_, h) => verifyHash(h)}
            />
          )}
          {mode === "serial" && (
            <form
              className="flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                verifySerial(serial);
              }}
            >
              <input
                className="input"
                placeholder="Ví dụ: HPU-2026-000123"
                value={serial}
                onChange={(e) => setSerial(e.target.value)}
              />
              <button className="btn-primary" disabled={!serial.trim() || loading}>
                Xác minh
              </button>
            </form>
          )}
          {mode === "hash" && (
            <form
              className="flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                if (!isBytes32(hashInput)) return setError("Mã băm phải có dạng 0x + 64 ký tự hexa.");
                verifyHash(hashInput.trim() as `0x${string}`);
              }}
            >
              <input
                className="input mono"
                placeholder="0x…(64 ký tự)"
                value={hashInput}
                onChange={(e) => setHashInput(e.target.value)}
              />
              <button className="btn-primary" disabled={!hashInput || loading}>
                Xác minh
              </button>
            </form>
          )}
        </div>
        {loading && <p className="mt-3 text-sm text-slate-500">Đang truy vấn Smart Contract…</p>}
        {error && <p className="mt-3 text-sm font-semibold text-red-600">{error}</p>}
      </div>

      {result && <CertificateResult {...result} />}
    </div>
  );
}
