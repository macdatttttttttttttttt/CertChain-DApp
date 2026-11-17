import { ethers, network, artifacts } from "hardhat";
import fs from "fs";
import path from "path";

/**
 * Triển khai CertificateRegistry và ghi địa chỉ + ABI ra src/contracts/deployment.json
 * để giao diện Next.js sử dụng.
 *
 *  Tài khoản #0 : Quản trị viên (Bộ GD&ĐT / Admin hệ thống)
 *  Tài khoản #1 : Trường Đại học Hải Phòng (được cấp ISSUER_ROLE)
 *  Tài khoản #2 : Trung tâm Ngoại ngữ - Tin học (được cấp ISSUER_ROLE)
 */
async function main() {
  const [admin, university, center] = await ethers.getSigners();

  console.log(`Mạng: ${network.name} (chainId ${network.config.chainId})`);
  console.log(`Admin: ${admin.address}`);

  const Registry = await ethers.getContractFactory("CertificateRegistry");
  const registry = await Registry.deploy();
  await registry.waitForDeployment();
  const address = await registry.getAddress();
  console.log(`CertificateRegistry đã triển khai tại: ${address}`);

  if (university) {
    await (await registry.addIssuer(university.address, "Trường Đại học Hải Phòng")).wait();
    console.log(`+ Cấp quyền ISSUER: Trường Đại học Hải Phòng -> ${university.address}`);
  }
  if (center) {
    await (await registry.addIssuer(center.address, "Trung tâm Ngoại ngữ - Tin học HPU")).wait();
    console.log(`+ Cấp quyền ISSUER: Trung tâm Ngoại ngữ - Tin học HPU -> ${center.address}`);
  }

  const artifact = await artifacts.readArtifact("CertificateRegistry");
  const out = {
    address,
    chainId: Number(network.config.chainId ?? 31337),
    abi: artifact.abi,
  };
  const outPath = path.join(__dirname, "..", "src", "contracts", "deployment.json");
  fs.writeFileSync(outPath, JSON.stringify(out, null, 2));
  console.log(`Đã ghi cấu hình cho Frontend: ${path.relative(process.cwd(), outPath)}`);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
