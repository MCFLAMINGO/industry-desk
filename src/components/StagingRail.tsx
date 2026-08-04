"use client";

import { useMemo } from "react";
import clsx from "clsx";
import { fmtPct, type DeskDayState, type DeskRank } from "@/lib/desk";
import RhChartPanel from "@/components/RhChartPanel";

export type StagedPlay = {
  id: string;
  source: "fusion" | "propose" | "approve" | "preview" | "industry";
  rank: DeskRank;
  note: string;
};

export function buildStagedPlays(desk: DeskDayState | null): StagedPlay[] {
  if (!desk) return [];
  const out: StagedPlay[] = [];
  const seen = new Set<string>();

  const push = (source: StagedPlay["source"], rank: DeskRank | null | undefined, note: string) => {
    if (!rank?.symbol) return;
    const key = rank.symbol.toUpperCase();
    if (seen.has(key)) return;
    seen.add(key);
    out.push({
      id: `${source}-${key}`,
      source,
      rank,
      note,
    });
  };

  const ld = desk.lastDecision;
  if (ld?.action?.startsWith("open_") && ld.symbol) {
    const fromBoard = (desk.state?.rankings || []).find(
      (r) => r.symbol?.toUpperCase() === String(ld.symbol).toUpperCase()
    );
    push(
      "fusion",
      fromBoard || {
        id: `fusion-${ld.symbol}`,
        symbol: String(ld.symbol),
        industryId: "fusion",
        industryLabel: "Fusion pick",
        side: "long",
        strategy: ld.instrument || "fusion",
        horizon: (ld.horizon as DeskRank["horizon"]) || "day",
        score: Math.round((ld.confidence || 0) * 20),
      },
      ld.why || "Fusion chose this open"
    );
  }

  push(
    "propose",
    desk.state?.morningPlan?.proposeArm || null,
    "Morning propose — staged, not live until you Approve"
  );

  const ranks = desk.state?.rankings || [];
  for (const r of ranks) {
    const rec = r.synthesis?.recommend;
    if (rec === "APPROVE") {
      push("approve", r, r.synthesis?.thesis || "Micro APPROVE with pack edge");
    }
  }
  for (const r of ranks) {
    const rec = r.synthesis?.recommend;
    if (rec === "PREVIEW" || r.dryPreview) {
      push("preview", r, r.synthesis?.thesis || "Preview candidate — dry-run first");
    }
  }

  return out.slice(0, 8);
}

type Props = {
  desk: DeskDayState | null;
  selectedSymbol: string | null;
  onSelectSymbol: (symbol: string) => void;
  onArm: (rank: DeskRank, live: boolean) => void | Promise<void>;
  arming: string | null;
  busy: boolean;
  notional: number;
};

const SOURCE_LABEL: Record<StagedPlay["source"], string> = {
  fusion: "Fusion",
  propose: "Propose",
  approve: "Approve",
  preview: "Preview",
  industry: "Industry",
};

export default function StagingRail({
  desk,
  selectedSymbol,
  onSelectSymbol,
  onArm,
  arming,
  busy,
  notional,
}: Props) {
  const staged = useMemo(() => buildStagedPlays(desk), [desk]);
  const active =
    staged.find((s) => s.rank.symbol?.toUpperCase() === selectedSymbol?.toUpperCase()) ||
    staged[0] ||
    null;
  const chartSym = selectedSymbol || active?.rank.symbol || null;

  return (
    <section className="glass mb-8 rounded-3xl p-5 sm:p-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--teal)]">
            Staging
          </p>
          <h2 className="display mt-1 text-2xl font-semibold text-[var(--ink)]">
            Active proposals
          </h2>
          <p className="mt-1 max-w-2xl text-sm text-[var(--ink-soft)]">
            This is the pre-live lane. Fusion / morning propose / micro APPROVE land here before
            Preview (dry) or Approve live. Ranked plays below are the wider menu — not auto-buys.
          </p>
        </div>
        <p className="text-xs text-[var(--ink-soft)]">
          Staging size ~${notional}
        </p>
      </div>

      {staged.length === 0 ? (
        <p className="mt-4 rounded-2xl border border-dashed border-[var(--line)] bg-white/40 px-4 py-6 text-sm text-[var(--ink-soft)]">
          Nothing staged yet. Re-run fusion to rebuild proposals — or tap an industry idea above.
        </p>
      ) : (
        <div className="mt-4 grid gap-4 lg:grid-cols-5">
          <ul className="space-y-2 lg:col-span-2">
            {staged.map((s) => {
              const activeRow =
                (selectedSymbol || active?.rank.symbol || "").toUpperCase() ===
                (s.rank.symbol || "").toUpperCase();
              return (
                <li
                  key={s.id}
                  className={clsx(
                    "rounded-2xl border px-3 py-3 transition-colors",
                    activeRow
                      ? "border-[var(--teal)] bg-[var(--teal)]/10"
                      : "border-[var(--line)] bg-white/50"
                  )}
                >
                  <button
                    type="button"
                    onClick={() => s.rank.symbol && onSelectSymbol(s.rank.symbol)}
                    className="w-full text-left"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full bg-[var(--teal-deep)]/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--teal-deep)]">
                        {SOURCE_LABEL[s.source]}
                      </span>
                      <span className="mono text-sm font-semibold text-[var(--ink)]">
                        {s.rank.symbol}
                      </span>
                      <span className="text-xs text-[var(--ink-soft)]">
                        {s.rank.side} · {s.rank.horizon}
                        {s.rank.changePct != null ? ` · ${fmtPct(s.rank.changePct)}` : ""}
                      </span>
                    </div>
                    <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-[var(--ink-soft)]">
                      {s.note}
                    </p>
                  </button>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <button
                      type="button"
                      disabled={busy || Boolean(arming)}
                      onClick={() => void onArm(s.rank, false)}
                      className="rounded-full border border-[var(--line)] bg-white px-2.5 py-1 text-xs font-semibold text-[var(--ink-soft)] hover:text-[var(--teal-deep)] disabled:opacity-50"
                    >
                      {arming === `${s.rank.symbol}:dry` ? "Previewing…" : "Preview"}
                    </button>
                    <button
                      type="button"
                      disabled={busy || Boolean(arming) || Boolean(s.rank.inBook)}
                      onClick={() => void onArm(s.rank, true)}
                      className="rounded-full bg-[var(--teal)] px-2.5 py-1 text-xs font-semibold text-white disabled:opacity-50"
                    >
                      {arming === `${s.rank.symbol}:live` ? "Approving…" : "Approve live"}
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
          <div className="lg:col-span-3">
            <RhChartPanel symbol={chartSym} label="Staged chart" />
            {active?.rank.synthesis?.invalidate?.length ? (
              <p className="mt-2 text-xs text-[var(--ink-soft)]">
                Kill if: {active.rank.synthesis.invalidate.join(" · ")}
              </p>
            ) : null}
          </div>
        </div>
      )}
    </section>
  );
}
