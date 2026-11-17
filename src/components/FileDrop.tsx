"use client";

import { useRef, useState } from "react";
import { sha256File } from "@/lib/crypto";

type Props = {
  onHashed: (file: File, hash: `0x${string}`) => void;
  hint?: string;
};

/** Vùng kéo – thả tệp văn bằng. Mã băm SHA-256 được tính cục bộ trong trình duyệt. */
export default function FileDrop({ onHashed, hint }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [drag, setDrag] = useState(false);
  const [busy, setBusy] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [ms, setMs] = useState<number | null>(null);

  async function handle(f: File | undefined) {
    if (!f) return;
    setBusy(true);
    const t = performance.now();
    const hash = await sha256File(f);
    setMs(performance.now() - t);
    setFile(f);
    setBusy(false);
    onHashed(f, hash);
  }

  return (
    <div
      onClick={() => inputRef.current?.click()}
      onDragOver={(e) => {
        e.preventDefault();
        setDrag(true);
      }}
      onDragLeave={() => setDrag(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDrag(false);
        handle(e.dataTransfer.files?.[0]);
      }}
      className={`cursor-pointer rounded-xl border-2 border-dashed p-6 text-center transition ${
        drag ? "border-gold-500 bg-amber-50" : "border-slate-300 bg-slate-50 hover:border-navy-700"
      }`}
    >
      <input
        ref={inputRef}
        type="file"
        accept=".pdf,.png,.jpg,.jpeg"
        className="hidden"
        data-testid="file-input"
        onChange={(e) => handle(e.target.files?.[0])}
      />
      <div className="text-3xl">📄</div>
      {busy ? (
        <p className="mt-2 text-sm">Đang tính mã băm SHA-256…</p>
      ) : file ? (
        <>
          <p className="mt-2 font-semibold">{file.name}</p>
          <p className="text-xs text-slate-500">
            {(file.size / 1024).toFixed(1)} KB · băm cục bộ trong {ms?.toFixed(1)} ms · tệp không rời khỏi máy
          </p>
        </>
      ) : (
        <>
          <p className="mt-2 font-semibold">Kéo – thả tệp văn bằng (PDF) vào đây</p>
          <p className="text-xs text-slate-500">{hint ?? "hoặc bấm để chọn tệp"}</p>
        </>
      )}
    </div>
  );
}
