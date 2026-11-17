# 🎓 CertChain – Xác minh văn bằng / chứng chỉ đại học bằng Blockchain

Ứng dụng phi tập trung (DApp) cho phép **cơ sở đào tạo** ghi văn bằng lên Blockchain, **nhà tuyển dụng** xác minh
tức thì, miễn phí, không cần liên hệ nhà trường, và **cơ quan quản lý** kiểm soát danh sách đơn vị được quyền cấp bằng.

> Đề tài bài tập lớn học phần **Công nghệ Blockchain** – Khoa Công nghệ Thông tin, Trường Đại học Hải Phòng.

## 🏗 Kiến trúc

```
┌──────────────────────────┐   SHA-256 (Web Crypto, tại trình duyệt)   ┌───────────────────────────┐
│  Tệp PDF văn bằng gốc    │ ────────────────────────────────────────▶ │ certHash (bytes32)        │
└──────────────────────────┘                                            └─────────────┬─────────────┘
          │ (tùy chọn) IPFS → CID                                                     │
          ▼                                                                           ▼
┌──────────────────────────┐      issueCertificate / revokeCertificate      ┌───────────────────────────┐
│ Next.js DApp + wagmi/viem│ ───────────────────────────────────────────▶   │ CertificateRegistry.sol   │
│ (Cấp / Thu hồi / Xác minh)│ ◀─────────── verifyCertificate (view, 0 gas) ── │ (EVM – Hardhat / Sepolia) │
└──────────────────────────┘                                                └───────────────────────────┘
```

* **On-chain:** mã băm SHA-256 của tệp, mã băm định danh sinh viên `keccak256(MãSV|NgàySinh)`, số hiệu văn bằng,
  đơn vị cấp, thời điểm cấp, trạng thái (VALID / REVOKED), lý do thu hồi, CID IPFS (tùy chọn).
* **Off-chain:** tệp PDF gốc do nhà trường / sinh viên giữ, hoặc lưu trên IPFS.
* **Phân quyền (OpenZeppelin AccessControl):** `DEFAULT_ADMIN_ROLE` (Bộ GD&ĐT) → cấp/thu hồi `ISSUER_ROLE` (trường).
* **Ngắt mạch khẩn cấp (Pausable):** tạm dừng ghi, xác minh vẫn hoạt động.

## 🛠 Công nghệ

| Lớp | Công nghệ |
|---|---|
| Smart Contract | Solidity 0.8.24, OpenZeppelin 5 (AccessControl, Pausable), Hardhat, Ethers v6 |
| Kiểm thử | Mocha/Chai, hardhat-network-helpers, hardhat-gas-reporter, solidity-coverage |
| Frontend | Next.js 14 (App Router), React 18, Tailwind CSS, wagmi v2, viem, qrcode |
| Mật mã | Web Crypto API (SHA-256), keccak256 |
| Lưu trữ tệp | IPFS (Kubo / IPFS Desktop) – tùy chọn |

## 📁 Cấu trúc thư mục

```
CertChain-DApp/
├── contracts/CertificateRegistry.sol   # Smart Contract
├── test/CertificateRegistry.test.ts    # 25 ca kiểm thử
├── scripts/deploy.ts                   # Triển khai + cấp quyền 2 đơn vị mẫu + xuất ABI cho frontend
├── scripts/seed.ts                     # Nạp 4 văn bằng mẫu (1 văn bằng bị thu hồi)
├── scripts/start.js                    # Chạy toàn bộ dự án bằng một lệnh
├── start.bat / start.sh                # Nút bấm khởi chạy cho Windows / macOS, Linux
├── samples/                            # PDF văn bằng mẫu (gồm 1 tệp giả mạo để demo)
├── src/app/                            # Next.js App Router (trang chính + API proxy IPFS)
├── src/components/                     # VerifyPanel, IssuePanel, ManagePanel, AdminPanel, ...
├── src/lib/                            # wagmi config, băm SHA-256, ABI, xử lý lỗi
└── hardhat.config.ts
```

## ⚡ Chạy nhanh bằng một nút bấm

