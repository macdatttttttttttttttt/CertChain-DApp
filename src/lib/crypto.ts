import { keccak256, toBytes } from "viem";

/**
 * Tính SHA-256 của tệp văn bằng ngay trong bộ nhớ trình duyệt (Web Crypto API).
 * Tệp gốc KHÔNG bị gửi tới bất kỳ máy chủ nào trong bước này.
 */
export async function sha256File(file: File): Promise<`0x${string}`> {
  const buf = await file.arrayBuffer();
  const digest = await crypto.subtle.digest("SHA-256", buf);
  return `0x${Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")}`;
}

/**
 * Định danh sinh viên dạng ẩn danh: keccak256("MÃSV|YYYY-MM-DD").
 * Trên chuỗi chỉ lưu giá trị băm, không lưu họ tên / mã sinh viên dạng rõ.
 */
export function studentHash(studentId: string, dob: string): `0x${string}` {
  return keccak256(toBytes(`${studentId.trim().toUpperCase()}|${dob.trim()}`));
}

export const isBytes32 = (s: string) => /^0x[0-9a-fA-F]{64}$/.test(s.trim());

/** Tải tệp lên IPFS thông qua API route nội bộ (/api/ipfs/add) */
export async function uploadToIPFS(file: File): Promise<string> {
  const fd = new FormData();
  fd.append("file", file, file.name);
  const res = await fetch("/api/ipfs/add", { method: "POST", body: fd });
  const json = await res.json();
  if (!res.ok || !json.cid) throw new Error(json.error || `IPFS lỗi HTTP ${res.status}`);
  return json.cid as string;
}
