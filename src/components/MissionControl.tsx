"use client";

import { useEffect, useMemo, useState } from "react";
import clsx from "clsx";
import { Activity, Target, Clock, AlertTriangle, RefreshCw, Anchor, Radio, Crosshair } from "lucide-react";
import { toast } from "sonner";
import {
  fmtPct,
  fmtUsd,
  runDeskRiskOff,
  runRegimePass,
  takeOptionHunt,
  type DeskDayState,
  type DeskRank,
  type DeskRegime,
} from "@/lib/desk";
import type { RhLivePosition } from "@/lib/robinhood";

type Props = {
  desk: DeskDayState | null;
  positions: RhLivePosition[];
  buyingPower: number | null;
  busy?: boolean;
  onAnalyzeNow: () => void | Promise<void>;
  onRegimeUpdated?: (regime: DeskRegime | null) => void;
  onHuntFired?: () => void | Promise<void>;
};

function stanceLabel(stance?: string | null) {
  switch (stance) {
    case "leave_boat":
      return "Reducing risk";
    case "building_new_boat":
      return "Building the next book";
    case "dip_buy_options":
      return "Buying the dip with options";
    case "watch":
      return "Watching (unconfirmed)";
    case "mixed":
      return "Mixed signals";
    case "stay_aboard":
      return "Normal — on process";
    default:
      return "No read yet";
  }
}

function minsUntil(etHour: number, etMinute: number, et: DeskDayState["et"]) {
  if (!et || et.hour == null || et.minute == null) return null;
  const now = et.hour * 60 + et.minute;
  const target = etHour * 60 + etMinute;
  return target - now;
}

function sessionPlain(et: DeskDayState["et"], refreshing?: boolean) {
  if (refreshing) {
    return {
      label: "Analyzing now",
      detail: "Fusion is re-reading the Robinhood tape and deciding what to do at open.",
      tone: "go" as const,
    };
  }
  if (!et) {
    return { label: "Loading session…", detail: "Waiting on desk clock.", tone: "wait" as const };
  }
  if (et.isRth) {
    return {
      label: "Market open — agents live",
      detail: "RTH is open. Auto-live can arm and manage plans against the 1% day band.",
      tone: "go" as const,
    };
  }
  if (et.isMorningPlanWindow) {
    const m = minsUntil(9, 30, et);
    return {
      label: m != null && m > 0 ? `${m} min to the open` : "Open is imminent",
      detail:
        "Morning window. Agents should be refreshing the plan for 9:30 — not sitting idle on yesterday’s note.",
      tone: "wait" as const,
    };
  }
  if (et.isPreClose) {
    return {
      label: "Pre-close",
      detail: "Bank/trail day sleeves. Week/month theses can ride.",
      tone: "wait" as const,
    };
  }
  if (et.isAfterClose) {
    return {
      label: "After the close",
      detail: "No new RTH opens. Protect inventory; next real decision window is ~8:00 ET.",
      tone: "idle" as const,
    };
  }
  return {
    label: "Session closed",
    detail: "Outside the regular session. Plans can still stage for the next open.",
    tone: "idle" as const,
  };
}

function skipPlain(reason?: string) {
  if (!reason) return null;
  if (reason.startsWith("slot_")) {
    return "The capital slot is already holding the best idea — agents manage it instead of buying another name.";
  }
  switch (reason) {
    case "propose_only":
      return "Auto-execute is off, so agents propose only. Approve from Staging to act.";
    case "max_live":
      return "Max live plans reached — agents will not stack another position.";
    case "bank_mode":
      return "Bank mode: the day band was hit or rolled, so no new risk.";
    case "risk_off":
      return "Risk-off latch is on — protect and flatten only.";
    case "robinhood_required":
    case "live_trading_disabled":
      return "Robinhood gate blocked the arm path (connection or live-trading flag).";
    case "engine_outage":
      return "The reasoning engine failed this pass — no decision was made.";
    case "already_held":
      return "The name is already held — agents should protect it, not re-buy it.";
    default:
      return `Arm path skipped: ${reason.replace(/_/g, " ")}.`;
  }
}

