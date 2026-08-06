"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Activity, Loader2, RefreshCw } from "lucide-react";
import clsx from "clsx";
import { toast } from "sonner";
import {
  fetchOpenBook,
  fmtPct,
  planFillTruth,
  runPlanPhase,
  type DeskPlan,
} from "@/lib/desk";

const PHASES = ["wait", "open", "monitor", "add", "close"] as const;

function num(n: unknown): number | null {
  const v = Number(n);
  return Number.isFinite(v) ? v : null;
}

function fmtPx(n: number | null | undefined) {
  if (n == null) return "—";
  return n >= 100 ? n.toFixed(2) : n.toFixed(3);
}

function pnlPct(side: string | undefined, entry: number | null, mark: number | null) {
  if (entry == null || mark == null || entry === 0) return null;
  const long = !side || side === "long" || side === "hedge";
  return long ? ((mark - entry) / entry) * 100 : ((entry - mark) / entry) * 100;
}

function progressToTarget(
  side: string | undefined,
  stop: number | null,
  target: number | null,
  mark: number | null
) {
  if (mark == null || stop == null || target == null || stop === target) return null;
  const short = side === "short";
  const lo = short ? target : stop;
  const hi = short ? stop : target;
  const span = hi - lo;
  if (!span) return null;
  const raw = short ? ((hi - mark) / span) * 100 : ((mark - lo) / span) * 100;
  return Math.max(0, Math.min(100, raw));
}

function entryMarkerPct(
  side: string | undefined,
  entry: number | null,
  stop: number | null,
  target: number | null
) {
  if (entry == null || stop == null || target == null || stop === target) return 50;
  const short = side === "short";
  const lo = short ? target : stop;
  const hi = short ? stop : target;
  const span = hi - lo;
  if (!span) return 50;
  const raw = short ? ((hi - entry) / span) * 100 : ((entry - lo) / span) * 100;
  return Math.max(0, Math.min(100, raw));
}

function phaseIndex(plan: DeskPlan) {
  const active = plan.steps?.find((s) => s.status === "active" || s.status === "reviewed");
  if (active?.phase) {
    const i = PHASES.indexOf(active.phase as (typeof PHASES)[number]);
    if (i >= 0) return i;
  }
  if (plan.status === "waiting_trigger") return 0;
  if (plan.status === "monitoring") return 2;
  if (plan.status === "completed" || plan.status === "cancelled") return 4;
  return 1;
}

