"use client";

import { useEffect, useState } from "react";
import { useAccount, useConnect, useDisconnect } from "wagmi";
import { DEMO_ACCOUNTS } from "@/lib/wagmi";
import { shorten } from "@/lib/contract";
import { useRoles } from "@/lib/useRoles";

/** Kết nối ví: MetaMask (injected) hoặc 3 ví demo của Hardhat Node. */
export default function WalletBar() {
  const { address, isConnected } = useAccount();
  const { connectors, connect } = useConnect();
  const { disconnect } = useDisconnect();
  const { isAdmin, isIssuer, issuer } = useRoles();
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return null;

  const injected = connectors.find((c) => c.type === "injected");
  const mocks = connectors.filter((c) => c.type === "mock");

  if (isConnected && address) {
    const role = isAdmin ? "Quản trị viên" : isIssuer ? issuer?.name ?? "Đơn vị cấp" : "Khách";
    return (
      <div className="flex items-center gap-3">
        <div className="text-right">
          <p className="text-xs text-gold-400">{role}</p>
          <p className="mono text-sm text-white" data-testid="account">
            {shorten(address)}
          </p>
        </div>
        <button className="btn border border-white/30 text-white hover:bg-white/10" onClick={() => disconnect()}>
          Ngắt kết nối
        </button>
      </div>
    );
  }

  return (
    <div className="relative">
      <button className="btn-gold" onClick={() => setOpen(!open)}>
        Kết nối ví
      </button>
      {open && (
        <div className="absolute right-0 z-10 mt-2 w-72 rounded-xl bg-white p-2 text-sm shadow-xl">
          {injected && (
            <button
              className="w-full rounded-lg px-3 py-2 text-left hover:bg-slate-100"
              onClick={() => (connect({ connector: injected }), setOpen(false))}
            >
              🦊 MetaMask / ví trình duyệt
            </button>
          )}
          <p className="px-3 pt-2 text-xs font-semibold uppercase text-slate-400">Ví demo (Hardhat local)</p>
          {mocks.map((c, i) => (
            <button
              key={c.uid}
              className="w-full rounded-lg px-3 py-2 text-left hover:bg-slate-100"
              data-testid={`demo-wallet-${i}`}
              onClick={() => (connect({ connector: c }), setOpen(false))}
            >
              <span className="font-semibold">{DEMO_ACCOUNTS[i].label}</span>
              <span className="mono block text-xs text-slate-500">{shorten(DEMO_ACCOUNTS[i].address, 10, 8)}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
