"use client";

import { useState } from "react";
import { toast } from "sonner";
import { armPlan, dryRunReview } from "@/lib/robinhood";
import { INDUSTRIES } from "@/lib/industries";

const AI = INDUSTRIES.find((i) => i.id === "ai")!;

export default function AiExecutePanel() {
  const [symbol, setSymbol] = useState("NVDA");
  const [notional, setNotional] = useState("25");
  const [busy, setBusy] = useState<"review" | "dry" | "live" | null>(null);
  const [result, setResult] = useState<any>(null);

  async function onReview() {
    setBusy("review");
    setResult(null);
    try {
      const data = await dryRunReview(symbol.trim().toUpperCase(), Number(notional) || 25);
      setResult(data);
      if (data.ok) toast.success("Robinhood review OK");
      else toast.error("Review failed", { description: data.message || data.error });
    } catch (e) {
      toast.error("Review failed", { description: (e as Error).message });
    } finally {
      setBusy(null);
    }
  }

  async function onExecute(live: boolean) {
    if (live && !window.confirm(`Place LIVE plan for ${symbol.toUpperCase()} ($${notional})?`)) {
      return;
    }
    setBusy(live ? "live" : "dry");
    setResult(null);
    try {
      const data = await armPlan({
        symbol: symbol.trim().toUpperCase(),
        notionalUsd: Number(notional) || 25,
        live,
        title: `AI Trade · ${symbol.toUpperCase()}`,
      });
      setResult(data);
      if (data.ok || data.plan) {
        toast.success(live ? "Live plan armed" : "Dry-run plan armed", {
          description: data.plan?.status || data.message,
        });
      } else {
        toast.error("Execute failed", { description: data.error || data.message });
      }
    } catch (e) {
      toast.error("Execute failed", { description: (e as Error).message });
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="glass space-y-5 rounded-3xl p-5">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--teal)]">
          AI Trade · Execute
        </p>
        <h2 className="display mt-1 text-2xl font-semibold">One symbol. One plan.</h2>
        <p className="mt-2 text-sm leading-relaxed text-[var(--ink-soft)]">
          Review talks to Robinhood without placing. Execute arms open → monitor → close on the server worker.
        </p>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {AI.tickers.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setSymbol(t)}
            className={`mono rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${
              symbol.toUpperCase() === t
                ? "border-[var(--teal)] bg-[var(--teal-deep)] text-white"
                : "border-[var(--line)] bg-white/70 text-[var(--teal-deep)]"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="space-y-1.5 text-sm">
          <span className="text-[var(--ink-soft)]">Symbol</span>
          <input
            className="field mono uppercase"
            value={symbol}
            onChange={(e) => setSymbol(e.target.value)}
          />
        </label>
        <label className="space-y-1.5 text-sm">
          <span className="text-[var(--ink-soft)]">Notional USD</span>
          <input
            className="field mono"
            value={notional}
            onChange={(e) => setNotional(e.target.value)}
          />
        </label>
      </div>

      <div className="flex flex-wrap gap-2">
        <button type="button" className="btn btn-ghost" disabled={Boolean(busy)} onClick={onReview}>
          {busy === "review" ? "Reviewing…" : "Review only"}
        </button>
        <button
          type="button"
          className="btn btn-primary"
          disabled={Boolean(busy)}
          onClick={() => onExecute(false)}
        >
          {busy === "dry" ? "Arming dry-run…" : "Execute (dry-run)"}
        </button>
        <button
          type="button"
          className="btn btn-ghost border-[rgba(180,83,9,0.35)] text-[var(--danger)]"
          disabled={Boolean(busy)}
          onClick={() => onExecute(true)}
        >
          {busy === "live" ? "Placing live…" : "Place live plan"}
        </button>
      </div>

      {result && (
        <pre className="max-h-72 overflow-auto rounded-2xl border border-[var(--line)] bg-[#042f2e] p-4 text-xs leading-relaxed text-[#ccfbf1]">
          {JSON.stringify(
            {
              ok: result.ok,
              mode: result.mode,
              message: result.message,
              error: result.error,
              plan: result.plan
                ? {
                    id: result.plan.id,
                    status: result.plan.status,
                    side: result.plan.side,
                    steps: (result.plan.steps || []).map((s: any) => ({
                      id: s.id,
                      phase: s.phase,
                      order_kind: s.order_kind,
                      status: s.status,
                    })),
                  }
                : undefined,
              order: result.order || result.order_shaped,
              review: result.review?.parsed || result.review?.text,
            },
            null,
            2
          )}
        </pre>
      )}
    </div>
  );
}