function PlayCard({
  plan,
  busyPhase,
  onPhase,
}: {
  plan: DeskPlan;
  busyPhase: string | null;
  onPhase: (planId: string, phase: string) => void;
}) {
  const levels = plan.levels || {};
  const entry = num(levels.entry) ?? num(plan.last_mark);
  const stop = num(levels.stop);
  const target = num(levels.target);
  const mark = num(plan.last_mark);
  const pnl = pnlPct(plan.side, entry, mark);
  const progress = progressToTarget(plan.side, stop, target, mark);
  const entryPct = entryMarkerPct(plan.side, entry, stop, target);
  const activePhase = phaseIndex(plan);
  const latest =
    [...(plan.events || [])].reverse().find((e) => e.event && e.event !== "tick") ||
    [...(plan.events || [])].slice(-1)[0] ||
    null;
  const lastTick = [...(plan.events || [])]
    .reverse()
    .find((e) => e.event === "tick" || e.event === "tick_wait");
  const live = Boolean(plan.live);
  const monitoring = plan.status === "monitoring" || plan.status === "waiting_trigger";
  const fill = planFillTruth(plan);
  const hasPosition = fill.kind === "filled";
  const waitingSession =
    plan.status === "waiting_trigger" &&
    (plan.open_when === "next_rth" ||
      plan.steps?.some((s) =>
        s.phase === "wait" && /next session|next RTH|Off-hours/i.test(String(s.detail || ""))
      ));
  const openAtLabel =
    plan.earliest_open_at != null
      ? new Date(plan.earliest_open_at).toLocaleString("en-US", {
          timeZone: "America/New_York",
          weekday: "short",
          month: "short",
          day: "numeric",
          hour: "numeric",
          minute: "2-digit",
          timeZoneName: "short",
        })
      : null;
  const pnlTone =
    !hasPosition && fill.kind !== "dry"
      ? "text-[var(--ink-soft)]"
      : pnl == null
        ? "text-[var(--ink-soft)]"
        : pnl >= 0
          ? "text-[var(--ok)]"
          : "text-[var(--danger)]";
  const doneOrCancelled = plan.status === "completed" || plan.status === "cancelled";

  return (
    <article className="glass rounded-3xl p-4 sm:p-5 space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="display text-2xl font-semibold">{plan.symbol || "—"}</h3>
            <span className="rounded-full border border-[var(--line)] px-2 py-0.5 text-xs uppercase">
              {plan.side || "long"}
            </span>
            <span
              className={clsx(
                "rounded-full px-2 py-0.5 text-xs font-semibold",
                fill.kind === "filled" && "bg-[var(--ok)] text-white",
                fill.kind === "submitted_unfilled" && "bg-amber-500 text-amber-950",
                fill.kind === "dry" && "bg-amber-100 text-amber-900",
                fill.kind === "unknown" && live && "bg-[var(--teal-deep)] text-white",
                fill.kind === "unknown" && !live && "bg-amber-100 text-amber-900"
              )}
            >
              {fill.chip}
            </span>
            {waitingSession ? (
              <span className="rounded-full bg-sky-100 px-2 py-0.5 text-xs text-sky-900">
                Armed · opens {openAtLabel || "next RTH"}
              </span>
            ) : (
              <span className="text-xs text-[var(--ink-soft)]">
                {plan.status?.replace(/_/g, " ")}
              </span>
            )}
          </div>
          <p className="mt-1 text-sm text-[var(--ink-soft)]">
            Mark <span className="mono text-[var(--ink)]">{fmtPx(mark)}</span>
            {" · "}Entry <span className="mono">{fmtPx(entry)}</span>
            {" · "}Stop <span className="mono">{fmtPx(stop)}</span>
            {" · "}Target <span className="mono">{fmtPx(target)}</span>
          </p>
          <p
            className={clsx(
              "mt-1 text-xs font-medium",
              fill.kind === "submitted_unfilled" ? "text-[var(--danger)]" : "text-[var(--ink-soft)]"
            )}
          >
            {fill.label}
          </p>
        </div>
        <div className="text-right">
          <div className={clsx("text-2xl font-semibold mono", pnlTone)}>
            {hasPosition || fill.kind === "dry" ? fmtPct(pnl) : "—"}
          </div>
          <div className="text-xs text-[var(--ink-soft)]">
            {fill.kind === "filled"
              ? "Position P&L vs entry"
              : fill.kind === "dry"
                ? "Paper mark"
                : "No position yet"}
          </div>
        </div>
      </div>

      <div className="space-y-1.5">
        <div className="flex justify-between text-[11px] uppercase tracking-wider text-[var(--ink-soft)]">
          <span>Stop {fmtPx(stop)}</span>
          <span className={pnlTone}>
            {pnl != null && pnl >= 0 ? "In profit / toward target" : "Toward stop"}
          </span>
          <span>Target {fmtPx(target)}</span>
        </div>
        <div className="relative h-3 overflow-hidden rounded-full border border-[var(--line)] bg-white/70">
          <div
            className="absolute inset-y-0 left-0"
            style={{
              width: "100%",
              background:
                "linear-gradient(90deg, rgba(180,83,9,0.35), rgba(245,158,11,0.22), rgba(4,120,87,0.4))",
            }}
          />
          <div
            className="absolute top-0 bottom-0 w-0.5 bg-[var(--ink)]/45"
            style={{ left: `${entryPct}%` }}
          />
          {progress != null && (
            <div
              className={clsx(
                "absolute top-1/2 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2",
                live
                  ? "border-[#99f6e4] bg-[var(--teal-bright)] shadow-[0_0_12px_rgba(20,184,166,0.55)]"
                  : "border-amber-200 bg-amber-400",
                monitoring && "animate-pulse"
              )}
              style={{ left: `${progress}%` }}
            />
          )}
        </div>
        {lastTick?.detail ? (
          <p className="text-xs text-[var(--ink-soft)]">
            Last tick: <span className="font-medium text-[var(--ink)]">{lastTick.detail}</span>
          </p>
        ) : null}
      </div>

      <ol className="grid grid-cols-5 gap-1">
        {PHASES.map((phase, i) => {
          const step = plan.steps?.find((s) => s.phase === phase);
          const done = step?.status === "done" || step?.status === "dry_run_done";
          const active = i === activePhase;
          const busy = busyPhase === `${plan.id}:${phase}`;
          return (
            <li key={phase}>
              <button
                type="button"
                disabled={doneOrCancelled || busy}
                title={
                  phase === "open" && !hasPosition
                    ? "Retry / force open (short = long put on Agentic)"
                    : phase === "close" && !hasPosition
                      ? "No fill — cancels this armed plan"
                      : `Run ${phase} now`
                }
                onClick={() => onPhase(plan.id, phase)}
                className={clsx(
                  "w-full rounded-xl border px-1 py-1.5 text-center text-[11px] capitalize transition-colors",
                  "hover:border-[var(--teal)] hover:text-[var(--teal-deep)] disabled:cursor-not-allowed disabled:opacity-50",
                  active && "border-[var(--teal)] bg-[rgba(20,184,166,0.12)] font-semibold text-[var(--teal-deep)]",
                  !active && done && "border-emerald-200 bg-emerald-50 text-emerald-800",
                  !active && !done && "border-[var(--line)] bg-white/50 text-[var(--ink-soft)]",
                  busy && "animate-pulse"
                )}
              >
                {busy ? "…" : phase}
              </button>
            </li>
          );
        })}
      </ol>
      <p className="text-[11px] text-[var(--ink-soft)]">
        Tap a phase to act — wait/monitor ticks; open retries fill; add sizes in; close exits (or cancels if no fill).
      </p>

      {latest ? (
        <p className="text-xs text-[var(--ink-soft)]">
          Play-by-play:{" "}
          <span className="font-medium text-[var(--ink)]">{latest.event}</span>
          {latest.detail ? ` — ${latest.detail}` : ""}
          {latest.at ? ` · ${new Date(latest.at).toLocaleTimeString()}` : ""}
        </p>
      ) : null}
    </article>
  );
}

