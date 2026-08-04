"use client";

import { useEffect, useMemo, useState } from "react";
import clsx from "clsx";
import { Bell, RefreshCw, ShieldAlert, TrendingUp, Timer } from "lucide-react";
import { fmtPct, fmtUsd, type DeskDayState, type DeskOpenBrief } from "@/lib/desk";
import type { RhLivePosition } from "@/lib/robinhood";

type Props = {
  desk: DeskDayState | null;
  positions: RhLivePosition[];
  buyingPower: number | null;
  busy?: boolean;
  onAnalyzeNow: () => void | Promise<void>;
  onProtectLosers?: () => void | Promise<void>;
};

function etNowParts() {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    hour: "numeric",
    minute: "numeric",
    second: "numeric",
    hour12: false,
    weekday: "short",
  });
  const parts = Object.fromEntries(
    fmt.formatToParts(new Date()).map((p) => [p.type, p.value])
  );
  const hour = Number(parts.hour === "24" ? 0 : parts.hour);
  const minute = Number(parts.minute);
  const second = Number(parts.second);
  return { hour, minute, second, weekday: parts.weekday };
}

function msUntilOpenEt() {
  const { hour, minute, second } = etNowParts();
  const now = hour * 3600 + minute * 60 + second;
  const open = 9 * 3600 + 30 * 60;
  return (open - now) * 1000;
}

