"use client";

import { useEffect, useMemo, useState } from "react";
import clsx from "clsx";
import { RefreshCw, ShieldAlert, CheckCircle2, AlertOctagon, Quote } from "lucide-react";
import { fmtPct, fmtUsd, type DeskDayState } from "@/lib/desk";
import type { RhLivePosition } from "@/lib/robinhood";

type Props = {
  desk: DeskDayState | null;
  positions: RhLivePosition[];
  buyingPower: number | null;
  busy?: boolean;
  onAnalyzeNow: () => void | Promise<void>;
  onProtectLosers?: () => void | Promise<void>;
};

type Row = {
  symbol: string;
  qty: number;
  avg: number;
  mark: number;
  pnlPct: number;
  pnlUsd: number;
  mv: number;
};

function rowsFromPositions(positions: RhLivePosition[]): Row[] {
  const out: Row[] = [];
  for (const p of positions) {
    const qty = Math.abs(Number(p.quantity) || 0);
    const avg = Number(p.avgCost);
    const mark =
      p.lastPrice != null && Number.isFinite(p.lastPrice)
        ? Number(p.lastPrice)
        : p.marketValue != null && qty
          ? Number(p.marketValue) / qty
          : NaN;
    if (!(qty > 0) || !(avg > 0) || !(mark > 0)) continue;
    const mv = mark * qty;
    const pnlUsd = (mark - avg) * qty;
    const pnlPct = ((mark - avg) / avg) * 100;
    out.push({ symbol: p.symbol, qty, avg, mark, pnlPct, pnlUsd, mv });
  }
  return out.sort((a, b) => b.mv - a.mv);
}

function etClock() {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  }).format(new Date());
}

function msToOpen() {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    hour: "numeric",
    minute: "numeric",
    second: "numeric",
    hour12: false,
  });
  const parts = Object.fromEntries(fmt.formatToParts(new Date()).map((p) => [p.type, p.value]));
  const hour = Number(parts.hour === "24" ? 0 : parts.hour);
  const minute = Number(parts.minute);
  const second = Number(parts.second);
  const now = hour * 3600 + minute * 60 + second;
  return (9 * 3600 + 30 * 60 - now) * 1000;
}