function fusionPlain(desk: DeskDayState | null) {
  const ld = desk?.lastDecision;
  if (desk?.refreshing) {
    return {
      status: "Thinking",
      line: "Fusion is packing the whole desk (tape, holds, losers/winners, hints) and choosing one action.",
      ok: true,
    };
  }
  if (!ld) {
    const skip = desk?.lastSkip;
    return {
      status: skip ? "No new call this pass" : "No decision yet",
      line:
        skipPlain(skip?.reason)
        || skip?.slot
        || skip?.detail
        || "Hit Analyze for open — until then agents have no fresh fusion call.",
      ok: Boolean(skip && skip.reason !== "engine_outage"),
    };
  }
  if (ld.source === "nim_error" || ld.source === "nim_unavailable") {
    return {
      status: "Fusion failed — cash",
      line: ld.why || "Model timed out. Agents will not spray nickels until fusion works.",
      ok: false,
    };
  }
  if (ld.action === "pass") {
    return {
      status: "Plan: stay cash",
      line: ld.why || "Fusion chose pass — no new risk until something earns it.",
      ok: true,
    };
  }
  if (ld.action?.startsWith("open_")) {
    return {
      status: `Plan: ${ld.action.replace("open_", "")} ${ld.symbol || ""}`.trim(),
      line: ld.why || "Fusion wants this open. Staging / auto-live will carry it into the session.",
      ok: true,
    };
  }
  if (ld.action === "protect" || ld.action === "bank") {
    return {
      status: `Plan: ${ld.action}`,
      line: ld.why || "Protect/trail the book — day band discipline.",
      ok: true,
    };
  }
  return {
    status: ld.action || "Unknown",
    line: ld.why || "See fusion details below.",
    ok: true,
  };
}

function atOpenPlain(desk: DeskDayState | null, bookPnlPct: number | null) {
  const et = desk?.et;
  const ld = desk?.lastDecision;
  const propose = desk?.state?.morningPlan?.proposeArm;
  const lead = desk?.state?.rankings?.[0];
  const goal = Math.round((desk?.dayGoal?.min || 0.01) * 100);

  if (ld?.source === "nim_error") {
    return `At 9:30 they will NOT invent new buys — fusion is broken (timeout). They should protect what’s held and wait for a good Analyze for open. You are still aiming for +${goal}% today; overnight the book is around ${bookPnlPct == null ? "flat/unknown" : fmtPct(bookPnlPct)}.`;
  }
  if (ld?.action?.startsWith("open_") && ld.symbol) {
    return `At open they intend to ${ld.action.replace("open_", "open ")} ${ld.symbol}${ld.instrument ? ` (${ld.instrument})` : ""}. Why: ${(ld.why || "see fusion").slice(0, 180)} Goal: bank ~${goal}% on the book, not spray more nickels.`;
  }
  if (ld?.action === "pass") {
    return `At open the plan is cash / no new spray. ${propose?.symbol ? `Morning propose still shows ${propose.symbol} in Staging if you want to Approve manually.` : lead ? `Tape lead is ${lead.symbol} — that is a menu item, not an auto-buy.` : ""} Day goal remains +${goal}%.`;
  }
  if (et?.isMorningPlanWindow) {
    return `We’re in the morning window. Agents should finish a fresh fusion before 9:30 so Staging shows the real open plan. Day goal: +${goal}% every day.`;
  }
  if (et?.isRth) {
    return `Market is open. Agents manage live plans toward +${goal}% and bank when the band hits.`;
  }
  return `Next decision window is the morning plan (~8:00 ET) into the 9:30 open. Day goal stays +${goal}%.`;
}

function bookPnlFromPositions(positions: RhLivePosition[]) {
  let cost = 0;
  let value = 0;
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
  }
  if (!(cost > 0)) return null;
  return ((value - cost) / cost) * 100;
}

