"use client";

import { useState } from "react";
import { isAddress } from "viem";
import { useReadContracts } from "wagmi";
import { formatDate, registry, type IssuerView } from "@/lib/contract";
import { useContractTx } from "@/lib/useContractTx";
import { useRoles } from "@/lib/useRoles";

/** Quản trị hệ thống: cấp / thu hồi quyền đơn vị cấp văn bằng, ngắt mạch khẩn cấp, thống kê. */
export default function AdminPanel() {
  const { isAdmin, isConnected, paused, refetch: refetchRoles } = useRoles();
  const tx = useContractTx();
  const [addr, setAddr] = useState("");
  const [name, setName] = useState("");

  const { data, refetch } = useReadContracts({
    contracts: [
      { ...registry, functionName: "getIssuers" },
      { ...registry, functionName: "totalCertificates" },
      { ...registry, functionName: "totalRevoked" },
    ],
  });
  const [accounts, infos] = (data?.[0]?.result as [string[], IssuerView[]] | undefined) ?? [[], []];
  const total = Number((data?.[1]?.result as bigint | undefined) ?? 0n);
  const revoked = Number((data?.[2]?.result as bigint | undefined) ?? 0n);

  async function run(fn: string, args: unknown[]) {
    const rc = await tx.send(fn, args);
    if (rc) {
      refetch();
      refetchRoles();
    }
    return rc;
  }

  const stats = [
    { label: "Tổng văn bằng đã cấp", value: total },
    { label: "Đang hợp lệ", value: total - revoked },
    { label: "Đã thu hồi", value: revoked },
    { label: "Đơn vị cấp đang hoạt động", value: infos.filter((i) => i.active).length },
  ];

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((s) => (
          <div key={s.label} className="card">
            <p className="text-3xl font-bold text-navy-900">{s.value}</p>
            <p className="text-sm text-slate-500">{s.label}</p>
          </div>
        ))}
      </div>

      {!isConnected || !isAdmin ? (
        <div className="card text-sm text-slate-600">
          Chỉ ví giữ <b>DEFAULT_ADMIN_ROLE</b> mới thực hiện được các thao tác quản trị. Thống kê ở trên là công khai.
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="card space-y-3">
            <h2 className="text-lg font-bold text-navy-900">Cấp quyền đơn vị cấp văn bằng</h2>
            <div>
              <label className="label">Địa chỉ ví của cơ sở đào tạo</label>
              <input className="input mono" placeholder="0x…" value={addr} onChange={(e) => setAddr(e.target.value)} />
            </div>
            <div>
              <label className="label">Tên cơ sở đào tạo</label>
              <input
                className="input"
                placeholder="Trường Đại học …"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <button
              className="btn-primary"
              disabled={!isAddress(addr) || !name.trim() || tx.pending}
              onClick={async () => {
                if (await run("addIssuer", [addr, name.trim()])) {
                  setAddr("");
                  setName("");
                }
              }}
            >
              Cấp quyền ISSUER
            </button>
          </div>

          <div className="card space-y-3">
            <h2 className="text-lg font-bold text-navy-900">Ngắt mạch khẩn cấp</h2>
            <p className="text-sm text-slate-500">
              Khi phát hiện khóa riêng của một đơn vị bị lộ hoặc sự cố an ninh, Quản trị viên tạm dừng mọi thao tác ghi
              (cấp / thu hồi). Chức năng xác minh vẫn hoạt động bình thường.
            </p>
            <p className="text-sm">
              Trạng thái:{" "}
              <b className={paused ? "text-red-600" : "text-emerald-700"}>{paused ? "ĐANG TẠM DỪNG" : "HOẠT ĐỘNG"}</b>
            </p>
            <button
              className={paused ? "btn-primary" : "btn-danger"}
              disabled={tx.pending}
              onClick={() => run(paused ? "unpause" : "pause", [])}
            >
              {paused ? "Mở lại hệ thống (unpause)" : "Tạm dừng hệ thống (pause)"}
            </button>
          </div>
        </div>
      )}
      {tx.error && <p className="text-sm font-semibold text-red-600">{tx.error}</p>}

      <div className="card">
        <h2 className="text-lg font-bold text-navy-900">Danh sách đơn vị cấp văn bằng</h2>
        <table className="mt-3 w-full text-left text-sm">
          <thead className="bg-slate-100 text-xs uppercase text-slate-500">
            <tr>
              <th className="p-2">Tên đơn vị</th>
              <th className="p-2">Địa chỉ ví</th>
              <th className="p-2">Đã cấp</th>
              <th className="p-2">Ngày cấp quyền</th>
              <th className="p-2">Trạng thái</th>
              {isAdmin && <th className="p-2"></th>}
            </tr>
          </thead>
          <tbody>
            {accounts.map((a, i) => (
              <tr key={a} className="border-b border-slate-100">
                <td className="p-2 font-semibold">{infos[i].name}</td>
                <td className="mono p-2 text-xs">{a}</td>
                <td className="p-2">{infos[i].issuedCount}</td>
                <td className="p-2">{formatDate(infos[i].registeredAt)}</td>
                <td className="p-2">
                  {infos[i].active ? (
                    <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-700">
                      Đang hoạt động
                    </span>
                  ) : (
                    <span className="rounded-full bg-slate-200 px-2 py-0.5 text-xs font-semibold text-slate-600">
                      Đã thu hồi quyền
                    </span>
                  )}
                </td>
                {isAdmin && (
                  <td className="p-2 text-right">
                    {infos[i].active ? (
                      <button className="btn-ghost text-red-600" disabled={tx.pending} onClick={() => run("removeIssuer", [a])}>
                        Thu hồi quyền
                      </button>
                    ) : (
                      <button
                        className="btn-ghost"
                        disabled={tx.pending}
                        onClick={() => run("addIssuer", [a, infos[i].name])}
                      >
                        Cấp lại quyền
                      </button>
                    )}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