function countdown(ms: number) {
  if (ms <= 0) return "MARKET OPEN";
  const t = Math.floor(ms / 1000);
  const m = Math.floor(t / 60);
  const s = t % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

/** Horizontal P&L bars */
function PnlBars({ rows }: { rows: Row[] }) {
  const max = Math.max(1, ...rows.map((r) => Math.abs(r.pnlPct)));
  return (
    <div className="space-y-1.5">
      {rows.map((r) => (
        <div key={r.symbol} className="flex items-center gap-2 text-xs">
          <span className="w-12 shrink-0 font-semibold text-[var(--ink)]">{r.symbol}</span>
          <div className="relative h-3 flex-1 rounded-sm bg-[var(--line)]/70">
            <div className="absolute inset-y-0 left-1/2 w-px bg-[var(--ink-soft)]/40" />
            {r.pnlPct >= 0 ? (
              <div
                className="absolute inset-y-0 left-1/2 rounded-r-sm bg-[var(--ok)]"
                style={{ width: `${(r.pnlPct / max) * 50}%` }}
              />
            ) : (
              <div
                className="absolute inset-y-0 right-1/2 rounded-l-sm bg-[var(--danger)]"
                style={{ width: `${(Math.abs(r.pnlPct) / max) * 50}%` }}
              />
            )}
          </div>
          <span
            className={clsx(
              "w-16 shrink-0 text-right font-medium",
              r.pnlPct >= 0 ? "text-[var(--ok)]" : "text-[var(--danger)]"
            )}
          >
            {fmtPct(r.pnlPct)}
          </span>
          <span className="w-14 shrink-0 text-right text-[var(--ink-soft)]">{fmtUsd(r.pnlUsd)}</span>
        </div>
      ))}
    </div>
  );
}

/** Stacked allocation by market value */
function AllocChart({ rows }: { rows: Row[] }) {
  const total = rows.reduce((s, r) => s + r.mv, 0) || 1;
  const colors = [
    "#0f766e",
    "#0d9488",
    "#14b8a6",
    "#2dd4bf",
    "#5eead4",
    "#99f6e4",
    "#f43f5e",
    "#fb7185",
    "#fda4af",
    "#a8a29e",
    "#78716c",
    "#57534e",
    "#44403c",
  ];
  const segs: Array<Row & { x: number; w: number; color: string }> = [];
  rows.reduce((offset, r, i) => {
    const w = (r.mv / total) * 100;
    segs.push({ ...r, x: offset, w, color: colors[i % colors.length] });
    return offset + w;
  }, 0);
  return (
    <div>
      <svg viewBox="0 0 100 14" className="h-8 w-full" preserveAspectRatio="none">
        {segs.map((s) => (
          <rect
            key={s.symbol}
            x={s.x}
            y={0}
            width={Math.max(0.4, s.w)}
            height={14}
            fill={s.color}
          />
        ))}
      </svg>
      <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-[var(--ink-soft)]">
        {segs.slice(0, 8).map((s) => (
          <span key={s.symbol} className="inline-flex items-center gap-1">
            <span className="h-2 w-2 rounded-sm" style={{ background: s.color }} />
            {s.symbol} {((s.mv / total) * 100).toFixed(0)}%
          </span>
        ))}
      </div>
    </div>
  );
}

export default function TodayPlan({
  desk,
  positions,
  buyingPower,
  busy,
  onAnalyzeNow,
  onProtectLosers,
}: Props) {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const iv = window.setInterval(() => setTick((n) => n + 1), 250);
    return () => window.clearInterval(iv);
  }, []);

  const rows = useMemo(() => rowsFromPositions(positions), [positions]);
  const cost = rows.reduce((s, r) => s + r.avg * r.qty, 0);
  const value = rows.reduce((s, r) => s + r.mv, 0);
  const pnlUsd = value - cost;
  const pnlPct = cost > 0 ? (pnlUsd / cost) * 100 : null;
  const goalPct = (desk?.dayGoal?.min || 0.01) * 100;
  const holePct = pnlPct == null ? goalPct : Math.max(0, goalPct - pnlPct);
  const holeUsd = cost > 0 ? (holePct / 100) * cost : null;

  const winners = rows.filter((r) => r.pnlPct > 0.15).sort((a, b) => b.pnlPct - a.pnlPct);
  const losers = rows.filter((r) => r.pnlPct < -0.15).sort((a, b) => a.pnlPct - b.pnlPct);

  // tick drives the second-resolution clock/countdown
  const { openLabel, clockLabel } = useMemo(
    () => ({ openLabel: countdown(msToOpen()), clockLabel: etClock() }),
    [tick]
  );
  const fusion = desk?.lastDecision;
  const fusionBroken =
    fusion?.source === "nim_error"
    || fusion?.source === "nim_unavailable"
    || fusion?.source === "nim_parse_error";

  const quality = desk?.dayQuality || null;
  const week = desk?.weekBand || null;
  const engineDown =
    fusionBroken
    || quality?.verdict === "engine_down"
    || desk?.engine?.healthy === false;
  // A flat day only counts as discipline when the engine actually chose cash.
  const flatByDecision = quality?.verdict === "flat_by_decision";
  const cited = fusion?.used || [];
  const propose = desk?.state?.morningPlan?.proposeArm;
  const stagingSym =
    propose?.symbol || desk?.openBrief?.staging?.symbol || null;

  const trades: Array<{ action: string; detail: string; tone: "go" | "stop" | "wait" | "add" }> = [];
  if (engineDown || desk?.refreshing) {
    trades.push({
      action: engineDown ? "ENGINE DOWN" : "ANALYZING",
      detail: engineDown
        ? "This is an outage, not a decision. Nothing was evaluated — fix the engine before trusting any flat day."
        : "Fusion is running — Staging will update when it finishes.",
      tone: engineDown ? "stop" : "wait",
    });
  } else if (fusion?.action?.startsWith("open_") && fusion.symbol) {
    trades.push({
      action: `OPEN ${fusion.action.replace("open_", "").toUpperCase()} ${fusion.symbol}`,
      detail: (fusion.why || "Fusion call for the open.").slice(0, 160),
      tone: "add",
    });
  } else if (fusion?.action === "pass") {
    trades.push({
      action: "CASH ON NEW NICKELS",
      detail: (fusion.why || "Fusion chose pass — make the day on the book you already have.").slice(0, 160),
      tone: "wait",
    });
  } else {
    trades.push({
      action: "WAITING ON FUSION",
      detail: "Hit Analyze for open — there is no trusted trade list until fusion returns.",
      tone: "wait",
    });
  }

  for (const w of winners.slice(0, 3)) {
    trades.push({
      action: `RAMP ${w.symbol}`,
      detail: `Already working ${fmtPct(w.pnlPct)} (${fmtUsd(w.pnlUsd)}). Add only here if size opens — not into losers.`,
      tone: "go",
    });
  }
  for (const l of losers.slice(0, 4)) {
    trades.push({
      action: `PROTECT ${l.symbol}`,
      detail: `Bleeding ${fmtPct(l.pnlPct)} (${fmtUsd(l.pnlUsd)}). Stop / trail — do not average down.`,
      tone: "stop",
    });
  }
  if (stagingSym && !fusion?.action?.startsWith("open_")) {
    trades.push({
      action: `STAGED ${stagingSym}`,
      detail: "In Staging / morning propose — not live until fusion or you Approve.",
      tone: "wait",
    });
  }

  // Weekly framing: the daily number is information, the WEEK is the target.
  const weekHole = week?.holePct ?? null;
  const weekPct = week?.weekPct ?? null;
  const weekGoal = week?.goalPct ?? 1;

  const answer = engineDown
    ? "No plan today — the engine never produced a decision. A flat day right now is an outage, not discipline. Fix NIM, re-run Analyze, then judge the book."
    : flatByDecision
      ? `Flat by decision — the engine read the book ${quality?.decisions ?? 1}× and chose cash. That is a valid day. Week to date ${weekPct == null ? "pending" : fmtPct(weekPct)} vs +${weekGoal}% weekly band.`
      : desk?.openBrief?.answer
        || (winners[0]
          ? `Press ${winners.slice(0, 2).map((w) => w.symbol).join(" + ")}; protect ${losers.slice(0, 2).map((l) => l.symbol).join(", ") || "dead weight"}. Weekly band, not today, is the target.`
          : "Protect first; wait for a cited fusion call.");

  return (
    <section className="mb-6 overflow-hidden rounded-[1.75rem] border-2 border-[var(--teal-deep)] bg-white shadow-[var(--shadow)]">
      <div className="flex flex-wrap items-center justify-between gap-2 bg-[var(--teal-deep)] px-5 py-3 text-[#ecfeff]">
        <p className="text-xs font-semibold uppercase tracking-[0.2em]">
          Today&apos;s plan — your money
        </p>
        <div className="flex flex-wrap items-center gap-3 text-xs">
          <span
            className={clsx(
              "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 font-semibold",
              engineDown
                ? "bg-[var(--danger)] text-white"
                : desk?.refreshing
                  ? "bg-white/20 text-white"
                  : "bg-[var(--ok)] text-white"
            )}
          >
            {engineDown ? (
              <AlertOctagon className="h-3.5 w-3.5" />
            ) : (
              <CheckCircle2 className="h-3.5 w-3.5" />
            )}
            Engine {engineDown ? "DOWN" : desk?.refreshing ? "thinking" : "OK"}
          </span>
          <span className="opacity-90">
            {clockLabel} ET · {openLabel}
          </span>
        </div>
      </div>

      {engineDown ? (
        <div className="border-b border-rose-200 bg-rose-50 px-5 py-3">
          <p className="text-sm font-semibold text-[var(--danger)]">
            No decision was made — this is an outage, not discipline.
          </p>
          <p className="mt-1 text-xs leading-relaxed text-rose-950/80">
            {desk?.engine?.note
              || quality?.plain
              || fusion?.why
              || "The reasoning engine failed (timeout / unusable output). Nothing in the book was evaluated, so a flat day tells you nothing about the plan."}
            {quality?.outages ? ` (${quality.outages} outage${quality.outages === 1 ? "" : "s"} today)` : ""}
          </p>
        </div>
      ) : flatByDecision ? (
        <div className="border-b border-teal-200 bg-teal-50 px-5 py-3">
          <p className="flex items-center gap-2 text-sm font-semibold text-[var(--teal-deep)]">
            <CheckCircle2 className="h-4 w-4" /> Flat by decision — this counts as a good day
          </p>
          <p className="mt-1 text-xs leading-relaxed text-teal-950/80">
            {quality?.plain
              || "The engine read the book and chose cash. No trade is a valid outcome when nothing earned risk."}
          </p>
        </div>
      ) : null}

      <div className="grid gap-0 border-b border-[var(--line)] lg:grid-cols-4">
        <div className="border-b border-[var(--line)] px-5 py-4 lg:border-b-0 lg:border-r">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--ink-soft)]">
            Book value
          </p>
          <p className="display mt-1 text-3xl font-semibold text-[var(--ink)]">
            {value > 0 ? fmtUsd(value) : "—"}
          </p>
          <p className="mt-1 text-xs text-[var(--ink-soft)]">
            Cost {cost > 0 ? fmtUsd(cost) : "—"} · BP {fmtUsd(buyingPower)}
          </p>
        </div>
        <div className="border-b border-[var(--line)] px-5 py-4 lg:border-b-0 lg:border-r">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--ink-soft)]">
            Open P&amp;L
          </p>
          <p
            className={clsx(
              "display mt-1 text-3xl font-semibold",
              (pnlUsd || 0) >= 0 ? "text-[var(--ok)]" : "text-[var(--danger)]"
            )}
          >
            {pnlPct == null ? "—" : fmtPct(pnlPct)}
          </p>
          <p className="mt-1 text-xs text-[var(--ink-soft)]">
            {pnlUsd === 0 && !cost ? "—" : fmtUsd(pnlUsd)} on {rows.length} holds
          </p>
        </div>
        <div className="border-b border-[var(--line)] px-5 py-4 lg:border-b-0 lg:border-r">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--ink-soft)]">
            Week to +{weekGoal}%
          </p>
          <p
            className={clsx(
              "display mt-1 text-3xl font-semibold",
              weekPct == null
                ? "text-[var(--ink-soft)]"
                : weekPct >= weekGoal
                  ? "text-[var(--ok)]"
                  : "text-[var(--ink)]"
            )}
          >
            {weekPct == null ? "—" : fmtPct(weekPct)}
          </p>
          <p className="mt-1 text-xs text-[var(--ink-soft)]">
            {weekPct == null
              ? "Weekly band starts once equity marks record"
              : weekHole && weekHole > 0
                ? `${fmtPct(weekHole)} left this week — not today`
                : "Weekly band met — protect it"}
          </p>
          <p className="mt-1 text-[11px] text-[var(--ink-soft)]">
            Today {pnlPct == null ? "—" : fmtPct(pnlPct)}
            {holeUsd != null && holePct > 0 ? ` · day gap ${fmtUsd(holeUsd)}` : ""}
          </p>
        </div>
        <div className="px-5 py-4">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--ink-soft)]">
            Open call
          </p>
          <p
            className={clsx(
              "mt-1 text-xl font-semibold",
              fusionBroken ? "text-[var(--danger)]" : "text-[var(--ink)]"
            )}
          >
            {desk?.refreshing || busy
              ? "Analyzing…"
              : fusionBroken
                ? "Fusion down — CASH"
                : fusion?.action?.startsWith("open_")
                  ? `${fusion.action.replace("open_", "")} ${fusion.symbol || ""}`
                  : fusion?.action === "pass"
                    ? "Cash / no spray"
                    : "No call yet"}
          </p>
          <p className="mt-1 line-clamp-2 text-xs text-[var(--ink-soft)]">
            {(fusion?.why || desk?.openBrief?.plain || "Run Analyze for a trusted open list.").slice(0, 120)}
          </p>
          {!engineDown ? (
            <p className="mt-1 text-[11px] font-medium text-[var(--ink-soft)]">
              {cited.length
                ? `Cited ${cited.length} pack field${cited.length === 1 ? "" : "s"}`
                : "No citations — call is unauditable"}
            </p>
          ) : null}
        </div>
      </div>

      {cited.length ? (
        <div className="border-b border-[var(--line)] bg-[var(--sand)]/30 px-5 py-3">
          <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--teal)]">
            <Quote className="h-3 w-3" /> What the agent actually used
          </p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {cited.slice(0, 6).map((c) => (
              <span
                key={c}
                className="mono rounded-md border border-[var(--line)] bg-white px-2 py-0.5 text-[11px] text-[var(--ink)]"
              >
                {c}
              </span>
            ))}
          </div>
        </div>
      ) : null}

      <div className="grid gap-0 lg:grid-cols-2">
        <div className="border-b border-[var(--line)] px-5 py-4 lg:border-b-0 lg:border-r">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--teal)]">
            The answer
          </p>
          <p className="mt-2 text-lg font-semibold leading-snug text-[var(--ink)] sm:text-xl">
            {answer}
          </p>
          <p className="mt-4 text-xs font-semibold uppercase tracking-[0.14em] text-[var(--teal)]">
            Trades / actions today
          </p>
          <ul className="mt-2 space-y-2">
            {trades.slice(0, 8).map((t) => (
              <li
                key={`${t.action}-${t.detail.slice(0, 12)}`}
                className="flex gap-3 rounded-xl border border-[var(--line)] bg-[var(--sand)]/40 px-3 py-2"
              >
                <span
                  className={clsx(
                    "mt-0.5 shrink-0 rounded-md px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white",
                    t.tone === "go" && "bg-[var(--ok)]",
                    t.tone === "stop" && "bg-[var(--danger)]",
                    t.tone === "wait" && "bg-stone-500",
                    t.tone === "add" && "bg-[var(--teal)]"
                  )}
                >
                  {t.action}
                </span>
                <span className="text-sm leading-snug text-[var(--ink-soft)]">{t.detail}</span>
              </li>
            ))}
          </ul>
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              disabled={busy || Boolean(desk?.refreshing)}
              onClick={() => void onAnalyzeNow()}
              className="inline-flex items-center gap-2 rounded-full bg-[var(--teal)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
            >
              <RefreshCw className={clsx("h-4 w-4", (busy || desk?.refreshing) && "animate-spin")} />
              Analyze for open
            </button>
            {onProtectLosers && losers.length > 0 ? (
              <button
                type="button"
                disabled={busy}
                onClick={() => void onProtectLosers()}
                className="inline-flex items-center gap-2 rounded-full border border-[var(--danger)]/50 bg-white px-4 py-2 text-sm font-semibold text-[var(--danger)] disabled:opacity-50"
              >
                <ShieldAlert className="h-4 w-4" />
                Protect losers
              </button>
            ) : null}
          </div>
        </div>

        <div className="px-5 py-4">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--teal)]">
            Money graph — P&amp;L by name
          </p>
          <div className="mt-3">
            {rows.length ? (
              <PnlBars rows={rows} />
            ) : (
              <p className="text-sm text-[var(--ink-soft)]">Waiting on live positions…</p>
            )}
          </div>
          <p className="mt-5 text-xs font-semibold uppercase tracking-[0.14em] text-[var(--teal)]">
            Where the money sits
          </p>
          <div className="mt-3">
            {rows.length ? <AllocChart rows={rows} /> : null}
          </div>
        </div>
      </div>
    </section>
  );
}