export default function MissionControl({
  desk,
  positions,
  buyingPower,
  busy,
  onAnalyzeNow,
  onRegimeUpdated,
  onHuntFired,
}: Props) {
  const [nowTick, setNowTick] = useState(0);
  const [regimeBusy, setRegimeBusy] = useState(false);
  const [riskBusy, setRiskBusy] = useState(false);
  const [huntBusy, setHuntBusy] = useState<"preview" | "live" | null>(null);
  const [localRegime, setLocalRegime] = useState<DeskRegime | null>(null);
  const [showRegimeDetail, setShowRegimeDetail] = useState(false);
  useEffect(() => {
    const iv = window.setInterval(() => setNowTick((n) => n + 1), 15_000);
    return () => window.clearInterval(iv);
  }, []);

  const bookPnlPct = useMemo(() => bookPnlFromPositions(positions), [positions, nowTick]);
  const goalMin = (desk?.dayGoal?.min || 0.01) * 100;
  const goalStretch = (desk?.dayGoal?.stretch || 0.03) * 100;
  const session = sessionPlain(desk?.et, Boolean(desk?.refreshing || busy));
  const fusion = fusionPlain(desk);
  const openLine = atOpenPlain(desk, bookPnlPct);
  const regime = localRegime || desk?.regime || null;
  const pastHits = regime?.historicalNews?.hits || [];
  // Only an actually-corroborated stance should colour the UI as urgent.
  const actionableStance =
    regime?.corroborated !== false
    && (regime?.stance === "leave_boat"
      || regime?.stance === "building_new_boat"
      || regime?.stance === "dip_buy_options");

  const progress = bookPnlPct == null ? 0 : Math.max(0, Math.min(1.2, bookPnlPct / goalMin));
  const behind = bookPnlPct != null && bookPnlPct < goalMin * 0.25;
  const winners = positions.filter((p) => {
    if (p.avgCost == null || p.lastPrice == null || !p.avgCost) return false;
    return p.lastPrice > p.avgCost;
  });
  const losers = positions.filter((p) => {
    if (p.avgCost == null || p.lastPrice == null || !p.avgCost) return false;
    return p.lastPrice < p.avgCost;
  });

  const lead: DeskRank | undefined = desk?.state?.rankings?.[0];
  const propose = desk?.state?.morningPlan?.proposeArm;
  const updated = desk?.state?.updatedAt;

  return (
    <section className="mb-8 overflow-hidden rounded-3xl border border-[var(--line)] bg-white/80 shadow-[var(--shadow)]">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--line)] bg-[var(--teal-deep)] px-5 py-3 text-[#f0fdfa]">
        <div className="flex items-center gap-2">
          <Activity className="h-4 w-4" />
          <p className="text-xs font-semibold uppercase tracking-[0.18em]">Mission control</p>
        </div>
        <p className="text-xs opacity-90">
          Goal every day: +{goalMin.toFixed(0)}%
          {desk?.et?.dateKey ? ` · ${desk.et.dateKey}` : ""}
          {updated ? ` · last analyze ${new Date(updated).toLocaleTimeString()}` : ""}
        </p>
      </div>

      <div className="grid gap-0 lg:grid-cols-3">
        <div className="border-b border-[var(--line)] px-5 py-4 lg:border-b-0 lg:border-r">
          <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.14em] text-[var(--teal)]">
            <Clock className="h-3.5 w-3.5" /> Right now
          </p>
          <p
            className={clsx(
              "mt-2 text-xl font-semibold",
              session.tone === "go" && "text-[var(--ok)]",
              session.tone === "wait" && "text-[var(--danger)]",
              session.tone === "idle" && "text-[var(--ink-soft)]"
            )}
          >
            {session.label}
          </p>
          <p className="mt-1 text-sm leading-relaxed text-[var(--ink-soft)]">{session.detail}</p>
          <p className="mt-3 text-xs text-[var(--ink-soft)]">
            Auto execute {desk?.autoExecute ? "ON" : "off"} · auto live{" "}
            {desk?.autoLive ? "ON" : "off"} · BP {fmtUsd(buyingPower)}
          </p>
        </div>

        <div className="border-b border-[var(--line)] px-5 py-4 lg:border-b-0 lg:border-r">
          <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.14em] text-[var(--teal)]">
            <Target className="h-3.5 w-3.5" /> 1% day band
          </p>
          <p className="mt-2 display text-3xl font-semibold text-[var(--ink)]">
            {bookPnlPct == null ? "—" : fmtPct(bookPnlPct)}
            <span className="ml-2 text-base font-normal text-[var(--ink-soft)]">
              / +{goalMin.toFixed(0)}%
            </span>
          </p>
          <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-[var(--line)]">
            <div
              className={clsx(
                "h-full rounded-full transition-all",
                behind ? "bg-[var(--danger)]" : "bg-[var(--teal)]"
              )}
              style={{ width: `${Math.min(100, progress * 100)}%` }}
            />
          </div>
          <p className="mt-2 text-xs text-[var(--ink-soft)]">
            Stretch +{goalStretch.toFixed(0)}% · held {positions.length} (
            {winners.length} up / {losers.length} down)
            {behind
              ? " — behind the day goal; agents should ramp winners / protect losers, not spray."
              : ""}
          </p>
        </div>

        <div className="px-5 py-4">
          <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.14em] text-[var(--teal)]">
            <AlertTriangle className="h-3.5 w-3.5" /> What fusion decided
          </p>
          <p
            className={clsx(
              "mt-2 text-xl font-semibold",
              fusion.ok ? "text-[var(--ink)]" : "text-[var(--danger)]"
            )}
          >
            {fusion.status}
          </p>
          <p className="mt-1 text-sm leading-relaxed text-[var(--ink-soft)]">{fusion.line}</p>
          {(propose?.symbol || lead?.symbol) && (
            <p className="mt-2 text-xs text-[var(--ink-soft)]">
              Staging/tape: {propose?.symbol || lead?.symbol}
              {propose?.side || lead?.side ? ` ${propose?.side || lead?.side}` : ""}
              {" · not an auto-buy until fusion/Approve says so"}
            </p>
          )}
          {desk?.optionHunt?.best ? (
            <div className="mt-3 rounded-xl border border-[var(--line)] bg-[var(--sand)]/70 px-3 py-2">
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--teal-deep)]">
                Option hunt
                {desk.optionHunt.tradeableCount
                  ? ` · ${desk.optionHunt.tradeableCount} tradeable`
                  : ""}
              </p>
              <p className="mt-1 text-sm font-semibold text-[var(--ink)]">
                {desk.optionHunt.best.symbol}{" "}
                {desk.optionHunt.best.right?.toUpperCase()}
                {desk.optionHunt.best.strike != null ? ` $${desk.optionHunt.best.strike}` : ""}
                {desk.optionHunt.best.debitUsd != null
                  ? ` · ~$${desk.optionHunt.best.debitUsd.toFixed(0)} debit`
                  : ""}
                {desk.optionHunt.best.upsideMultiple != null
                  ? ` · ~${desk.optionHunt.best.upsideMultiple}× on a typical move`
                  : ""}
              </p>
              <p className="mt-0.5 text-xs text-[var(--ink-soft)]">
                {desk.optionHunt.best.tradeable
                  ? desk.optionHunt.best.plain
                    || "Tradeable asymmetric sleeve — agent fires when advantageous; you can also Take LIVE."
                  : desk.optionHunt.note
                    || "Scanning; nothing cleared the gate this pass."}
              </p>
              {desk.optionHunt.best.tradeable ? (
                <div className="mt-2 flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={Boolean(busy || huntBusy || desk?.refreshing)}
                    onClick={() => {
                      void (async () => {
                        setHuntBusy("preview");
                        try {
                          const out = await takeOptionHunt({
                            live: false,
                            best: desk.optionHunt?.best,
                          });
                          if (!out.ok) {
                            throw new Error(out.detail || out.reason || out.error || "Preview failed");
                          }
                          toast.success("Hunt preview armed", {
                            description: out.message || `${out.instrument} ${out.symbol}`,
                          });
                          await onHuntFired?.();
                        } catch (e) {
                          toast.error("Preview failed", { description: (e as Error).message });
                        } finally {
                          setHuntBusy(null);
                        }
                      })();
                    }}
                    className="inline-flex items-center gap-1 rounded-full border border-[var(--teal-deep)]/40 bg-white px-2.5 py-1 text-[11px] font-semibold text-[var(--teal-deep)] disabled:opacity-50"
                  >
                    <Crosshair className="h-3 w-3" />
                    {huntBusy === "preview" ? "Arming…" : "Preview"}
                  </button>
                  <button
                    type="button"
                    disabled={Boolean(busy || huntBusy || desk?.refreshing)}
                    onClick={() => {
                      const b = desk.optionHunt?.best;
                      if (!b) return;
                      const ok = window.confirm(
                        `Take LIVE ${b.symbol} ${String(b.right || "call").toUpperCase()}`
                          + (b.strike != null ? ` $${b.strike}` : "")
                          + "?"
                      );
                      if (!ok) return;
                      void (async () => {
                        setHuntBusy("live");
                        try {
                          const out = await takeOptionHunt({ live: true, best: b });
                          if (!out.ok) {
                            throw new Error(out.detail || out.reason || out.error || "Take failed");
                          }
                          toast.success("Hunt LIVE armed", {
                            description: out.message || `${out.instrument} ${out.symbol}`,
                          });
                          await onHuntFired?.();
                        } catch (e) {
                          toast.error("Take LIVE failed", { description: (e as Error).message });
                        } finally {
                          setHuntBusy(null);
                        }
                      })();
                    }}
                    className="inline-flex items-center gap-1 rounded-full bg-[var(--teal-deep)] px-2.5 py-1 text-[11px] font-semibold text-white disabled:opacity-50"
                  >
                    <Crosshair className="h-3 w-3" />
                    {huntBusy === "live" ? "Firing…" : "Take LIVE"}
                  </button>
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>

      <div className="border-t border-[var(--line)] bg-[var(--sand)]/80 px-5 py-4">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--teal-deep)]">
          At the open — in plain English
        </p>
        <p className="mt-2 text-base leading-relaxed text-[var(--ink)]">{openLine}</p>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button
            type="button"
            disabled={busy || Boolean(desk?.refreshing)}
            onClick={() => void onAnalyzeNow()}
            className="inline-flex items-center gap-2 rounded-full bg-[var(--teal)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
          >
            <RefreshCw className={clsx("h-4 w-4", (busy || desk?.refreshing) && "animate-spin")} />
            {busy || desk?.refreshing ? "Analyzing for open…" : "Analyze for open"}
          </button>
          <p className="max-w-md text-xs text-[var(--ink-soft)]">
            This is the button that matters before 9:30 — re-quotes books, runs fusion, updates
            Staging and Agent → you. It does not silently place live orders unless auto-live already
            armed a plan.
          </p>
        </div>
      </div>

      {/*
        Regime internals (playbook rhymes, past-news scores) are AGENT inputs,
        not something the account owner should have to read. Surface one line of
        posture plus the controls; the evidence lives behind Details.
      */}
      <div
        className={clsx(
          "border-t border-[var(--line)] px-5 py-3",
          actionableStance ? "bg-amber-50/90" : "bg-white/60"
        )}
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="flex items-center gap-2 text-sm">
            <Anchor className="h-3.5 w-3.5 shrink-0 text-[var(--teal-deep)]" />
            <span className="font-semibold text-[var(--ink)]">Posture:</span>
            <span
              className={clsx(
                "font-semibold",
                regime?.stance === "leave_boat" && "text-[var(--danger)]",
                regime?.stance === "building_new_boat" && "text-amber-800",
                regime?.stance === "dip_buy_options" && "text-[var(--ok)]",
                !actionableStance && "text-[var(--ink-soft)]"
              )}
            >
              {stanceLabel(regime?.stance)}
            </span>
            {regime?.stance === "watch" || regime?.corroborated === false ? (
              <span className="text-xs text-[var(--ink-soft)]">
                (headlines only — not confirmed by the tape, so agents are not cutting risk)
              </span>
            ) : null}
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setShowRegimeDetail((v) => !v)}
              className="rounded-full border border-[var(--line)] bg-white px-3 py-1.5 text-xs font-medium text-[var(--ink-soft)]"
            >
              {showRegimeDetail ? "Hide details" : "Details"}
            </button>
            <button
              type="button"
              disabled={regimeBusy}
              onClick={() => {
                setRegimeBusy(true);
                void runRegimePass()
                  .then((out) => {
                    const next = out.regime || null;
                    setLocalRegime(next);
                    onRegimeUpdated?.(next);
                  })
                  .finally(() => setRegimeBusy(false));
              }}
              className="inline-flex items-center gap-2 rounded-full border border-[var(--line)] bg-white px-3 py-1.5 text-xs font-semibold text-[var(--ink)] disabled:opacity-50"
            >
              <Radio className={clsx("h-3.5 w-3.5", regimeBusy && "animate-pulse")} />
              {regimeBusy ? "Re-checking…" : "Re-check"}
            </button>
            <button
              type="button"
              disabled={riskBusy}
              onClick={() => {
                if (!window.confirm(
                  "RISK OFF: close/protect day longs and flatten option shorts. Continue?"
                )) return;
                setRiskBusy(true);
                void runDeskRiskOff({
                  plain: regime?.plain || "Operator RISK OFF from mission control.",
                  headline: regime?.topPlaybook?.name || "Operator risk-off",
                  flattenShorts: true,
                  live: Boolean(desk?.autoLive),
                }).finally(() => setRiskBusy(false));
              }}
              className="inline-flex items-center gap-2 rounded-full bg-[var(--danger)] px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
            >
              {riskBusy ? "Risking off…" : "RISK OFF"}
            </button>
          </div>
        </div>

        {showRegimeDetail ? (
          <div className="mt-3 rounded-2xl border border-[var(--line)] bg-white/80 px-3 py-3">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--ink-soft)]">
              Agent inputs — historical rhyme evidence
            </p>
            <p className="mt-1.5 text-sm leading-relaxed text-[var(--ink)]">
              {regime?.plain || "No regime read recorded yet."}
            </p>
            {regime?.topPlaybook?.name ? (
              <p className="mt-2 text-xs text-[var(--ink-soft)]">
                Top rhyme: {regime.topPlaybook.name}
                {regime.topPlaybook.analogs?.[0] ? ` · analog ${regime.topPlaybook.analogs[0]}` : ""}
                {regime.witnessKinds?.length ? ` · witnesses ${regime.witnessKinds.join(", ")}` : ""}
              </p>
            ) : null}
            {pastHits.length > 0 ? (
              <ul className="mt-2 space-y-1 text-xs text-[var(--ink-soft)]">
                {pastHits.slice(0, 4).map((h) => (
                  <li key={h.id || h.label}>
                    <span className="mono">{h.era}</span> · {h.phase} ·{" "}
                    {(h.score != null ? h.score * 100 : 0).toFixed(0)}% — {h.label}
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : null}

        {desk?.riskOff?.active ? (
          <p className="mt-3 text-sm font-medium text-[var(--danger)]">
            RISK-OFF latch is active — no new nickels until cleared.
            {desk.riskOff.riskOff?.plain ? ` ${desk.riskOff.riskOff.plain}` : ""}
          </p>
        ) : null}
      </div>
    </section>
  );
}
