import { ethers } from "hardhat";
import fs from "fs";
import path from "path";
import crypto from "crypto";
import deployment from "../src/contracts/deployment.json";

/**
 * Nạp dữ liệu mẫu: cấp các văn bằng trong thư mục samples/ (trừ tệp *_GIA_MAO.pdf)
 * và thu hồi một văn bằng để minh họa trạng thái REVOKED.
 */
const studentHash = (studentId: string, dob: string) =>
  ethers.keccak256(ethers.toUtf8Bytes(`${studentId.trim().toUpperCase()}|${dob.trim()}`));

const sha256File = (file: string) =>
  "0x" + crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");

async function main() {
  const [, university, center] = await ethers.getSigners();
  const registry = await ethers.getContractAt("CertificateRegistry", deployment.address);
  const meta = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "samples", "samples.json"), "utf8"));

  for (const s of meta) {
    if (s.fake || s.demoIssue) continue; // tệp giả mạo     if (s.fake) continue; tệp dành cho demo cấp trực tiếp trên giao diện
    const file = path.join(__dirname, "..", "samples", s.file);
    const signer = s.certType === 3 ? center : university;
    const hash = sha256File(file);
    const tx = await registry
      .connect(signer)
      .issueCertificate(hash, studentHash(s.studentId, s.dob), s.serialNo, s.certType, "");
    const rc = await tx.wait();
    console.log(`Đã cấp ${s.serialNo} (${s.file}) - gas ${rc?.gasUsed} - tx ${tx.hash}`);
    if (s.revoke) {
      await (await registry.connect(signer).revokeCertificate(hash, s.revoke)).wait();
      console.log(`   -> Đã thu hồi: ${s.revoke}`);
    }
  }
  console.log(`Tổng văn bằng: ${await registry.totalCertificates()} | Đã thu hồi: ${await registry.totalRevoked()}`);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
