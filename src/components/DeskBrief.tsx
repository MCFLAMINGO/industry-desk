"use client";

import { useMemo } from "react";
import clsx from "clsx";
import { fmtPct, fmtUsd, type DeskDayState, type DeskRank } from "@/lib/desk";

export type IndustryIdea = {
  industryId: string;
  label: string;
  tiltScore: number;
  tapePct: number | null;
  idea: DeskRank;
  basedOn: string;
};

export function buildIndustryIdeas(desk: DeskDayState | null): IndustryIdea[] {
  const tilts = desk?.state?.industryTilt || [];
  const ranks = desk?.state?.rankings || [];
  if (!tilts.length && !ranks.length) return [];

  const byBook = new Map<string, DeskRank[]>();
  for (const r of ranks) {
    const id = r.industryId || "other";
    if (!byBook.has(id)) byBook.set(id, []);
    byBook.get(id)!.push(r);
  }

  const syn = desk?.state?.synthesis || desk?.state?.morningPlan?.synthesis || null;
  const favor = syn?.global?.action?.favor || [];
  const fade = syn?.global?.action?.fade || [];
  const regime = syn?.global?.regime || syn?.global?.action?.note || null;

  const fromTilts = tilts.map((t) => {
    const rows = (byBook.get(t.industryId) || []).slice().sort(
      (a, b) => (b.score || 0) - (a.score || 0)
    );
    const idea = rows[0];
    if (!idea) return null;
    const synR = idea.synthesis;
    const favored = favor.some(
      (f) =>
        String(f).toLowerCase().includes(String(t.label || "").toLowerCase()) ||
        String(f).toLowerCase().includes(String(t.industryId || ""))
    );
    const faded = fade.some(
      (f) =>
        String(f).toLowerCase().includes(String(t.label || "").toLowerCase()) ||
        String(f).toLowerCase().includes(String(t.industryId || ""))
    );
    const basedOn = [
      regime ? `Macro: ${regime}` : null,
      t.changePct != null ? `Book tape ${fmtPct(t.changePct)}` : null,
      `Tilt score ${Number(t.avgScore).toFixed(1)}`,
      synR?.recommend ? `Micro ${synR.recommend}` : null,
      synR?.edge?.hasEdge ? `Edge p=${synR.edge.p} E=${synR.edge.expectancy}` : "No clean edge yet",
      favored ? "Global favor" : null,
      faded ? "Global fade — size small or skip" : null,
      synR?.thesis ? synR.thesis : null,
    ]
      .filter(Boolean)
      .join(" · ");
    return {
      industryId: t.industryId,
      label: t.label || t.industryId,
      tiltScore: Number(t.avgScore) || 0,
      tapePct: t.changePct ?? null,
      idea,
      basedOn,
    } as IndustryIdea;
  }).filter(Boolean) as IndustryIdea[];

  if (fromTilts.length) {
    return fromTilts.sort((a, b) => b.tiltScore - a.tiltScore);
  }

  // Fallback: group rankings when tilt missing
  return [...byBook.entries()]
    .map(([id, rows]) => {
      const sorted = rows.slice().sort((a, b) => (b.score || 0) - (a.score || 0));
      const idea = sorted[0];
      if (!idea) return null;
      return {
        industryId: id,
        label: idea.industryLabel || id,
        tiltScore: idea.score || 0,
        tapePct: idea.changePct ?? null,
        idea,
        basedOn: idea.synthesis?.thesis || idea.reasons?.slice(0, 3).join(" · ") || "Tape lead",
      } as IndustryIdea;
    })
    .filter(Boolean)
    .sort((a, b) => (b!.tiltScore) - (a!.tiltScore)) as IndustryIdea[];
}

type Props = {
  desk: DeskDayState | null;
  buyingPower: number | null;
  heldCount: number;
  onSelectSymbol?: (symbol: string) => void;
  selectedSymbol?: string | null;
};

