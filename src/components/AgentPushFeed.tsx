"use client";

import { useState } from "react";
import { Bell, AlertTriangle, ChevronDown, ChevronUp } from "lucide-react";
import type { DeskAgentAlert, DeskAlertDayPattern } from "@/lib/desk";

type Props = {
  latest?: DeskAgentAlert | null;
  recent?: DeskAgentAlert[] | null;
  openAnxiety?: DeskAgentAlert[] | null;
  dayPatterns?: DeskAlertDayPattern[] | null;
};

const VISIBLE_MAX = 3;

function kindLabel(kind?: string) {
  if (kind === "open" || kind === "arm") return "Opened / staged";
  if (kind === "protect") return "Protect";
  if (kind === "bank") return "Bank";
  if (kind === "pass") return "Cash / pass";
  if (kind === "focus") return "Focus shift";
  return kind || "Update";
}

function AlertRow({ a }: { a: DeskAgentAlert }) {
  const repeats = a.repeatCount && a.repeatCount > 1 ? a.repeatCount : null;
  return (
    <li className="rounded-2xl border border-[var(--line)] bg-white/55 px-4 py-3">
      <div className="flex flex-wrap items-baseline gap-2">
        <span className="rounded-full bg-[var(--teal-deep)]/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--teal-deep)]">
          {kindLabel(a.kind)}
        </span>
        {repeats ? (
          <span className="rounded-full bg-[var(--ink)]/8 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--ink-soft)]">
            ×{repeats} today
          </span>
        ) : null}
        {a.symbol ? (
          <span className="mono text-sm font-semibold text-[var(--ink)]">
            {a.symbol}
            {a.side ? ` · ${a.side}` : ""}
            {a.live ? " · LIVE" : " · preview"}
          </span>
        ) : null}
        {a.at ? (
          <span className="text-xs text-[var(--ink-soft)]">
            {new Date(a.at).toLocaleString()}
            {a.firstAt && a.firstAt !== a.at
              ? ` · first ${new Date(a.firstAt).toLocaleTimeString()}`
              : ""}
          </span>
        ) : null}
      </div>
      <p className="mt-2 text-sm leading-relaxed text-[var(--ink)]">{a.plain}</p>
      {a.notional != null || a.targetPct != null || a.stopPct != null ? (
        <p className="mt-1 mono text-xs text-[var(--ink-soft)]">
          {[
            a.notional != null ? `~$${a.notional}` : null,
            a.targetPct != null
              ? `target ~${Math.abs(a.targetPct) <= 1 ? (a.targetPct * 100).toFixed(1) : a.targetPct}%`
              : null,
            a.stopPct != null
              ? `stop ~${Math.abs(a.stopPct) <= 1 ? (a.stopPct * 100).toFixed(1) : a.stopPct}%`
              : null,
            a.planId ? `plan ${a.planId.slice(0, 8)}` : null,
          ]
            .filter(Boolean)
            .join(" · ")}
        </p>
      ) : null}
    </li>
  );
}

/** Collapse identical copy client-side until the API ships deduped rows. */
function collapseClient(list: DeskAgentAlert[]): DeskAgentAlert[] {
  const out: DeskAgentAlert[] = [];
  const index = new Map<string, number>();
  for (const a of list) {
    const key =
      a.fingerprint ||
      `${a.kind || ""}|${(a.plain || "").replace(/\s+/g, " ").trim().slice(0, 180).toLowerCase()}`;
    const i = index.get(key);
    if (i != null) {
      const prev = out[i];
      out[i] = {
        ...prev,
        repeatCount: (prev.repeatCount || 1) + (a.repeatCount || 1),
        at: a.at && (!prev.at || Date.parse(a.at) > Date.parse(prev.at)) ? a.at : prev.at,
        lastAt: a.lastAt || a.at || prev.lastAt,
        firstAt:
          a.firstAt && prev.firstAt
            ? Date.parse(a.firstAt) < Date.parse(prev.firstAt)
              ? a.firstAt
              : prev.firstAt
            : prev.firstAt || a.firstAt || prev.at,
      };
      continue;
    }
    index.set(key, out.length);
    out.push({
      ...a,
      repeatCount: a.repeatCount || 1,
      firstAt: a.firstAt || a.at,
      lastAt: a.lastAt || a.at,
    });
  }
  return out;
}

