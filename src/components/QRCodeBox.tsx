"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";

export default function QRCodeBox({ value, caption }: { value: string; caption?: string }) {
  const [src, setSrc] = useState("");
  useEffect(() => {
    QRCode.toDataURL(value, { width: 220, margin: 1, color: { dark: "#0B1D3A" } }).then(setSrc);
  }, [value]);
  if (!src) return null;
  return (
    <div className="flex flex-col items-center gap-2">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt="QR xác minh" className="h-40 w-40 rounded-lg border border-slate-200" />
      {caption && <p className="max-w-[12rem] text-center text-xs text-slate-500">{caption}</p>}
      <a href={src} download="qr-xac-minh-van-bang.png" className="text-xs font-semibold text-navy-700 underline">
        Tải mã QR
      </a>
    </div>
  );
}