export default function PlayByPlayRail({
  bookFilter,
  symbols,
  refreshToken = 0,
  pinPlanId = null,
  pinSymbol = null,
}: {
  bookFilter?: string | null;
  symbols?: string[];
  /** Bump from parent after Preview / Approve / desk Refresh */
  refreshToken?: number;
  /** Capital-slot plan — always shown, even if completed or off-book */
  pinPlanId?: string | null;
  pinSymbol?: string | null;
}) {
  const [plans, setPlans] = useState<DeskPlan[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [busyPhase, setBusyPhase] = useState<string | null>(null);

  const load = useCallback(async (opts?: { manual?: boolean; quiet?: boolean }) => {
    const manual = Boolean(opts?.manual);
    if (manual) setRefreshing(true);
    try {
      const data = await fetchOpenBook();
      if (data.error) throw new Error(data.error);
      let next = data.plans || [];
      // Capital-slot sleeve may be completed (dry stop) or missing from ACTIVE list —
      // still pull it so "the play" appears on this rail.
      if (pinPlanId && !next.some((p) => p.id === pinPlanId)) {
        try {
          const res = await fetch(
            `/api/ceo?action=plans&id=${encodeURIComponent(pinPlanId)}`,
            { cache: "no-store" }
          );
          const one = (await res.json()) as { plan?: DeskPlan };
          if (one.plan) next = [one.plan, ...next];
        } catch {
          /* keep list */
        }
      }
      setPlans(next);
      setError(null);
      const at = new Date().toISOString();
      setUpdatedAt(at);
      if (manual && !opts?.quiet) {
        const open = next.filter((p) => p.status !== "completed" && p.status !== "cancelled");
        toast.success("Play-by-play updated", {
          description: `${open.length} open plan${open.length === 1 ? "" : "s"} · ${new Date(at).toLocaleTimeString()}`,
        });
      }
      return next;
    } catch (e) {
      const msg = (e as Error).message;
      setError(msg);
      if (manual) toast.error("Play-by-play refresh failed", { description: msg });
      return null;
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [pinPlanId]);

  useEffect(() => {
    load({ quiet: true });
    const iv = window.setInterval(() => load({ quiet: true }), 10_000);
    return () => window.clearInterval(iv);
  }, [load]);

  useEffect(() => {
    if (refreshToken > 0) load({ quiet: true });
  }, [refreshToken, load]);

  const active = useMemo(() => {
    const pin = pinPlanId || null;
    const pinSym = pinSymbol ? String(pinSymbol).toUpperCase() : null;
    let open = plans.filter((p) => {
      if (pin && p.id === pin) return true;
      if (pinSym && String(p.symbol || "").toUpperCase() === pinSym
        && (p.kind === "long_call" || p.kind === "long_put" || p.options_risk || p.order_kind === "options")) {
        return true;
      }
      return p.status !== "completed" && p.status !== "cancelled";
    });
    if (bookFilter && bookFilter !== "all" && symbols?.length) {
      const set = new Set(symbols.map((s) => s.toUpperCase()));
      open = open.filter((p) => {
        if (pin && p.id === pin) return true;
        if (pinSym && String(p.symbol || "").toUpperCase() === pinSym) return true;
        // Option sleeves are desk-wide (capital slot), not book-tab inventory.
        if (p.kind === "long_call" || p.kind === "long_put" || p.options_risk) return true;
        return set.has(String(p.symbol || "").toUpperCase());
      });
    }
    open.sort((a, b) => {
      const ap = pin && a.id === pin ? 1 : 0;
      const bp = pin && b.id === pin ? 1 : 0;
      if (bp !== ap) return bp - ap;
      return Number(Boolean(b.live)) - Number(Boolean(a.live));
    });
    return open;
  }, [plans, bookFilter, symbols, pinPlanId, pinSymbol]);

  const spinning = loading || refreshing;

  const handlePhase = useCallback(
    async (planId: string, phase: string) => {
      const key = `${planId}:${phase}`;
      setBusyPhase(key);
      try {
        const out = await runPlanPhase(planId, phase);
        if (out.error) throw new Error(out.error);
        if (out.plan) {
          setPlans((prev) => {
            const next = prev.map((p) => (p.id === planId ? (out.plan as DeskPlan) : p));
            if (!next.some((p) => p.id === planId) && out.plan) next.unshift(out.plan as DeskPlan);
            return next;
          });
        } else {
          await load({ quiet: true });
        }
        const action = out.actions?.[0]?.type || phase;
        const detail = out.detail || out.actions?.[0]?.result || out.plan?.status || "ok";
        if (action === "cancelled_no_fill" || action === "cancelled_unsupported_no_fill") {
          toast.message("Plan cancelled", { description: String(detail) });
        } else if (String(detail).includes("EQUITY_SHORT") || String(detail).includes("UNSUPPORTED")) {
          toast.error(`${phase} blocked`, { description: String(detail) });
        } else {
          toast.success(`${phase} · ${action}`, { description: String(detail).slice(0, 160) });
        }
      } catch (e) {
        toast.error(`${phase} failed`, { description: (e as Error).message });
      } finally {
        setBusyPhase(null);
      }
    },
    [load]
  );

  return (
    <section className="mb-8">
      <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--teal)]">
            Play-by-play
          </p>
          <p className="mt-1 text-sm text-[var(--ink-soft)]">
            Desk-armed plans. Capital-slot option sleeves stay pinned here (all books). Dry-run is
            paper — real fills are in{" "}
            <span className="font-medium text-[var(--ink)]">Live positions</span> at the top.
          </p>
        </div>
        <button
          type="button"
          disabled={spinning}
          onClick={() => load({ manual: true })}
          className="inline-flex items-center gap-1.5 rounded-full border border-[var(--line)] bg-white/70 px-3 py-1.5 text-sm font-medium text-[var(--teal-deep)] hover:border-[var(--teal)] disabled:opacity-50"
        >
          {spinning ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <RefreshCw className="h-3.5 w-3.5" />
          )}
          {refreshing ? "Refreshing…" : "Refresh open book"}
        </button>
      </div>

      {error ? <p className="mb-3 text-sm text-[var(--danger)]">Could not load open book — {error}</p> : null}

      <div className="grid gap-3">
        {active.length === 0 && !loading ? (
          <div className="glass rounded-3xl p-5 text-sm text-[var(--ink-soft)]">
            No open plans{bookFilter && bookFilter !== "all" ? " for this book" : ""}. Preview or
            Approve live and this rail lights up.
          </div>
        ) : (
          active.map((p) => (
            <PlayCard key={p.id} plan={p} busyPhase={busyPhase} onPhase={handlePhase} />
          ))
        )}
      </div>

      {updatedAt ? (
        <p className="mt-3 flex items-center gap-1.5 text-xs text-[var(--ink-soft)]">
          <Activity className="h-3 w-3" />
          Last sync {new Date(updatedAt).toLocaleTimeString()} · auto every 10s
        </p>
      ) : null}
    </section>
  );
}