function formatCountdown(ms: number | null) {
  if (ms == null) return "—";
  if (ms <= 0) return "OPEN";
  const total = Math.floor(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  if (m >= 60) {
    const h = Math.floor(m / 60);
    return `${h}h ${m % 60}m`;
  }
  return `${m}:${String(s).padStart(2, "0")}`;
}

function localBrief(
  desk: DeskDayState | null,
  positions: RhLivePosition[],
  buyingPower: number | null
): DeskOpenBrief | null {
  if (desk?.openBrief && !desk.openBrief.error) return desk.openBrief;

  let cost = 0;
  let value = 0;
  const rows: Array<{ symbol: string; pnlPct: number; marketValue: number | null }> = [];
  for (const p of positions) {
    const qty = Math.abs(Number(p.quantity) || 0);
    const avg = Number(p.avgCost);
    const mark =
      p.lastPrice != null && Number.isFinite(p.lastPrice)
        ? Number(p.lastPrice)
        : p.marketValue != null && qty
          ? Number(p.marketValue) / qty
          : null;
    if (!(qty > 0) || !(avg > 0) || mark == null || !(mark > 0)) continue;
    cost += avg * qty;
    value += mark * qty;
    const pnlPct = ((mark - avg) / avg) * 100;
    rows.push({
      symbol: p.symbol,
      pnlPct,
      marketValue: p.marketValue ?? mark * qty,
    });
  }
  if (!cost) return desk?.openBrief || null;
  const bookPnlPct = ((value - cost) / cost) * 100;
  const goalPct = (desk?.dayGoal?.min || 0.01) * 100;
  const holePct = Math.max(0, goalPct - bookPnlPct);
  const winners = rows.filter((r) => r.pnlPct > 0.15).sort((a, b) => b.pnlPct - a.pnlPct);
  const losers = rows.filter((r) => r.pnlPct < -0.15).sort((a, b) => a.pnlPct - b.pnlPct);
  const fusionBroken =
    desk?.lastDecision?.source === "nim_error"
    || desk?.lastDecision?.source === "nim_unavailable";
  return {
    headline: `Hole to +${goalPct.toFixed(0)}% is ${holePct.toFixed(2)}%`,
    plain: `Book ${bookPnlPct.toFixed(2)}%. ${fusionBroken ? "Fusion down — cash on new risk." : ""}`,
    answer:
      winners[0]
        ? `Press ${winners.slice(0, 2).map((w) => w.symbol).join(" + ")}; protect ${losers.slice(0, 2).map((l) => l.symbol).join(", ") || "losers"}.`
        : "Protect first; wait for a clean fusion open.",
    goalPct,
    bookPnlPct,
    bookPnlUsd: value - cost,
    holePct,
    holeUsd: (holePct / 100) * cost,
    bookCost: cost,
    bookValue: value,
    buyingPower,
    fusion: {
      action: desk?.lastDecision?.action,
      symbol: desk?.lastDecision?.symbol,
      source: desk?.lastDecision?.source,
      why: desk?.lastDecision?.why,
      broken: fusionBroken,
      refreshing: Boolean(desk?.refreshing),
    },
    ramp: winners.slice(0, 5).map((w) => ({ symbol: w.symbol, pnlPct: w.pnlPct })),
    protect: losers.slice(0, 6).map((l) => ({ symbol: l.symbol, pnlPct: l.pnlPct })),
    steps: [],
  };
}

export default function OpenBell({
  desk,
  positions,
  buyingPower,
  busy,
  onAnalyzeNow,
  onProtectLosers,
}: Props) {
  const [nowMs, setNowMs] = useState(() => Date.now());
  useEffect(() => {
    const iv = window.setInterval(() => setNowMs(Date.now()), 250);
    return () => window.clearInterval(iv);
  }, []);

  const msLeft = useMemo(() => {
    void nowMs;
    return msUntilOpenEt();
  }, [nowMs]);

  const brief = useMemo(
    () => localBrief(desk, positions, buyingPower),
    [desk, positions, buyingPower]
  );

  const preOpen =
    (msLeft != null && msLeft > 0 && msLeft <= 90 * 60 * 1000)
    || Boolean(desk?.et?.isMorningPlanWindow)
    || Boolean(brief?.isPreOpen);
  const isOpen = Boolean(desk?.et?.isRth) || (msLeft != null && msLeft <= 0);
  const show = preOpen || isOpen || (brief?.holePct != null && brief.holePct > 0.2);
  if (!show || !brief) return null;

  const countdown = formatCountdown(msLeft);
  const underwater = (brief.bookPnlPct ?? 0) < (brief.goalPct ?? 1) * 0.25;
  const fusionBroken = Boolean(brief.fusion?.broken);
  const maxAbs = Math.max(
    0.5,
    ...[...(brief.ramp || []), ...(brief.protect || [])].map((r) => Math.abs(Number(r.pnlPct) || 0))
  );

  return (
    <section
      className={clsx(
        "mb-6 overflow-hidden rounded-[1.75rem] border shadow-[var(--shadow)]",
        underwater || fusionBroken
          ? "border-rose-300/80 bg-gradient-to-br from-[#fff7f5] via-[#fffaf3] to-[#f0fdfa]"
          : "border-[var(--line)] bg-gradient-to-br from-[#042f2e] via-[#0f766e] to-[#134e4a]"
      )}
    >
      <div
        className={clsx(
          "flex flex-wrap items-end justify-between gap-4 px-5 py-4 sm:px-7 sm:py-5",
          underwater || fusionBroken ? "text-[var(--ink)]" : "text-[#ecfeff]"
        )}
      >
        <div>
          <p className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.22em] opacity-80">
            <Bell className="h-3.5 w-3.5" />
            {isOpen ? "Market open — make the day" : "Open bell"}
          </p>
          <p
            className={clsx(
              "mt-1 display text-5xl font-semibold tracking-tight sm:text-6xl",
              !isOpen && msLeft != null && msLeft <= 15 * 60 * 1000 && "animate-pulse"
            )}
          >
            {isOpen ? "LIVE" : countdown}
          </p>
          <p className="mt-1 max-w-xl text-sm leading-relaxed opacity-90">
            {brief.headline || "Plan the open."}
          </p>
        </div>
        <div className="text-right">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] opacity-70">
            Hole to +{(brief.goalPct ?? 1).toFixed(0)}%
          </p>
          <p className="display text-4xl font-semibold">
            {brief.holePct == null ? "—" : fmtPct(brief.holePct)}
          </p>
          <p className="mt-1 text-xs opacity-80">
            Book {brief.bookPnlPct == null ? "—" : fmtPct(brief.bookPnlPct)}
            {brief.holeUsd != null ? ` · need ~${fmtUsd(brief.holeUsd)}` : ""}
            {buyingPower != null ? ` · BP ${fmtUsd(buyingPower)}` : ""}
          </p>
        </div>
      </div>

      <div className="border-t border-black/10 bg-white/95 px-5 py-5 sm:px-7">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--teal)]">
          How we make it up — right now
        </p>
        <p className="mt-2 text-lg font-semibold leading-snug text-[var(--ink)] sm:text-xl">
          {brief.answer || brief.plain}
        </p>
        <p className="mt-2 text-sm leading-relaxed text-[var(--ink-soft)]">{brief.plain}</p>

        <div className="mt-4 grid gap-3 lg:grid-cols-3">
          <div className="rounded-2xl border border-[var(--line)] bg-[var(--sand)]/50 px-4 py-3">
            <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.14em] text-[var(--teal)]">
              <Timer className="h-3.5 w-3.5" /> Fusion / open call
            </p>
            <p
              className={clsx(
                "mt-2 text-base font-semibold",
                fusionBroken ? "text-[var(--danger)]" : "text-[var(--ink)]"
              )}
            >
              {brief.fusion?.refreshing || busy
                ? "Analyzing for open…"
                : fusionBroken
                  ? "Fusion timed out — CASH"
                  : brief.fusion?.action?.startsWith("open_")
                    ? `${brief.fusion.action.replace("open_", "")} ${brief.fusion.symbol || ""}`
                    : brief.fusion?.action === "pass"
                      ? "Cash / no spray"
                      : "No fresh call"}
            </p>
            <p className="mt-1 text-xs leading-relaxed text-[var(--ink-soft)]">
              {(brief.fusion?.why || "Hit Analyze — do not invent nickels while the model is down.").slice(0, 180)}
            </p>
          </div>

          <div className="rounded-2xl border border-[var(--line)] bg-[var(--sand)]/50 px-4 py-3">
            <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.14em] text-[var(--ok)]">
              <TrendingUp className="h-3.5 w-3.5" /> Ramp
            </p>
            {(brief.ramp || []).length ? (
              <ul className="mt-2 space-y-1.5">
                {(brief.ramp || []).slice(0, 4).map((r) => (
                  <li key={r.symbol} className="flex items-center gap-2 text-sm">
                    <span className="w-14 font-semibold text-[var(--ink)]">{r.symbol}</span>
                    <span className="h-2 flex-1 overflow-hidden rounded-full bg-[var(--line)]">
                      <span
                        className="block h-full rounded-full bg-[var(--ok)]"
                        style={{ width: `${Math.min(100, (Math.abs(Number(r.pnlPct) || 0) / maxAbs) * 100)}%` }}
                      />
                    </span>
                    <span className="w-14 text-right text-[var(--ok)]">{fmtPct(r.pnlPct)}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-sm text-[var(--ink-soft)]">No held winner to press yet.</p>
            )}
          </div>

          <div className="rounded-2xl border border-[var(--line)] bg-[var(--sand)]/50 px-4 py-3">
            <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.14em] text-[var(--danger)]">
              <ShieldAlert className="h-3.5 w-3.5" /> Protect
            </p>
            {(brief.protect || []).length ? (
              <ul className="mt-2 space-y-1.5">
                {(brief.protect || []).slice(0, 4).map((r) => (
                  <li key={r.symbol} className="flex items-center gap-2 text-sm">
                    <span className="w-14 font-semibold text-[var(--ink)]">{r.symbol}</span>
                    <span className="h-2 flex-1 overflow-hidden rounded-full bg-[var(--line)]">
                      <span
                        className="block h-full rounded-full bg-[var(--danger)]"
                        style={{ width: `${Math.min(100, (Math.abs(Number(r.pnlPct) || 0) / maxAbs) * 100)}%` }}
                      />
                    </span>
                    <span className="w-14 text-right text-[var(--danger)]">{fmtPct(r.pnlPct)}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-sm text-[var(--ink-soft)]">No sharp loser bleed marked.</p>
            )}
          </div>
        </div>

        {(brief.steps || []).length > 0 ? (
          <ol className="mt-4 space-y-2">
            {(brief.steps || []).slice(0, 5).map((s, i) => (
              <li key={`${s.kind}-${i}`} className="flex gap-3 text-sm">
                <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[var(--teal)] text-[11px] font-bold text-white">
                  {i + 1}
                </span>
                <span>
                  <span className="font-semibold text-[var(--ink)]">{s.title}</span>
                  {s.detail ? (
                    <span className="block text-[var(--ink-soft)]">{s.detail}</span>
                  ) : null}
                </span>
              </li>
            ))}
          </ol>
        ) : null}

        <div className="mt-5 flex flex-wrap items-center gap-3">
          <button
            type="button"
            disabled={busy || Boolean(desk?.refreshing)}
            onClick={() => void onAnalyzeNow()}
            className="inline-flex items-center gap-2 rounded-full bg-[var(--teal)] px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
          >
            <RefreshCw
              className={clsx("h-4 w-4", (busy || desk?.refreshing) && "animate-spin")}
            />
            {busy || desk?.refreshing ? "Analyzing for open…" : "Analyze for open NOW"}
          </button>
          {onProtectLosers && (brief.protect || []).length > 0 ? (
            <button
              type="button"
              disabled={busy}
              onClick={() => void onProtectLosers()}
              className="inline-flex items-center gap-2 rounded-full border border-[var(--danger)]/40 bg-white px-4 py-2.5 text-sm font-semibold text-[var(--danger)] disabled:opacity-50"
            >
              <ShieldAlert className="h-4 w-4" />
              Protect losers
            </button>
          ) : null}
          {brief.staging?.symbol ? (
            <p className="text-xs text-[var(--ink-soft)]">
              Staging: {brief.staging.symbol} {brief.staging.side || ""} — not auto until fusion/Approve
            </p>
          ) : null}
        </div>
      </div>
    </section>
  );
}
