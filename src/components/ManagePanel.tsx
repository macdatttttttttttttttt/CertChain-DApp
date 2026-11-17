"use client";

import { useCallback, useEffect, useState } from "react";
import { usePublicClient } from "wagmi";
import { CertStatus, certTypeLabel, formatDate, registry, shorten, type CertificateView } from "@/lib/contract";
import { useContractTx } from "@/lib/useContractTx";
import { useRoles } from "@/lib/useRoles";

type Row = { cert: CertificateView; reason: string; tx: string };

/** Danh sách văn bằng đã cấp (đọc từ Event Log) và chức năng thu hồi. */
export default function ManagePanel() {
  const client = usePublicClient();
  const { address, isAdmin, isIssuer, isConnected } = useRoles();
  const tx = useContractTx();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);
  const [target, setTarget] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [filter, setFilter] = useState("");

  const load = useCallback(async () => {
    if (!client || !address) return;
    setLoading(true);
    const logs = await client.getContractEvents({
      ...registry,
      eventName: "CertificateIssued",
      args: isAdmin ? {} : { issuer: address },
      fromBlock: 0n,
    });
    const out: Row[] = [];
    for (const l of logs.reverse()) {
      const certHash = (l.args as { certHash: `0x${string}` }).certHash;
      const [cert, , r] = (await client.readContract({
        ...registry,
        functionName: "verifyCertificate",
        args: [certHash],
      })) as [CertificateView, string, string];
      out.push({ cert, reason: r, tx: l.transactionHash });
    }
    setRows(out);
    setLoading(false);
  }, [client, address, isAdmin]);

  useEffect(() => {
    if (isAdmin || isIssuer) load();
  }, [isAdmin, isIssuer, load]);

  if (!isConnected) return <div className="card text-sm">Hãy kết nối ví của đơn vị cấp hoặc Quản trị viên.</div>;
  if (!isAdmin && !isIssuer)
    return <div className="card text-sm text-red-700">Ví hiện tại không có quyền quản lý văn bằng.</div>;

  const shown = rows.filter((r) => r.cert.serialNo.toLowerCase().includes(filter.toLowerCase()));

  return (
    <div className="card">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-navy-900">Quản lý & thu hồi văn bằng</h2>
          <p className="text-sm text-slate-500">
            {isAdmin ? "Quản trị viên: hiển thị toàn bộ văn bằng trên hệ thống" : "Văn bằng do đơn vị của bạn cấp"} ·{" "}
            {rows.length} bản ghi
          </p>
        </div>
        <div className="flex gap-2">
          <input className="input w-56" placeholder="Lọc theo số hiệu…" value={filter} onChange={(e) => setFilter(e.target.value)} />
          <button className="btn-ghost" onClick={load} disabled={loading}>
            {loading ? "Đang tải…" : "Làm mới"}
          </button>
        </div>
      </div>

      <div className="mt-4 overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-100 text-xs uppercase text-slate-500">
            <tr>
              <th className="p-2">Số hiệu</th>
              <th className="p-2">Loại</th>
              <th className="p-2">Mã băm</th>
              <th className="p-2">Ngày cấp</th>
              <th className="p-2">Trạng thái</th>
              <th className="p-2"></th>
            </tr>
          </thead>
          <tbody>
            {shown.map((r) => {
              const valid = Number(r.cert.status) === CertStatus.VALID;
              return (
                <tr key={r.cert.certHash} className="border-b border-slate-100 align-top">
                  <td className="p-2 font-semibold">{r.cert.serialNo}</td>
                  <td className="p-2">{certTypeLabel(Number(r.cert.certType))}</td>
                  <td className="mono p-2 text-xs" title={r.cert.certHash}>
                    {shorten(r.cert.certHash, 10, 6)}
                  </td>
                  <td className="p-2">{formatDate(r.cert.issuedAt)}</td>
                  <td className="p-2">
                    {valid ? (
                      <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-700">
                        Hợp lệ
                      </span>
                    ) : (
                      <span
                        className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-700"
                        title={r.reason}
                      >
                        Đã thu hồi
                      </span>
                    )}
                    {!valid && <p className="mt-1 max-w-xs text-xs text-slate-500">{r.reason}</p>}
                  </td>
                  <td className="p-2 text-right">
                    {valid && target !== r.cert.certHash && (
                      <button className="btn-ghost text-red-600" onClick={() => (setTarget(r.cert.certHash), setReason(""))}>
                        Thu hồi
                      </button>
                    )}
                    {target === r.cert.certHash && (
                      <div className="flex flex-col gap-2">
                        <input
                          className="input w-64"
                          placeholder="Lý do thu hồi (bắt buộc)"
                          value={reason}
                          onChange={(e) => setReason(e.target.value)}
                        />
                        <div className="flex justify-end gap-2">
                          <button className="btn-ghost" onClick={() => setTarget(null)}>
                            Hủy
                          </button>
                          <button
                            className="btn-danger"
                            disabled={!reason.trim() || tx.pending}
                            onClick={async () => {
                              const rc = await tx.send("revokeCertificate", [r.cert.certHash, reason.trim()]);
                              if (rc) {
                                setTarget(null);
                                load();
                              }
                            }}
                          >
                            {tx.pending ? "Đang ký…" : "Xác nhận thu hồi"}
                          </button>
                        </div>
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
            {!loading && shown.length === 0 && (
              <tr>
                <td colSpan={6} className="p-4 text-center text-slate-500">
                  Chưa có văn bằng nào.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {tx.error && <p className="mt-3 text-sm font-semibold text-red-600">{tx.error}</p>}
      <p className="mt-4 text-xs text-slate-500">
        Lưu ý: thu hồi không xóa dữ liệu – bản ghi chuyển sang trạng thái REVOKED kèm lý do và thời điểm, mọi bên vẫn tra
        cứu được lịch sử. Tx hash gần nhất: {rows[0] ? shorten(rows[0].tx, 10, 6) : "—"}
      </p>
    </div>
  );
}