export default function AgentPushFeed({
  latest,
  recent,
  openAnxiety,
  dayPatterns,
}: Props) {
  const [expanded, setExpanded] = useState(false);
  const [patternsOpen, setPatternsOpen] = useState(false);

  const raw = recent && recent.length ? recent : latest ? [latest] : [];
  const rows = collapseClient(raw).slice(0, 12);
  const visible = expanded ? rows : rows.slice(0, VISIBLE_MAX);
  const hiddenCount = Math.max(0, rows.length - VISIBLE_MAX);
  const anxious = openAnxiety || [];
  const patterns = dayPatterns || [];

  return (
    <section className="glass mb-8 rounded-3xl p-5 sm:p-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--teal)]">
            Agent → you
          </p>
          <h2 className="display mt-1 text-2xl font-semibold text-[var(--ink)]">
            What the agent pushed
          </h2>
          <p className="mt-1 max-w-2xl text-sm text-[var(--ink-soft)]">
            When the desk buys, shorts, protects, or stays in cash, it must tell you in plain English
            — why, what, and that it’s still watching. Same alert goes to Telegram/email when those
            are configured. Duplicate copies collapse into one line (repeats counted for the day).
          </p>
        </div>
        <Bell className="h-5 w-5 text-[var(--teal)]" />
      </div>

      {anxious.length > 0 ? (
        <div className="mt-4 rounded-2xl border border-amber-300 bg-amber-50/90 px-4 py-3 text-sm text-amber-950">
          <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.14em]">
            <AlertTriangle className="h-3.5 w-3.5" />
            Still on the hook
          </p>
          <ul className="mt-2 space-y-1">
            {anxious.map((a) => (
              <li key={a.id}>
                <span className="mono font-semibold">{a.symbol}</span>{" "}
                {a.side} · {a.live ? "LIVE" : "preview"}
                {a.why ? ` — ${a.why.slice(0, 140)}` : ""}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {rows.length === 0 ? (
        <p className="mt-4 rounded-2xl border border-dashed border-[var(--line)] bg-white/40 px-4 py-6 text-sm text-[var(--ink-soft)]">
          No agent pushes yet today. After the next fusion open/protect/pass, it should land here and
          ping you — not buy quietly and forget.
        </p>
      ) : (
        <>
          <ul className="mt-4 space-y-3">
            {visible.map((a) => (
              <AlertRow key={a.id || `${a.kind}-${a.at}`} a={a} />
            ))}
          </ul>
          {hiddenCount > 0 ? (
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.14em] text-[var(--teal-deep)]"
            >
              {expanded ? (
                <>
                  <ChevronUp className="h-3.5 w-3.5" /> Hide older ({hiddenCount})
                </>
              ) : (
                <>
                  <ChevronDown className="h-3.5 w-3.5" /> Show {hiddenCount} more
                </>
              )}
            </button>
          ) : null}
        </>
      )}

      {patterns.length > 0 ? (
        <div className="mt-5 border-t border-[var(--line)] pt-4">
          <button
            type="button"
            onClick={() => setPatternsOpen((v) => !v)}
            className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.14em] text-[var(--ink-soft)]"
          >
            {patternsOpen ? (
              <ChevronUp className="h-3.5 w-3.5" />
            ) : (
              <ChevronDown className="h-3.5 w-3.5" />
            )}
            Day patterns (tracking)
            <span className="font-normal normal-case tracking-normal">
              — repeats rolled up for rhyme history, not the live feed
            </span>
          </button>
          {patternsOpen ? (
            <ul className="mt-3 space-y-2">
              {patterns.map((p) => (
                <li
                  key={p.fingerprint || `${p.kind}-${p.firstAt}`}
                  className="text-xs leading-relaxed text-[var(--ink-soft)]"
                >
                  <span className="font-semibold uppercase tracking-[0.12em] text-[var(--ink)]">
                    {kindLabel(p.kind)}
                  </span>
                  {" · "}
                  <span className="mono">×{p.count || 1}</span>
                  {p.firstAt ? ` · first ${new Date(p.firstAt).toLocaleTimeString()}` : ""}
                  {p.lastAt ? ` · last ${new Date(p.lastAt).toLocaleTimeString()}` : ""}
                  <span className="mt-0.5 block text-[var(--ink)]/80">
                    {(p.plain || "").slice(0, 180)}
                    {(p.plain || "").length > 180 ? "…" : ""}
                  </span>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