export default function DeskBrief({
  desk,
  buyingPower,
  heldCount,
  onSelectSymbol,
  selectedSymbol,
}: Props) {
  const ideas = useMemo(() => buildIndustryIdeas(desk), [desk]);
  const mp = desk?.state?.morningPlan;
  const syn = desk?.state?.synthesis || mp?.synthesis || null;
  const thinking =
    mp?.narrative ||
    syn?.global?.action?.note ||
    syn?.global?.narrative ||
    syn?.narrative ||
    desk?.state?.note ||
    "Hit Re-run fusion to rebuild today’s industry ideas from the live Robinhood tape.";
  const et = desk?.et;
  const session = et?.isRth
    ? "RTH open"
    : et?.isMorningPlanWindow
      ? "Morning plan window"
      : et?.isAfterClose
        ? "After the close"
        : "Session closed";

  const fusion = desk?.lastDecision;
  const fusionOk = fusion?.action && fusion.action !== "pass" && fusion.source !== "nim_error";

  return (
    <section className="glass mb-8 rounded-3xl p-5 sm:p-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--teal)]">
            Today’s desk
          </p>
          <h2 className="display mt-1 text-2xl font-semibold text-[var(--ink)] sm:text-3xl">
            {mp?.headline || "Where we are · what we’re thinking"}
          </h2>
        </div>
        <p className="text-xs text-[var(--ink-soft)]">
          {session}
          {desk?.state?.updatedAt
            ? ` · tape ${new Date(desk.state.updatedAt).toLocaleTimeString()}`
            : null}
        </p>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <div className="rounded-2xl border border-[var(--line)] bg-white/55 px-3 py-3 lg:col-span-1">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--teal-deep)]">
            Where we are
          </p>
          <ul className="mt-2 space-y-1.5 text-sm text-[var(--ink)]">
            <li>
              Buying power{" "}
              <span className="mono font-semibold">{fmtUsd(buyingPower)}</span>
            </li>
            <li>
              Held names <span className="mono font-semibold">{heldCount}</span>
            </li>
            <li>
              Day band{" "}
              <span className="mono font-semibold">
                {Math.round((desk?.dayGoal?.min || 0.01) * 100)}–
                {Math.round((desk?.dayGoal?.stretch || 0.03) * 100)}%
              </span>
              {desk?.dayPnlPctEst != null ? (
                <>
                  {" "}
                  · book {fmtPct(desk.dayPnlPctEst * 100)}
                </>
              ) : null}
            </li>
            <li className="text-[var(--ink-soft)]">
              Entry = NIM fusion over full desk pack — not an uptape spray.
            </li>
          </ul>
        </div>

        <div className="rounded-2xl border border-[var(--line)] bg-white/55 px-3 py-3 lg:col-span-2">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--teal-deep)]">
            What we’re thinking
          </p>
          <p className="mt-2 text-sm leading-relaxed text-[var(--ink)]">{thinking}</p>
          {fusion ? (
            <p className="mt-3 border-t border-[var(--line)] pt-3 text-sm">
              <span className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--teal)]">
                Fusion now
              </span>
              <span className="mono ml-2 text-[var(--ink)]">
                {fusion.action || "—"}
                {fusion.symbol ? ` · ${fusion.symbol}` : ""}
              </span>
              <span className="mt-1 block text-[var(--ink-soft)]">
                {fusion.why || "No why yet."}
              </span>
              {!fusionOk && fusion.source === "nim_error" ? (
                <span className="mt-1 block text-xs text-[var(--danger)]">
                  Fusion timed out — staying cash until Re-run fusion succeeds. No spray fallback.
                </span>
              ) : null}
            </p>
          ) : null}
        </div>
      </div>

      <div className="mt-5">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--teal)]">
          By industry — based on this, we like…
        </p>
        <p className="mt-1 text-xs text-[var(--ink-soft)]">
          Each book’s lead idea with the evidence chain. Tap a name to stage it (chart + Preview / Approve).
        </p>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          {ideas.length === 0 ? (
            <p className="text-sm text-[var(--ink-soft)]">
              No industry ideas yet — Re-run fusion after quotes land.
            </p>
          ) : (
            ideas.map((row) => {
              const active =
                selectedSymbol &&
                row.idea.symbol?.toUpperCase() === selectedSymbol.toUpperCase();
              return (
                <button
                  key={row.industryId}
                  type="button"
                  onClick={() => row.idea.symbol && onSelectSymbol?.(row.idea.symbol)}
                  className={clsx(
                    "rounded-2xl border px-3 py-3 text-left transition-colors",
                    active
                      ? "border-[var(--teal)] bg-[var(--teal)]/10"
                      : "border-[var(--line)] bg-white/50 hover:border-[var(--teal)]/50"
                  )}
                >
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--teal-deep)]">
                      {row.label}
                    </p>
                    <p className="mono text-xs text-[var(--ink-soft)]">
                      tilt {row.tiltScore.toFixed(1)}
                      {row.tapePct != null ? ` · tape ${fmtPct(row.tapePct)}` : ""}
                    </p>
                  </div>
                  <p className="mt-1.5 text-sm font-semibold text-[var(--ink)]">
                    <span className="mono">{row.idea.symbol}</span>{" "}
                    {row.idea.side} · {row.idea.strategy} · {row.idea.horizon}
                    {row.idea.synthesis?.recommend ? (
                      <span className="ml-2 text-xs font-medium text-[var(--teal-deep)]">
                        {row.idea.synthesis.recommend}
                      </span>
                    ) : null}
                  </p>
                  <p className="mt-1 text-xs leading-relaxed text-[var(--ink-soft)]">
                    Based on {row.basedOn}
                  </p>
                </button>
              );
            })
          )}
        </div>
      </div>
    </section>
  );
}
