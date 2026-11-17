#!/usr/bin/env bash
# CertChain – chạy toàn bộ dự án bằng một lệnh (macOS / Linux)
cd "$(dirname "$0")"
if ! command -v node >/dev/null 2>&1; then
  echo "[LỖI] Chưa cài Node.js. Hãy cài Node.js 18 trở lên tại https://nodejs.org rồi chạy lại."
  exit 1
fi
node scripts/start.js
