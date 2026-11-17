"use client";

import { useEffect, useState } from "react";
import { usePublicClient } from "wagmi";
import { CertStatus, certTypeLabel, formatDate, IPFS_GATEWAY, registry, type CertificateView } from "@/lib/contract";
import { studentHash } from "@/lib/crypto";
import QRCodeBox from "./QRCodeBox";

type Props = {
  cert: CertificateView;
  issuerName: string;
  revokeReason: string;
  queried: string; // mã băm hoặc số hiệu đã tra cứu
};

/** Thẻ kết quả xác minh: HỢP LỆ / ĐÃ THU HỒI / KHÔNG TỒN TẠI */
export default function CertificateResult({ cert, issuerName, revokeReason, queried }: Props) {
  const client = usePublicClient();
  const [tx, setTx] = useState<{ hash: string; block: bigint } | null>(null);
  const [sid, setSid] = useState("");
  const [dob, setDob] = useState("");
  const [match, setMatch] = useState<boolean | null>(null);

  // Truy vết giao dịch đã cấp văn bằng từ nhật ký sự kiện (event log)
  useEffect(() => {
    setTx(null);
    setMatch(null);
    if (!client || Number(cert.status) === CertStatus.NONE) return;
    client
      .getContractEvents({
        ...registry,
        eventName: "CertificateIssued",
        args: { certHash: cert.certHash },
        fromBlock: 0n,
      })
      .then((logs) => {
        const l = logs[0];
        if (l) setTx({ hash: l.transactionHash, block: l.blockNumber });
      })
      .catch(() => {});
  }, [client, cert.certHash, cert.status]);

  if (Number(cert.status) === CertStatus.NONE) {
    return (
      <div className="rounded-2xl border-2 border-slate-300 bg-slate-50 p-6" data-testid="result-none">
        <div className="flex items-center gap-3">
          <span className="text-4xl">⚠️</span>
          <div>
            <h3 className="text-xl font-bold text-slate-700">KHÔNG TÌM THẤY TRÊN BLOCKCHAIN</h3>
            <p className="text-sm text-slate-600">
              Văn bằng chưa từng được cấp, hoặc tệp đã bị chỉnh sửa so với bản gốc (mã băm không khớp).
            </p>
          </div>
        </div>
        <p className="mono mt-3 break-all text-xs text-slate-500">Giá trị tra cứu: {queried}</p>
      </div>
    );
  }

  const valid = Number(cert.status) === CertStatus.VALID;
  const verifyUrl =
    typeof window !== "undefined" ? `${window.location.origin}/?hash=${cert.certHash}` : `/?hash=${cert.certHash}`;

  return (
    <div
      className={`rounded-2xl border-2 p-6 ${valid ? "border-emerald-500 bg-emerald-50" : "border-red-500 bg-red-50"}`}
      data-testid={valid ? "result-valid" : "result-revoked"}
    >
      <div className="flex items-center gap-3">
        <span className="text-4xl">{valid ? "✅" : "⛔"}</span>
        <div>
          <h3 className={`text-xl font-bold ${valid ? "text-emerald-700" : "text-red-700"}`}>
            {valid ? "VĂN BẰNG HỢP LỆ" : "VĂN BẰNG ĐÃ BỊ THU HỒI"}
          </h3>
          <p className="text-sm text-slate-600">
            {valid
              ? "Mã băm tệp trùng khớp với bản ghi bất biến trên Blockchain."
              : `Lý do thu hồi: ${revokeReason} (lúc ${formatDate(cert.revokedAt)})`}
          </p>
        </div>
      </div>

      <div className="mt-5 grid gap-6 md:grid-cols-[1fr_auto]">
        <dl className="grid grid-cols-[10rem_1fr] gap-y-2 text-sm">
          <dt className="text-slate-500">Số hiệu văn bằng</dt>
          <dd className="font-semibold">{cert.serialNo}</dd>
          <dt className="text-slate-500">Loại</dt>
          <dd>{certTypeLabel(Number(cert.certType))}</dd>
          <dt className="text-slate-500">Đơn vị cấp</dt>
          <dd>
            <span className="font-semibold">{issuerName || "(không rõ)"}</span>
            <span className="mono block break-all text-xs text-slate-500">{cert.issuer}</span>
          </dd>
          <dt className="text-slate-500">Thời điểm ghi sổ</dt>
          <dd>{formatDate(cert.issuedAt)}</dd>
          <dt className="text-slate-500">Mã băm SHA-256</dt>
          <dd className="mono break-all text-xs">{cert.certHash}</dd>
          <dt className="text-slate-500">Định danh SV (băm)</dt>
          <dd className="mono break-all text-xs">{cert.studentHash}</dd>
          {tx && (
            <>
              <dt className="text-slate-500">Giao dịch cấp</dt>
              <dd className="mono break-all text-xs">
                {tx.hash} <span className="text-slate-500">(khối #{tx.block.toString()})</span>
              </dd>
            </>
          )}
          {cert.ipfsCid && (
            <>
              <dt className="text-slate-500">Bản gốc (IPFS)</dt>
              <dd>
                <a
                  className="mono break-all text-xs text-navy-700 underline"
                  href={IPFS_GATEWAY + cert.ipfsCid}
                  target="_blank"
                >
                  {cert.ipfsCid}
                </a>
              </dd>
            </>
          )}
        </dl>
        <QRCodeBox value={verifyUrl} caption="Quét để xác minh lại văn bằng này" />
      </div>

      <div className="mt-5 rounded-xl bg-white/70 p-4">
        <p className="text-sm font-semibold">Đối chiếu chủ sở hữu văn bằng</p>
        <p className="text-xs text-slate-500">
          Nhập mã sinh viên và ngày sinh của ứng viên – hệ thống băm cục bộ và so sánh với định danh trên chuỗi.
        </p>
        <div className="mt-2 flex flex-wrap gap-2">
          <input
            className="input max-w-[12rem]"
            placeholder="Mã sinh viên"
            value={sid}
            onChange={(e) => setSid(e.target.value)}
          />
          <input className="input max-w-[11rem]" type="date" value={dob} onChange={(e) => setDob(e.target.value)} />
          <button
            className="btn-ghost"
            disabled={!sid || !dob}
            onClick={() => setMatch(studentHash(sid, dob) === cert.studentHash)}
          >
            Đối chiếu
          </button>
          {match !== null && (
            <span className={`self-center text-sm font-semibold ${match ? "text-emerald-700" : "text-red-700"}`}>
              {match ? "✔ Trùng khớp chủ sở hữu" : "✘ Không khớp chủ sở hữu"}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
