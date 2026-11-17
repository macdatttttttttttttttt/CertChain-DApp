"use client";

import { useState } from "react";
import { CERT_TYPES } from "@/lib/contract";
import { studentHash, uploadToIPFS } from "@/lib/crypto";
import { useContractTx } from "@/lib/useContractTx";
import { useRoles } from "@/lib/useRoles";
import FileDrop from "./FileDrop";
import QRCodeBox from "./QRCodeBox";

/** Cấp văn bằng mới – chỉ dành cho ví có ISSUER_ROLE (cơ sở đào tạo). */
export default function IssuePanel() {
  const { isIssuer, issuer, isConnected, paused, refetch } = useRoles();
  const tx = useContractTx();
  const [file, setFile] = useState<File | null>(null);
  const [hash, setHash] = useState<`0x${string}` | null>(null);
  const [form, setForm] = useState({ studentId: "", dob: "", serialNo: "", certType: 0, useIpfs: false });
  const [cid, setCid] = useState("");
  const [ipfsError, setIpfsError] = useState("");
  const [uploading, setUploading] = useState(false);
  const [issued, setIssued] = useState<{ hash: string; serial: string } | null>(null);

  const sHash = form.studentId && form.dob ? studentHash(form.studentId, form.dob) : null;
  const ready = !!hash && !!sHash && !!form.serialNo.trim();

  async function submit() {
    if (!hash || !sHash || !file) return;
    setIpfsError("");
    let theCid = "";
    if (form.useIpfs) {
      try {
        setUploading(true);
        theCid = await uploadToIPFS(file);
        setCid(theCid);
      } catch (e) {
        setIpfsError(e instanceof Error ? e.message : String(e));
        setUploading(false);
        return;
      }
      setUploading(false);
    }
    const rc = await tx.send("issueCertificate", [hash, sHash, form.serialNo.trim(), form.certType, theCid]);
    if (rc) {
      setIssued({ hash, serial: form.serialNo.trim() });
      refetch();
    }
  }

  if (!isConnected)
    return <div className="card text-sm">Hãy kết nối ví của cơ sở đào tạo (góc trên bên phải) để cấp văn bằng.</div>;
  if (!isIssuer)
    return (
      <div className="card text-sm text-red-700">
        Ví hiện tại chưa được Quản trị viên cấp quyền <b>ISSUER_ROLE</b> nên không thể cấp văn bằng.
      </div>
    );

  return (
    <div className="grid gap-6 lg:grid-cols-[1.3fr_1fr]">
      <div className="card space-y-4">
        <div>
          <h2 className="text-lg font-bold text-navy-900">Cấp văn bằng mới</h2>
          <p className="text-sm text-slate-500">
            Đơn vị cấp: <b>{issuer?.name}</b> · đã cấp {issuer?.issuedCount ?? 0} văn bằng
          </p>
        </div>
        {paused && <p className="text-sm font-semibold text-red-600">Hệ thống đang tạm dừng ghi dữ liệu.</p>}

        <FileDrop
          hint="Tệp PDF văn bằng đã ký số của nhà trường"
          onHashed={(f, h) => {
            setFile(f);
            setHash(h);
            setIssued(null);
            tx.reset();
          }}
        />
        {hash && (
          <p className="mono break-all rounded-lg bg-slate-100 p-2 text-xs">
            SHA-256: <b>{hash}</b>
          </p>
        )}

        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="label">Mã sinh viên</label>
            <input
              className="input"
              value={form.studentId}
              onChange={(e) => setForm({ ...form, studentId: e.target.value })}
              placeholder="2231480001"
            />
          </div>
          <div>
            <label className="label">Ngày sinh</label>
            <input
              className="input"
              type="date"
              value={form.dob}
              onChange={(e) => setForm({ ...form, dob: e.target.value })}
            />
          </div>
          <div>
            <label className="label">Số hiệu văn bằng</label>
            <input
              className="input"
              value={form.serialNo}
              onChange={(e) => setForm({ ...form, serialNo: e.target.value })}
              placeholder="HPU-2026-000125"
            />
          </div>
          <div>
            <label className="label">Loại văn bằng</label>
            <select
              className="input"
              value={form.certType}
              onChange={(e) => setForm({ ...form, certType: Number(e.target.value) })}
            >
              {CERT_TYPES.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>
        </div>
        {sHash && (
          <p className="mono break-all text-xs text-slate-500">
            Định danh SV lưu trên chuỗi (keccak256): {sHash}
          </p>
        )}
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={form.useIpfs}
            onChange={(e) => setForm({ ...form, useIpfs: e.target.checked })}
          />
          Lưu bản PDF lên IPFS (cần IPFS node đang chạy)
        </label>

        <button className="btn-gold w-full" disabled={!ready || tx.pending || uploading || paused} onClick={submit}>
          {uploading ? "Đang tải lên IPFS…" : tx.pending ? "Đang ký & ghi lên Blockchain…" : "Ký và ghi văn bằng lên Blockchain"}
        </button>
        {ipfsError && <p className="text-sm font-semibold text-red-600">{ipfsError}</p>}
        {tx.error && <p className="text-sm font-semibold text-red-600">{tx.error}</p>}
      </div>

      <div className="card">
        <h3 className="font-bold text-navy-900">Kết quả giao dịch</h3>
        {!issued && <p className="mt-2 text-sm text-slate-500">Chưa có giao dịch nào trong phiên này.</p>}
        {issued && tx.receipt && (
          <div className="mt-3 space-y-3 text-sm" data-testid="issue-success">
            <p className="font-semibold text-emerald-700">✅ Đã ghi văn bằng {issued.serial} lên Blockchain</p>
            <dl className="grid grid-cols-[7rem_1fr] gap-y-1">
              <dt className="text-slate-500">Tx hash</dt>
              <dd className="mono break-all text-xs">{tx.receipt.transactionHash}</dd>
              <dt className="text-slate-500">Khối</dt>
              <dd>#{tx.receipt.blockNumber.toString()}</dd>
              <dt className="text-slate-500">Gas sử dụng</dt>
              <dd>{tx.receipt.gasUsed.toString()}</dd>
              {cid && (
                <>
                  <dt className="text-slate-500">IPFS CID</dt>
                  <dd className="mono break-all text-xs">{cid}</dd>
                </>
              )}
            </dl>
            <div className="flex justify-center pt-2">
              <QRCodeBox
                value={`${window.location.origin}/?hash=${issued.hash}`}
                caption="In mã QR này lên văn bằng để nhà tuyển dụng quét xác minh"
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
