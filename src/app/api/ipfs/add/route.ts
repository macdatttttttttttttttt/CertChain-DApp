import { NextResponse } from "next/server";

/** Proxy tải tệp lên IPFS node (Kubo) – tránh lỗi CORS khi gọi trực tiếp từ trình duyệt. */
export async function POST(request: Request) {
  try {
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Không tìm thấy tệp cần tải lên." }, { status: 400 });
    }
    const body = new FormData();
    body.append("file", file, file.name);
    const api = process.env.IPFS_API_URL || "http://127.0.0.1:5001/api/v0";
    const res = await fetch(`${api}/add?cid-version=1&pin=true`, { method: "POST", body });
    const text = await res.text();
    if (!res.ok) {
      return NextResponse.json({ error: `IPFS trả về HTTP ${res.status}: ${text}` }, { status: 502 });
    }
    return NextResponse.json({ cid: JSON.parse(text).Hash });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Lỗi không xác định";
    return NextResponse.json(
      { error: `Không kết nối được IPFS node (${msg}). Hãy chạy IPFS Desktop / Kubo hoặc bỏ chọn lưu IPFS.` },
      { status: 502 }
    );
  }
}
