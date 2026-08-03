"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Link2, Loader2, RefreshCw } from "lucide-react";
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
  const [refreshing, setRefreshing] = useState(false);

  async function refresh(opts?: { manual?: boolean }) {
    const manual = Boolean(opts?.manual);
    if (manual) setRefreshing(true);
    try {
      const next = await fetchRhStatus();
      setStatus(next);
      let bp: string | null = null;
      if (next?.configured) {
        const p = await fetchPortfolio();
        bp =
          p?.portfolio?.parsed?.data?.buying_power?.buying_power ||
          p?.portfolio?.parsed?.data?.cash ||
          null;
        setBuyingPower(bp ? String(bp) : null);
      } else {
        setBuyingPower(null);
      }
      if (manual) {
        toast.success(next?.configured ? "Robinhood status updated" : "Status refreshed", {
          description: [
            next?.configured ? `Account ${maskAccount(next.account_number)}` : "Not connected",
            next?.live_trading_enabled ? "live ON" : "live off",
            bp ? `BP $${bp}` : null,
            new Date().toLocaleTimeString(),
          ]
            .filter(Boolean)
            .join(" · "),
        });
      }
    } catch (e) {
      setStatus({ configured: false, error: (e as Error).message });
      if (manual) {
        toast.error("Refresh failed", { description: (e as Error).message });
      }
    } finally {
      if (manual) setRefreshing(false);
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
  const spinning = refreshing || busy;

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
          disabled={spinning}
          onClick={() => refresh({ manual: true })}
        >
          {refreshing ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="h-4 w-4" />
          )}
          {refreshing ? "Refreshing…" : "Refresh status"}
        </button>
        <button
          type="button"
          className="btn btn-primary"
          disabled={spinning}
          onClick={onConnect}
        >
          <Link2 className="h-4 w-4" />
          {busy ? "Opening Robinhood…" : connected ? "Reconnect" : "Connect Robinhood"}
        </button>
      </div>
    </div>
  );
}
