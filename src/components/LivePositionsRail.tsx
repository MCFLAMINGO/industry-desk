"use client";

import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { RefreshCw } from "lucide-react";
import clsx from "clsx";
import { fmtPct, fmtUsd } from "@/lib/desk";
import type { RhLivePosition } from "@/lib/robinhood";

const POLL_MS = 8_000;

type Props = {
  positions: RhLivePosition[];
  /** Optional tape/rank marks keyed by symbol (fallback). */
  markBySymbol?: Record<string, number | null | undefined>;
  loading: boolean;
  error: string | null;
  lastTickAt: number | null;
  onRefresh: () => void | Promise<void>;
  disabled?: boolean;
};

function resolveMark(
  p: RhLivePosition,
  markBySymbol?: Record<string, number | null | undefined>
): number | null {
  const fromTape = markBySymbol?.[p.symbol];
  if (fromTape != null && Number.isFinite(fromTape)) return Number(fromTape);
  if (p.lastPrice != null && Number.isFinite(p.lastPrice)) return p.lastPrice;
  if (p.marketValue != null && p.quantity) return p.marketValue / Math.abs(p.quantity);
  return null;
}

function formatClock(ts: number | null) {
  if (!ts) return "—";
  return new Date(ts).toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
  });
}

export default function LivePositionsRail({
  positions,
  markBySymbol,
  loading,
  error,
  lastTickAt,
  onRefresh,
  disabled,
}: Props) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const iv = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(iv);
  }, []);

  const ageMs = lastTickAt ? Math.max(0, now - lastTickAt) : null;
  const untilNext = lastTickAt ? Math.max(0, POLL_MS - (ageMs || 0)) : POLL_MS;
  const progress = lastTickAt ? Math.min(1, (ageMs || 0) / POLL_MS) : 0;
  const nextSec = Math.ceil(untilNext / 1000);

  const rows = useMemo(
    () =>
      positions.map((p) => {
        const mark = resolveMark(p, markBySymbol);
        const pnlPct =
          mark != null && p.avgCost != null && p.avgCost !== 0
            ? ((mark - p.avgCost) / p.avgCost) * 100
            : null;
        const pnlUsd =
          mark != null && p.avgCost != null
            ? (mark - p.avgCost) * p.quantity
            : null;
        return { p, mark, pnlPct, pnlUsd };
      }),
    [positions, markBySymbol]
  );

  return (
    <section className="mb-8">
      <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-[var(--teal)]">
            <span className="live-dot" aria-hidden />
            Live positions
            <span className="live-pill mono normal-case tracking-normal">tape live</span>
          </p>
          <p className="mt-1 text-sm text-[var(--ink-soft)]">
            Agentic holdings first — marks refresh every {POLL_MS / 1000}s. Dry-run play-by-play
            below is paper only.
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-[var(--ink-soft)]">
            <span className="mono">
              Last tick {formatClock(lastTickAt)}
              {ageMs != null ? ` · ${Math.floor(ageMs / 1000)}s ago` : ""}
            </span>
            <span className="mono text-[var(--teal-deep)]">Next poll in {nextSec}s</span>
            <span className="tick-meter" title="Time until next positions poll" aria-hidden>
              <motion.span
                className="tick-meter__fill"
                animate={{ scaleX: progress }}
                transition={{ duration: 0.2, ease: "linear" }}
              />
            </span>
          </div>
        </div>
        <button
          type="button"
          disabled={loading || disabled}
          onClick={() => void onRefresh()}
          className="inline-flex items-center gap-1.5 rounded-full border border-[var(--line)] bg-white/70 px-3 py-1.5 text-sm font-medium text-[var(--teal-deep)] hover:border-[var(--teal)] disabled:opacity-50"
        >
          <RefreshCw className={clsx("h-3.5 w-3.5", loading && "animate-spin")} />
          {loading ? "Ticking…" : "Refresh positions"}
        </button>
      </div>

      {error ? <p className="mb-3 text-sm text-[var(--danger)]">Positions — {error}</p> : null}

      {loading && rows.length === 0 ? (
        <div className="glass rounded-3xl p-5 text-sm text-[var(--ink-soft)]">
          Loading Agentic positions…
        </div>
      ) : rows.length === 0 ? (
        <div className="glass rounded-3xl border border-dashed border-[var(--line)] p-5 text-sm text-[var(--ink-soft)]">
          No live Agentic equity positions right now. Place in Robinhood or Approve live, then
          Refresh positions.
        </div>
      ) : (
        <div className="grid gap-3">
          {rows.map(({ p, mark, pnlPct, pnlUsd }) => (
            <article
              key={p.symbol}
              className="glass relative overflow-hidden rounded-3xl border border-emerald-300/70 bg-emerald-50/40 p-4 sm:p-5"
            >
              {lastTickAt ? (
                <motion.span
                  key={lastTickAt}
                  className="tick-sweep"
                  initial={{ x: "-120%", opacity: 0.55 }}
                  animate={{ x: "120%", opacity: 0 }}
                  transition={{ duration: 0.85, ease: "easeOut" }}
                  aria-hidden
                />
              ) : null}
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="display text-2xl font-semibold">{p.symbol}</h2>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-600 px-2.5 py-0.5 text-xs font-semibold text-white">
                  <span className="live-dot live-dot--on-dark" aria-hidden />
                  LIVE · RH held
                </span>
                <span className="rounded-full border border-[var(--line)] px-2 py-0.5 text-xs uppercase">
                  {p.side}
                </span>
                <span className="mono text-[10px] uppercase tracking-[0.14em] text-emerald-800/80">
                  tick {formatClock(lastTickAt)}
                </span>
              </div>
              <p className="mt-1 text-sm text-[var(--ink)]">
                <span className="mono">{p.quantity}</span> sh
                {p.avgCost != null ? (
                  <>
                    {" "}
                    · avg <span className="mono">{fmtUsd(p.avgCost)}</span>
                  </>
                ) : null}
                {mark != null ? (
                  <>
                    {" "}
                    · mark{" "}
                    <AnimatePresence mode="popLayout" initial={false}>
                      <motion.span
                        key={`${p.symbol}-${mark.toFixed(4)}`}
                        initial={{ y: 6, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        exit={{ y: -6, opacity: 0 }}
                        transition={{ duration: 0.25 }}
                        className="mono inline-block font-semibold text-emerald-900"
                      >
                        {fmtUsd(mark)}
                      </motion.span>
                    </AnimatePresence>
                  </>
                ) : null}
                {p.marketValue != null ? (
                  <>
                    {" "}
                    · <span className="mono">{fmtUsd(p.marketValue)}</span>
                  </>
                ) : null}
                {pnlPct != null ? (
                  <>
                    {" "}
                    · P&L{" "}
                    <span
                      className={clsx(
                        "mono font-semibold",
                        pnlPct >= 0 ? "text-emerald-800" : "text-amber-900"
                      )}
                    >
                      {fmtPct(pnlPct)}
                    </span>
                  </>
                ) : null}
                {pnlUsd != null ? (
                  <>
                    {" "}
                    (
                    <span className="mono">
                      {pnlUsd >= 0 ? "+" : ""}
                      {fmtUsd(pnlUsd)}
                    </span>
                    )
                  </>
                ) : null}
              </p>
              <p className="mt-1 text-xs text-emerald-900">
                Real Agentic position — not the dry-run card in play-by-play.
              </p>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

export { POLL_MS as LIVE_POSITIONS_POLL_MS };
