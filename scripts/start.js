#!/usr/bin/env node
/**
 * CertChain – khởi chạy toàn bộ dự án bằng một lệnh:
 *   1. Cài thư viện (nếu chưa có node_modules)
 *   2. Chạy mạng Blockchain cục bộ (Hardhat Node – cổng 8545)
 *   3. Triển khai Smart Contract + nạp văn bằng mẫu
 *   4. Chạy giao diện Next.js và tự mở trình duyệt
 * Nhấn Ctrl + C để dừng tất cả.
 */
const { spawn, spawnSync, execSync } = require("child_process");
const fs = require("fs");
const net = require("net");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const LOG_DIR = path.join(ROOT, ".logs");
const RPC_URL = "http://127.0.0.1:8545";
const isWin = process.platform === "win32";
const children = [];

const c = (code) => (s) => (process.stdout.isTTY ? `\x1b[${code}m${s}\x1b[0m` : s);
const green = c("32"), yellow = c("33"), red = c("31"), cyan = c("36"), bold = c("1");
const step = (n, msg) => console.log(`\n${cyan(`[${n}/4]`)} ${bold(msg)}`);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function fail(msg) {
  console.error(red(`\n✘ ${msg}`));
  shutdown(1);
}

// Trên Windows, npm/npx là tệp .cmd nên phải chạy qua shell – ghép lệnh thành một chuỗi (tham số cố định, không có dữ liệu người dùng)
const sh = (cmd, args) => (isWin ? [[cmd, ...args].join(" "), []] : [cmd, args]);

function run(cmd, args, label) {
  const r = spawnSync(...sh(cmd, args), { cwd: ROOT, stdio: "inherit", shell: isWin });
  if (r.status !== 0) fail(`${label} thất bại (mã thoát ${r.status}).`);
}

function background(cmd, args, logName) {
  fs.mkdirSync(LOG_DIR, { recursive: true });
  const out = fs.openSync(path.join(LOG_DIR, logName), "w");
  const child = spawn(...sh(cmd, args), { cwd: ROOT, stdio: ["ignore", out, out], shell: isWin, detached: !isWin });
  children.push(child);
  return child;
}

async function rpcReady() {
  try {
    const res = await fetch(RPC_URL, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "eth_chainId", params: [] }),
    });
    const j = await res.json();
    return j.result === "0x7a69"; // 31337
  } catch {
    return false;
  }
}

async function waitFor(check, timeoutMs, what) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (await check()) return;
    await sleep(1000);
  }
  fail(`Hết thời gian chờ ${what}. Xem nhật ký trong thư mục .logs/`);
}

function portFree(port) {
  return new Promise((resolve) => {
    const srv = net.createServer();
    srv.once("error", () => resolve(false));
    srv.once("listening", () => srv.close(() => resolve(true)));
    srv.listen(port, "0.0.0.0");
  });
}

function openBrowser(url) {
  try {
    if (isWin) execSync(`start "" "${url}"`, { stdio: "ignore", shell: true });
    else if (process.platform === "darwin") execSync(`open "${url}"`, { stdio: "ignore" });
    else execSync(`xdg-open "${url}"`, { stdio: "ignore" });
  } catch {
    /* không mở được trình duyệt – người dùng tự mở */
  }
}

function killTree(child) {
  if (!child || child.exitCode !== null) return;
  try {
    if (isWin) execSync(`taskkill /pid ${child.pid} /T /F`, { stdio: "ignore" });
    else process.kill(-child.pid, "SIGTERM");
  } catch {
    /* tiến trình đã dừng */
  }
}

function shutdown(code = 0) {
  children.forEach(killTree);
  process.exit(code);
}
process.on("SIGINT", () => {
  console.log(yellow("\nĐang dừng CertChain…"));
  shutdown(0);
});
process.on("SIGTERM", () => shutdown(0));

(async () => {
  console.log(bold("\n🎓 CertChain – Hệ thống xác minh văn bằng đại học bằng Blockchain"));

  const major = Number(process.versions.node.split(".")[0]);
  if (major < 18) fail(`Cần Node.js >= 18 (đang dùng ${process.versions.node}). Tải tại https://nodejs.org`);

  // 1. Thư viện
  step(1, "Kiểm tra thư viện");
  if (!fs.existsSync(path.join(ROOT, "node_modules", "hardhat"))) {
    console.log("Lần chạy đầu tiên – đang cài thư viện (khoảng 2–5 phút)…");
    run("npm", ["install", "--no-audit", "--no-fund"], "Cài thư viện");
  } else console.log(green("✔ Đã có thư viện"));

  // 2. Mạng Blockchain cục bộ
  step(2, "Khởi chạy mạng Blockchain cục bộ (Hardhat Node – cổng 8545)");
  if (await rpcReady()) {
    console.log(green("✔ Đã có Hardhat Node đang chạy – dùng lại"));
  } else {
    if (!(await portFree(8545))) fail("Cổng 8545 đang bị chương trình khác chiếm. Hãy tắt chương trình đó rồi chạy lại.");
    const node = background("npx", ["hardhat", "node"], "hardhat-node.log");
    node.on("exit", (code) => code && fail("Hardhat Node dừng bất thường. Xem .logs/hardhat-node.log"));
    await waitFor(rpcReady, 120000, "Hardhat Node");
    console.log(green(`✔ Blockchain cục bộ sẵn sàng tại ${RPC_URL}`));
  }

  // 3. Triển khai hợp đồng + dữ liệu mẫu
  step(3, "Triển khai Smart Contract và nạp văn bằng mẫu");
  run("npx", ["hardhat", "run", "scripts/deploy.ts", "--network", "localhost"], "Triển khai hợp đồng");
  run("npx", ["hardhat", "run", "scripts/seed.ts", "--network", "localhost"], "Nạp dữ liệu mẫu");

  // 4. Giao diện
  step(4, "Khởi chạy giao diện web");
  let port = 3000;
  while (!(await portFree(port)) && port < 3010) port++;
  const url = `http://localhost:${port}`;
  const web = background("npx", ["next", "dev", "-p", String(port)], "web.log");
  web.on("exit", (code) => code && fail("Giao diện web dừng bất thường. Xem .logs/web.log"));
  await waitFor(async () => {
    try {
      return (await fetch(url)).ok;
    } catch {
      return false;
    }
  }, 300000, "giao diện web");

  console.log(green(`\n✔ CertChain đã sẵn sàng: ${bold(url)}`));
  console.log(`
  Tài khoản demo (bấm "Kết nối ví → Ví demo" trên giao diện):
    • Quản trị viên (Bộ GD&ĐT)       0xf39F…2266
    • Trường Đại học Hải Phòng        0x7099…79C8
    • Trung tâm Ngoại ngữ - Tin học   0x3C44…93BC
  Văn bằng mẫu để thử xác minh: thư mục samples/
  Nhật ký: thư mục .logs/

  ${yellow("Nhấn Ctrl + C để dừng tất cả.")}`);
  openBrowser(url);
})().catch((e) => fail(e.message || String(e)));
