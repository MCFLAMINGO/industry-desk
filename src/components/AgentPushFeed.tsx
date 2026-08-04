"use client";

import { Bell, AlertTriangle } from "lucide-react";
import type { DeskAgentAlert } from "@/lib/desk";

type Props = {
  latest?: DeskAgentAlert | null;
  recent?: DeskAgentAlert[] | null;
  openAnxiety?: DeskAgentAlert[] | null;
};

function kindLabel(kind?: string) {
  if (kind === "open" || kind === "arm") return "Opened / staged";
  if (kind === "protect") return "Protect";
  if (kind === "bank") return "Bank";
  if (kind === "pass") return "Cash / pass";
  if (kind === "focus") return "Focus shift";
  return kind || "Update";
}

export default function AgentPushFeed({ latest, recent, openAnxiety }: Props) {
  const rows = (recent && recent.length ? recent : latest ? [latest] : []).slice(0, 8);
  const anxious = openAnxiety || [];

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
            are configured.
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
        <ul className="mt-4 space-y-3">
          {rows.map((a) => (
            <li
              key={a.id}
              className="rounded-2xl border border-[var(--line)] bg-white/55 px-4 py-3"
            >
              <div className="flex flex-wrap items-baseline gap-2">
                <span className="rounded-full bg-[var(--teal-deep)]/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--teal-deep)]">
                  {kindLabel(a.kind)}
                </span>
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
          ))}
        </ul>
      )}
    </section>
  );
}
