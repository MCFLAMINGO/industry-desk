"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Link2, RefreshCw } from "lucide-react";
import {
  connectRobinhood,
  fetchPortfolio,
  fetchRhStatus,
  type RhStatus,
} from "@/lib/robinhood";

function maskAccount(n?: string | null) {
  if (!n) return "—";
  const s = String(n);
  return s.length <= 4 ? s : `••${s.slice(-4)}`;
}

export default function RobinhoodPanel({ compact = false }: { compact?: boolean }) {
  const [status, setStatus] = useState<RhStatus | null>(null);
  const [buyingPower, setBuyingPower] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function refresh() {
    try {
      const next = await fetchRhStatus();
      setStatus(next);
      if (next?.configured) {
        const p = await fetchPortfolio();
        const bp =
          p?.portfolio?.parsed?.data?.buying_power?.buying_power ||
          p?.portfolio?.parsed?.data?.cash ||
          null;
        setBuyingPower(bp ? String(bp) : null);
      } else {
        setBuyingPower(null);
      }
    } catch (e) {
      setStatus({ configured: false, error: (e as Error).message });
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  async function onConnect() {
    setBusy(true);
    try {
      const data = await connectRobinhood();
      if (!data.authorize_url) throw new Error(data.error || "No authorize URL");
      toast.message("Redirecting to Robinhood — tap Allow");
      window.location.assign(data.authorize_url);
    } catch (e) {
      toast.error("Connect failed", { description: (e as Error).message });
      setBusy(false);
    }
  }

  const connected = Boolean(status?.configured);

  return (
    <div className={`glass rounded-3xl ${compact ? "p-4" : "p-5"} space-y-4`}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--teal)]">
            Robinhood Agentic
          </p>
          <h2 className="display mt-1 text-xl font-semibold">
            {connected ? "Connected" : "Not connected"}
          </h2>
        </div>
        <span
          className={`rounded-full px-3 py-1 text-sm font-semibold ${
            connected
              ? "bg-emerald-100 text-emerald-800"
              : "bg-amber-100 text-amber-900"
          }`}
        >
          {connected ? "Live rail ready" : "Connect required"}
        </span>
      </div>

      {!compact && (
        <p className="text-sm leading-relaxed text-[var(--ink-soft)]">
          Trades hit your separate funded Agentic account — not your primary portfolio.
          Prefer Mac localhost bridge if HTTPS hits Robinhood&apos;s &quot;Uh oh&quot;.
        </p>
      )}

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {[
          { label: "Live trading", value: status?.live_trading_enabled ? "ON" : "off" },
          { label: "Account", value: maskAccount(status?.account_number) },
          { label: "Max size", value: `$${status?.max_notional_usd ?? 250}` },
          { label: "Buying power", value: buyingPower ? `$${buyingPower}` : "—" },
        ].map((cell) => (
          <div key={cell.label} className="rounded-2xl border border-[var(--line)] bg-white/70 px-3 py-2.5">
            <div className="text-xs text-[var(--ink-soft)]">{cell.label}</div>
            <div className="mono mt-1 text-sm font-semibold">{cell.value}</div>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className="btn btn-ghost"
          disabled={busy}
          onClick={async () => {
            await refresh();
            toast.success("Status refreshed");
          }}
        >
          <RefreshCw className="h-4 w-4" /> Refresh
        </button>
        <button
          type="button"
          className="btn btn-primary"
          disabled={busy}
          onClick={onConnect}
        >
          <Link2 className="h-4 w-4" />
          {connected ? "Reconnect" : "Connect Robinhood"}
        </button>
      </div>
    </div>
  );
}
