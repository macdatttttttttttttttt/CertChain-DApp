"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import WalletBar from "@/components/WalletBar";
import VerifyPanel from "@/components/VerifyPanel";
import IssuePanel from "@/components/IssuePanel";
import ManagePanel from "@/components/ManagePanel";
import AdminPanel from "@/components/AdminPanel";
import { IS_DEPLOYED, REGISTRY_ADDRESS, shorten } from "@/lib/contract";

type Tab = "verify" | "issue" | "manage" | "admin";

const TABS: { id: Tab; label: string; desc: string }[] = [
  { id: "verify", label: "Xác minh", desc: "Nhà tuyển dụng" },
  { id: "issue", label: "Cấp văn bằng", desc: "Cơ sở đào tạo" },
  { id: "manage", label: "Quản lý & thu hồi", desc: "Cơ sở đào tạo" },
  { id: "admin", label: "Quản trị hệ thống", desc: "Bộ GD&ĐT / Admin" },
];

function App() {
  const params = useSearchParams();
  const qHash = params.get("hash") ?? undefined;
  const qSerial = params.get("serial") ?? undefined;
  const [tab, setTab] = useState<Tab>((params.get("tab") as Tab) || "verify");

  return (
    <div className="min-h-screen">
      <header className="bg-navy-950 text-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gold-400 text-2xl">🎓</div>
            <div>
              <h1 className="text-xl font-bold tracking-wide">
                Cert<span className="text-gold-400">Chain</span>
              </h1>
              <p className="text-xs text-slate-300">Xác minh văn bằng – chứng chỉ đại học bằng Blockchain</p>
            </div>
          </div>
          <WalletBar />
        </div>
        <nav className="mx-auto flex max-w-6xl gap-1 px-6">
          {TABS.map((t) => (
            <button
              key={t.id}
              data-testid={`tab-${t.id}`}
              onClick={() => setTab(t.id)}
              className={`rounded-t-xl px-5 py-2.5 text-left ${
                tab === t.id ? "bg-slate-100 text-navy-900" : "text-slate-300 hover:bg-white/10"
              }`}
            >
              <span className="block text-sm font-semibold">{t.label}</span>
              <span className="block text-[11px] opacity-70">{t.desc}</span>
            </button>
          ))}
        </nav>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-8">
        {!IS_DEPLOYED ? (
          <div className="card border-amber-300 bg-amber-50 text-sm">
            Chưa tìm thấy Smart Contract. Hãy chạy <code>npx hardhat node</code> và{" "}
            <code>npm run deploy:local</code> rồi tải lại trang.
          </div>
        ) : (
          <>
            {tab === "verify" && <VerifyPanel initialHash={qHash} initialSerial={qSerial} />}
            {tab === "issue" && <IssuePanel />}
            {tab === "manage" && <ManagePanel />}
            {tab === "admin" && <AdminPanel />}
          </>
        )}
      </main>

      <footer className="pb-8 text-center text-xs text-slate-500">
        Smart Contract CertificateRegistry · <span className="mono">{shorten(REGISTRY_ADDRESS, 10, 8)}</span> · Mạng
        Hardhat Local (chainId 31337)
      </footer>
    </div>
  );
}

export default function Page() {
  return (
    <Suspense fallback={null}>
      <App />
    </Suspense>
  );
}