Yêu cầu duy nhất: cài **[Node.js 18 trở lên](https://nodejs.org)**.

1. Tải mã nguồn: `git clone https://github.com/macdatttttttttttttttt/CertChain-DApp.git` hoặc **Code → Download ZIP** rồi giải nén.
2. Chạy:
   * **Windows:** nhấp đúp tệp **`start.bat`**
   * **macOS / Linux:** `./start.sh` (hoặc `npm run demo`)

Script tự động: cài thư viện (lần đầu ~2–5 phút) → chạy mạng Blockchain cục bộ → triển khai Smart Contract
→ nạp văn bằng mẫu → chạy giao diện và **mở trình duyệt** tại `http://localhost:3000`.
Nhấn `Ctrl + C` để dừng tất cả. Nhật ký chạy nằm trong thư mục `.logs/`.

## 🚀 Cài đặt & chạy thủ công

Yêu cầu: **Node.js ≥ 18**, (tùy chọn) MetaMask, (tùy chọn) IPFS Desktop.

```bash
npm install
npm run compile
npm test                 # 25 ca kiểm thử
npm run test:gas         # kèm báo cáo chi phí Gas
npm run coverage         # độ bao phủ mã nguồn
```

Chạy mạng Blockchain cục bộ (giữ cửa sổ này mở):

```bash
npx hardhat node
```

Mở cửa sổ thứ hai:

```bash
npm run deploy:local     # triển khai contract, ghi src/contracts/deployment.json
npm run seed:local       # nạp văn bằng mẫu
npm run dev              # mở http://localhost:3000
```

### Tài khoản demo (tài khoản mặc định công khai của Hardhat – chỉ dùng cho mạng local)

| Vai trò | Địa chỉ |
|---|---|
| Quản trị viên (Bộ GD&ĐT) | `0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266` (account #0) |
| Trường Đại học Hải Phòng | `0x70997970C51812dc3A010C7d01b50e0d17dc79C8` (account #1) |
| Trung tâm Ngoại ngữ – Tin học HPU | `0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC` (account #2) |

Trên giao diện bấm **Kết nối ví → Ví demo** để dùng ngay không cần MetaMask. Muốn dùng MetaMask: thêm mạng
`http://127.0.0.1:8545`, chainId `31337`, rồi import private key của account tương ứng trong log của `npx hardhat node`.

## 🧪 Kịch bản demo

1. **Xác minh hợp lệ:** tab *Xác minh* → kéo thả `samples/VB_HPU_2026_000123.pdf` → ✅ HỢP LỆ. Đối chiếu chủ sở hữu:
   mã SV `2231480001`, ngày sinh `15/03/2004`.
2. **Phát hiện giả mạo:** kéo thả `samples/VB_HPU_2026_000123_GIA_MAO.pdf` (đã sửa xếp loại *Giỏi → Xuất sắc*) →
   ⚠️ KHÔNG TÌM THẤY.
3. **Văn bằng bị thu hồi:** *Nhập số hiệu* `HPU-2025-000987` → ⛔ ĐÃ THU HỒI kèm lý do.
4. **Cấp văn bằng:** kết nối ví *Trường ĐH Hải Phòng* → tab *Cấp văn bằng* → `samples/VB_HPU_2026_000125.pdf`,
   mã SV `2231480015`, ngày sinh `12/05/2004`, số hiệu `HPU-2026-000125` → ký giao dịch → nhận mã QR.
5. **Thu hồi:** tab *Quản lý & thu hồi* → *Thu hồi* → nhập lý do.
6. **Quản trị:** kết nối ví *Quản trị viên* → cấp quyền cho trường mới, tạm dừng / mở lại hệ thống.
7. **QR:** quét / mở liên kết `http://localhost:3000/?hash=0x…` → tự động xác minh.

## 📊 Kết quả kiểm thử

* 25/25 ca kiểm thử đạt · Coverage: 100% statements, 100% functions, 100% lines, 86% branches.
* Gas trung bình: `issueCertificate` ≈ 244k · `batchIssueCertificates` (20 bằng) ≈ 3.43M (≈ 171k/bằng, tiết kiệm ~30%)
  · `revokeCertificate` ≈ 116k · Xác minh: **0 gas** (hàm `view`).

## 📜 License

MIT
