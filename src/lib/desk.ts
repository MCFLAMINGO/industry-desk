/** Industry Desk → Railway desk-day / tape / plans helpers. */

export type DeskSynthesisMicro = {
  globalFit?: string | null;
  /** APPROVE | PREVIEW | CONFLICT | PASS | WATCH */
  recommend?: string | null;
  stance?: string | null;
  stanceLabel?: string | null;
  thesis?: string | null;
  invalidate?: string[];
  edge?: {
    hasEdge?: boolean;
    p?: number;
    b?: number;
    expectancy?: number;
    targetPct?: number;
    stopPct?: number;
  } | null;
  size?: {
    notional_usd?: number;
    blocked?: string | null;
    message?: string | null;
  } | null;
  vsBook?: {
    rankInBook?: number;
    peerCount?: number;
    vsPeerAvg?: number | null;
    note?: string;
  } | null;
  concentration?: {
    risk?: string;
    note?: string;
  } | null;
  quality?: {
    count?: number;
    reliable?: boolean;
    note?: string;
  } | null;
  verdict?: string | null;
  conviction?: number | null;
  microReasons?: string[];
  /** Public FINRA ATS / RegSHO / SEC Form 4 — not dark-web */
  alt?: {
    available?: boolean;
    sourceCount?: number;
    reasons?: string[];
    ats?: {
      available?: boolean;
      signal?: string;
      vs4wAvg?: number | null;
      weekStartDate?: string;
      shares?: number;
    } | null;
    regsho?: {
      available?: boolean;
      signal?: string;
      shortRatio?: number | null;
      date?: string;
    } | null;
    insider?: {
      available?: boolean;
      signal?: string;
      count45d?: number;
      buys?: number;
      sells?: number;
    } | null;
    compliance?: string;
  } | null;
  altFlags?: string[];
  altReasons?: string[];
  narrative?: string | null;
  newsSentiment?: string | null;
  scoreDelta?: number | null;
  advantage?: string | null;
  fundamentals?: {
    sector?: string | null;
    industry?: string | null;
    recommendation?: string | null;
    revenue_growth?: number | null;
  } | null;
  technicals?: {
    trend?: string | null;
    last?: number | null;
    change_1d_pct?: number | null;
  } | null;
};

export type DeskSynthesis = {
  enabled?: boolean;
  version?: number;
  at?: string;
  duration_ms?: number;
  narrative?: string;
  top?: string[];
  microCount?: number;
  microAttempted?: number;
  thinCount?: number;
  approveCount?: number;
  previewCount?: number;
  conflictCount?: number;
  global?: {
    available?: boolean;
    regime?: string;
    narrative?: string;
    reasons?: string[];
    action?: {
      favor?: string[];
      fade?: string[];
      note?: string;
    };
    industryLead?: {
      id?: string;
      label?: string;
      avgScore?: number;
      changePct?: number | null;
    } | null;
  };
  error?: string;
};

export type DeskRank = {
  id: string;
  symbol: string;
  industryId: string;
  industryLabel: string;
  side: string;
  strategy: string;
  horizon: string;
  scope?: string;
  agentExpectedReturn?: number;
  score: number;
  reasons?: string[];
  changePct?: number | null;
  price?: number | null;
  volumeRatio?: number | null;
  due?: string;
  inBook?: boolean;
  dryPreview?: boolean;
  rhHeld?: boolean;
  /** Global + micro Elite fold-in for this play */
  synthesis?: DeskSynthesisMicro | null;
};

export type DeskPlan = {
  id: string;
  symbol?: string;
  side?: string;
  kind?: string;
  status?: string;
  live?: boolean;
  dry_run?: boolean;
  strategy?: string;
  order_kind?: string;
  options_risk?: {
    style?: string;
    targetPct?: number;
    stretchPct?: number;
    stopPct?: number;
    note?: string;
  } | null;
  option_meta?: {
    right?: string;
    strike?: number | null;
    expiration?: string | null;
    debitUsd?: number | null;
    entryMark?: number | null;
    option_id?: string | null;
  } | null;
  filled_notional?: number | null;
  open_filled?: boolean;
  open_submitted?: boolean;
  open_when?: string | null;
  earliest_open_at?: number | null;
  order_state?: string | null;
  order_id?: string | null;
  filled_qty?: number | null;
  last_mark?: number | null;
  levels?: {
    entry?: number | null;
    stop?: number | null;
    target?: number | null;
    stretch?: number | null;
  };
  created_at?: string;
  updated_at?: string;
  steps?: Array<{
    id?: string;
    phase?: string;
    title?: string;
    status?: string;
    detail?: string;
    result?: {
      ok?: boolean;
      mode?: string;
      message?: string;
      error?: string;
      order?: Record<string, unknown>;
      placed?: {
        parsed?: {
          data?: {
            order?: {
              id?: string;
              state?: string;
              cumulative_quantity?: string | number;
              processed_quantity?: string | number;
              quantity?: string | number;
              dollar_based_amount?: { amount?: string };
            };
          };
        };
      };
    };
  }>;
  events?: Array<{
    at?: string;
    event?: string;
    detail?: string;
  }>;
};

/** True fill vs "submitted but never filled" (queued GFD that expired). */
export function planFillTruth(plan: DeskPlan): {
  kind: "dry" | "filled" | "submitted_unfilled" | "unknown";
  label: string;
  /** Short chip for badges */
  chip: string;
  orderState?: string | null;
} {
  const open = plan.steps?.find((s) => s.phase === "open");
  if (!plan.live || plan.dry_run || open?.status === "dry_run_done") {
    return {
      kind: "dry",
      label: "Paper only — not placed at Robinhood",
      chip: "PAPER · not placed",
    };
  }
  // Explicit false from the server wins over intended filled_quantity stamps.
  if (plan.open_filled === true) {
    const amt = plan.filled_notional;
    return {
      kind: "filled",
      label: amt != null ? `Filled in Robinhood · ~$${Math.round(Number(amt))} at risk` : "Filled in Robinhood — agents managing it",
      chip: amt != null ? `FILLED · ~$${Math.round(Number(amt))}` : "FILLED in RH",
      orderState: plan.order_state || null,
    };
  }
  const order = open?.result?.placed?.parsed?.data?.order;
  const state = String(plan.order_state || order?.state || "").toLowerCase() || null;
  const cum = Number(plan.filled_qty ?? order?.cumulative_quantity ?? order?.processed_quantity ?? 0);
  if (cum > 0 || state === "filled" || state === "partially_filled") {
    const amt = plan.filled_notional;
    return {
      kind: "filled",
      label: amt != null ? `Filled in Robinhood · ~$${Math.round(Number(amt))} at risk` : "Filled in Robinhood — agents managing it",
      chip: amt != null ? `FILLED · ~$${Math.round(Number(amt))}` : "FILLED in RH",
      orderState: state,
    };
  }
  if (
    plan.open_filled === false
    || state === "queued"
    || state === "unconfirmed"
    || state === "confirmed"
    || open?.status === "done"
    || plan.open_submitted
  ) {
    return {
      kind: "submitted_unfilled",
      label: "LIVE order sent — Robinhood has not filled it. Not a position yet.",
      chip: "LIVE order · not filled",
      orderState: state,
    };
  }
  return {
    kind: "unknown",
    label: "Armed live — confirm fill status in Robinhood",
    chip: "ARMED LIVE · confirm fill",
    orderState: state,
  };
}

/** Stage board recommend chip — CONFLICT is not a short signal. */
export function recommendPlain(recommend: string | null | undefined): {
  chip: string;
  hint: string | null;
} {
  const r = String(recommend || "").toUpperCase();
  switch (r) {
    case "CONFLICT":
      return {
        chip: "HOLD · agents disagree",
        hint: "Not a short and not an arm — stay out until the conflict clears.",
      };
    case "WATCH":
      return { chip: "WATCH only", hint: "Sensor on the board — not armed into the capital slot." };
    case "PASS":
      return { chip: "PASS · no trade", hint: null };
    case "PREVIEW":
      return { chip: "PREVIEW", hint: "Paper path ok — Take LIVE still needs your click / auto-live." };
    case "APPROVE":
      return { chip: "APPROVE", hint: null };
    default:
      return { chip: recommend || "—", hint: null };
  }
}

export function formatEtTime(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return null;
  return new Date(t).toLocaleString("en-US", {
    timeZone: "America/New_York",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  });
}

export type DeskHint = {
  id?: string;
  status?: "seen" | "watching" | "confirmed" | "strategy_ready" | string;
  symbol?: string | null;
  industry?: string | null;
  label?: string;
  watchFor?: string | null;
  largerMove?: string | null;
  horizonHint?: string;
  weekHits?: number;
  monthHits?: number;
  lastAt?: string;
};

export type DeskNewsletter = {
  id?: string;
  kind?: string;
  dateKey?: string;
  dateLabel?: string;
  at?: string;
  subject?: string;
  source?: string;
  sections?: {
    yesterday?: string;
    today?: string;
    tomorrow?: string;
    future?: string;
    closing?: string;
  };
  email?: {
    sent?: boolean;
    to?: string | null;
    id?: string | null;
    error?: string | null;
  };
};

/** Agent → client push (Telegram/email + desk feed). */
export type DeskAgentAlert = {
  id?: string;
  at?: string;
  firstAt?: string;
  lastAt?: string;
  source?: string;
  kind?: string;
  plain?: string;
  why?: string | null;
  symbol?: string | null;
  side?: string | null;
  instrument?: string | null;
  live?: boolean;
  notional?: number | null;
  targetPct?: number | null;
  stopPct?: number | null;
  planId?: string | null;
  anxiety?: boolean;
  ageMs?: number;
  notified?: { telegram?: boolean; email?: boolean } | null;
  fingerprint?: string | null;
  /** How many identical copies were rolled into this row today. */
  repeatCount?: number;
};

/** End-of-day / intraday rhyme ledger — not the live Agent→you feed. */
export type DeskAlertDayPattern = {
  fingerprint?: string;
  kind?: string;
  plain?: string;
  count?: number;
  firstAt?: string;
  lastAt?: string;
};

export type DeskFocusAlert = {
  id?: string;
  at?: string;
  plain?: string;
  why?: string | null;
  longBook?: string | null;
  longSymbol?: string | null;
  shortSymbol?: string | null;
  targetPct?: number | null;
  ageMs?: number;
  note?: string;
};

/** Was a flat day a real decision, or did the engine fail? */
export type DeskDayQuality = {
  dateKey?: string;
  total?: number;
  decisions?: number;
  outages?: number;
  unsupported?: number;
  policyBlocks?: number;
  opens?: number;
  lastIntegrity?: "decision" | "unsupported" | "outage" | "policy_block" | string | null;
  lastSource?: string | null;
  engineHealthy?: boolean | null;
  verdict?:
    | "traded"
    | "flat_by_decision"
    | "mixed"
    | "policy_block"
    | "engine_down"
    | "unknown"
    | string;
  plain?: string;
};

/** Week-to-date band on realized equity — replaces daily-hole pressure. */
export type DeskWeekBand = {
  weekStart?: string;
  goalPct?: number;
  startEquity?: number | null;
  lastEquity?: number | null;
  weekPct?: number | null;
  holePct?: number;
  days?: number;
  dailyMarks?: Array<{ dateKey: string; pct: number | null; equity: number }>;
  plain?: string;
};

/** Pre-open / recovery brief — how to make the day band from the live book. */
export type DeskOpenBrief = {
  at?: string;
  headline?: string;
  plain?: string;
  answer?: string;
  minsToOpen?: number | null;
  isPreOpen?: boolean;
  isRth?: boolean;
  goalPct?: number;
  bookPnlPct?: number | null;
  bookPnlUsd?: number | null;
  holePct?: number;
  holeUsd?: number | null;
  bookCost?: number | null;
  bookValue?: number | null;
  buyingPower?: number | null;
  fusion?: {
    action?: string | null;
    symbol?: string | null;
    source?: string | null;
    why?: string | null;
    broken?: boolean;
    refreshing?: boolean;
  };
  /** Pack fields the model actually cited (audit trail). */
  used?: string[];
  staging?: { symbol?: string; side?: string | null; strategy?: string | null } | null;
  tapeLead?: { symbol?: string; side?: string; changePct?: number; score?: number } | null;
  ramp?: Array<{ symbol: string; pnlPct?: number | null; marketValue?: number | null }>;
  protect?: Array<{ symbol: string; pnlPct?: number | null; marketValue?: number | null }>;
  /** Channel-floor recovery day plays (bank partial at ~+5%, leave, flatten before close). */
  recovery?: Array<{
    symbol?: string;
    pnlPct?: number | null;
    play?: string | null;
    entry?: number | null;
    stop?: number | null;
    target?: number | null;
    plain?: string | null;
    daySession?: {
      bankPctAtPop?: number;
      leavePct?: number;
      noOvernight?: boolean;
      flattenBeforeClose?: boolean;
      plain?: string | null;
    } | null;
  }>;
  breakouts?: Array<{
    symbol?: string;
    play?: string | null;
    entry?: number | null;
    plain?: string | null;
  }>;
  channelPlays?: {
    note?: string | null;
    recovery?: DeskOpenBrief["recovery"];
    breakouts?: DeskOpenBrief["breakouts"];
  } | null;
  steps?: Array<{ kind?: string; title?: string; detail?: string; symbols?: string[] }>;
  error?: string;
};

/** Regime core: live witnesses rhymed to past crises + past news moments. */
export type DeskRegime = {
  at?: string;
  stance?:
    | "stay_aboard"
    | "watch"
    | "leave_boat"
    | "building_new_boat"
    | "dip_buy_options"
    | "mixed"
    | string;
  confidence?: number;
  plain?: string;
  /** False when only headlines fired — agents must not act on chatter. */
  corroborated?: boolean;
  /** War-over / ceasefire / peace = sell the aftermath, not dip-buy. */
  sellAftermath?: boolean;
  warOver?: {
    score?: number;
    sellAftermath?: boolean;
    plain?: string | null;
    headlines?: Array<{ title?: string; source?: string }>;
  } | null;
  witnessKinds?: string[];
  topPlaybook?: {
    id?: string;
    name?: string;
    score?: number;
    analogs?: string[];
    leaveBoat?: string;
    newBoat?: string;
  } | null;
  playbooks?: Array<{
    id?: string;
    name?: string;
    score?: number;
    litCount?: number;
    hintTotal?: number;
    pastNewsMoment?: { id?: string; era?: string; phase?: string; label?: string } | null;
    litHints?: Array<{ id?: string; label?: string; score?: number; witnesses?: string[] }>;
    leaveBoat?: string;
    newBoat?: string;
    analogs?: string[];
  }>;
  historicalNews?: {
    hitCount?: number;
    newsStanceHint?: { stance?: string; plain?: string; momentId?: string } | null;
    hits?: Array<{
      id?: string;
      era?: string;
      label?: string;
      phase?: string;
      score?: number;
      playbookId?: string;
      modernRhyme?: string;
      sampleTitles?: string[];
      exemplars?: string[];
    }>;
    note?: string;
  } | null;
  actions?: string[];
  watchNext?: string[];
  note?: string;
  witnesses?: {
    fred?: boolean;
    news?: number;
    pastNewsHits?: number;
    tapeBooks?: number;
    hintMemory?: boolean;
    nim?: boolean;
  };
};

export type DeskDayState = {
  ok?: boolean;
  error?: string;
  /** True when payload is the Mission Control lite bootstrap (rankings truncated). */
  lite?: boolean;
  et?: {
    dateKey?: string;
    weekday?: string;
    hour?: number;
    minute?: number;
    mins?: number;
    isRth?: boolean;
    isMorningPlanWindow?: boolean;
    isPreClose?: boolean;
    isAfterClose?: boolean;
    isWeekend?: boolean;
  };
  dayGoal?: { min?: number; stretch?: number };
  /** Fraction, e.g. 0.0119 = +1.19% book day estimate */
  dayPnlPctEst?: number | null;
  dayPeakPnlPct?: number | null;
  dayGoalHit?: boolean;
  bankMode?: boolean;
  /** One capital slot — the armed sleeve that should sit next to Staging / the play. */
  capitalSlot?: {
    maxSlots?: number;
    used?: number;
    free?: number;
    incumbent?: {
      symbol?: string | null;
      kind?: string | null;
      right?: string | null;
      live?: boolean;
      planId?: string | null;
      thesis?: string | null;
      sizeCapUsd?: number | null;
      edgeScore?: number | null;
      openedAt?: string | null;
      contract?: {
        strike?: number | null;
        expiration?: string | null;
        right?: string | null;
      } | null;
      optionMeta?: {
        strike?: number | null;
        expiration?: string | null;
        mark?: number | null;
        verdict?: string | null;
      } | null;
      exitPlan?: {
        rule?: string | null;
        takeProfitPct?: number | null;
        stopLossPct?: number | null;
      } | null;
    } | null;
    holdings?: unknown[];
    updatedAt?: string | null;
    policy?: { note?: string | null };
  } | null;
  /** Board-wide small-debit option hunt (asymmetric sleeves → then protect). */
  optionHunt?: {
    note?: string | null;
    scanned?: number | null;
    tradeableCount?: number;
    best?: {
      symbol?: string | null;
      right?: string | null;
      strike?: number | null;
      expiration?: string | null;
      debitUsd?: number | null;
      verdict?: string | null;
      tradeable?: boolean;
      edgeScore?: number | null;
      upsideMultiple?: number | null;
      sizeCapUsd?: number | null;
      dte?: number | null;
      plain?: string | null;
    } | null;
    candidates?: Array<{
      symbol?: string | null;
      right?: string | null;
      debitUsd?: number | null;
      upsideMultiple?: number | null;
      verdict?: string | null;
      tradeable?: boolean;
    }>;
  } | null;
  /**
   * Call/put purchase tape — crowded side is contrarian.
   * building = get opposite asymmetric early or wait; cresting = wait for crest then fade.
   */
  callPurchase?: {
    note?: string | null;
    callContractsPurchased?: number;
    putContractsPurchased?: number;
    pcr?: number | null;
    crowdedSide?: "call" | "put" | null;
    phase?: "building" | "cresting" | "cool" | string | null;
    playMode?: "asymmetric_early" | "wait_crest" | "fade" | "watch" | string | null;
    extreme?: boolean;
    contrarian?: {
      active?: boolean;
      stance?: string | null;
      crowdedSide?: string | null;
      phase?: string | null;
      mode?: string | null;
      preferRight?: string | null;
      plain?: string | null;
    } | null;
    topCallSymbol?: string | null;
    topPutSymbol?: string | null;
  } | null;
  /** Mechanical channel recovery / breakout day plays. */
  channelPlays?: {
    note?: string | null;
    scanned?: number | null;
    bestRecovery?: {
      symbol?: string | null;
      play?: string | null;
      plain?: string | null;
      daySession?: { bankPctAtPop?: number; leavePct?: number; plain?: string | null } | null;
    } | null;
    bestBreakout?: { symbol?: string | null; play?: string | null; plain?: string | null } | null;
    recovery?: DeskOpenBrief["recovery"];
    breakouts?: DeskOpenBrief["breakouts"];
  } | null;
  /** Latest NIM fusion entry decision (not a tape scoreboard). */
  lastDecisionAt?: string | null;
  /** Why this pass produced no NEW call (slot held, max live, auto off…). */
  lastSkip?: {
    at?: string;
    reason?: string;
    detail?: string | null;
    slot?: string | null;
  } | null;
  lastDecision?: {
    action?: string;
    symbol?: string | null;
    why?: string;
    horizon?: string;
    instrument?: string | null;
    confidence?: number;
    kill?: string[];
    hints?: Array<{
      label?: string;
      symbol?: string | null;
      industry?: string | null;
      watchFor?: string | null;
      largerMove?: string | null;
      horizon?: string;
    }>;
    source?: string;
    contextBytes?: number;
    duration_ms?: number;
    /** Pack fields the model cited — empty means we cannot audit the call. */
    used?: string[];
    citedCount?: number;
    citedOk?: boolean;
    compact?: boolean;
  } | null;
  /** Multi-session hint memory: see → watch → week/month repeat → larger move. */
  hintMemory?: {
    note?: string;
    total?: number;
    watching?: number;
    confirmed?: number;
    strategyReady?: number;
    watchingList?: DeskHint[];
    confirmedList?: DeskHint[];
    strategyReadyList?: DeskHint[];
  } | null;
  /** Latest account-owner daily letter (yesterday→today→tomorrow→future). */
  newsletter?: DeskNewsletter | null;
  /** Agent → you: recent pushes with why + anxiety on open risk. */
  agentAlerts?: {
    latest?: DeskAgentAlert | null;
    openAnxiety?: DeskAgentAlert[];
    recent?: DeskAgentAlert[];
    /** Collapsed repeats for end-of-day pattern tracking. */
    dayPatterns?: DeskAlertDayPattern[];
    dateKey?: string | null;
  } | null;
  /** Optional operator focus note (secondary). */
  focusAlert?: DeskFocusAlert | null;
  /** Operator / auto shock latch. */
  riskOff?: {
    active?: boolean;
    riskOff?: {
      active?: boolean;
      plain?: string | null;
      headline?: string | null;
      reason?: string;
      at?: string;
    } | null;
    bankMode?: boolean;
  } | null;
  /** Regime thinking core — past-news rhymes + consensus stance. */
  regime?: DeskRegime | null;
  /** Open bell / recovery plan — hole to +1% and what to do. */
  openBrief?: DeskOpenBrief | null;
  /** Decision integrity for today (choice vs outage). */
  dayQuality?: DeskDayQuality | null;
  /** Weekly band on realized equity. */
  weekBand?: DeskWeekBand | null;
  engine?: {
    healthy?: boolean | null;
    lastIntegrity?: string | null;
    lastSource?: string | null;
    note?: string | null;
  } | null;
  /** True while a desk-day pass (fusion) is running server-side. */
  refreshing?: boolean;
  refreshStartedAt?: string | null;
  accepted?: boolean;
  autoExecute?: boolean;
  autoLive?: boolean;
  fiduciary?: { note?: string; maxLive?: number; entry?: string };
  universe?: {
    size?: number;
    books?: Array<{
      id: string;
      label: string;
      core: string[];
      tangential: string[];
    }>;
  };
  state?: {
    note?: string;
    phase?: string;
    updatedAt?: string;
    rankings?: DeskRank[];
    synthesis?: DeskSynthesis | null;
    /** Live Agentic equity holdings — includes manual/app fills */
    rhActivity?: {
      at?: string;
      buyingPower?: number | null;
      note?: string;
      positions?: Array<{
        symbol: string;
        quantity?: number;
        side?: string;
        avgCost?: number | null;
        marketValue?: number | null;
        mark?: number | null;
        changePct?: number | null;
        pnlPct?: number | null;
        pnlUsd?: number | null;
        sourceNote?: string;
        deskPlans?: Array<{
          id?: string;
          live?: boolean;
          status?: string;
          dry_run?: boolean;
        }>;
      }>;
    } | null;
    morningPlan?: {
      headline?: string;
      narrative?: string;
      proposeArm?: DeskRank | null;
      synthesis?: DeskSynthesis | null;
      industryLead?: {
        industryId?: string;
        label?: string;
        avgScore?: number;
        changePct?: number | null;
      } | null;
      sleeves?: {
        day?: DeskRank[];
        week?: DeskRank[];
        month?: DeskRank[];
      };
    };
    industryTilt?: Array<{
      industryId: string;
      label: string;
      avgScore: number;
      changePct?: number | null;
    }>;
    rhAssist?: {
      configured?: boolean;
      quoted?: number;
      buyingPower?: number | null;
      heldInUniverse?: string[];
      gloss?: {
        held?: string;
        quotes?: string;
        volume?: string;
      };
      note?: string;
    };
  };
};

export type IndustryTape = {
  ok?: boolean;
  error?: string;
  buyingPower?: number | null;
  books?: Array<{
    id: string;
    label: string;
    core: string[];
    tangential: string[];
    avgChangePct?: number | null;
    quoted?: number;
    names?: Array<{
      symbol: string;
      scope: string;
      price?: number | null;
      changePct?: number | null;
      held?: boolean;
    }>;
  }>;
};

async function readJson(res: Response): Promise<Record<string, unknown>> {
  const text = await res.text();
  if (!text.trim()) {
    throw new Error(`Empty response (${res.status}) from desk API`);
  }
  try {
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    throw new Error(`Invalid JSON (${res.status}): ${text.slice(0, 120)}`);
  }
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function fetchDeskDayOnce(lite = false): Promise<DeskDayState> {
  const qs = lite ? "action=desk-day&lite=1" : "action=desk-day";
  const res = await fetch(`/api/ceo?${qs}`, { cache: "no-store" });
  const data = await readJson(res);
  if (data.ok === false || (res.status >= 400 && data.error)) {
    throw new Error(String(data.error || `Desk day failed (${res.status})`));
  }
  if (!data.et || typeof data.et !== "object") {
    throw new Error("Desk day missing session clock (et) — refusing blank Mission Control");
  }
  return data as DeskDayState;
}

/** Fast Mission Control paint — et / fusion / capital slot without full rankings. */
export async function fetchDeskDayLite(): Promise<DeskDayState> {
  return fetchDeskDayOnce(true);
}

export async function fetchDeskDay(): Promise<DeskDayState> {
  try {
    return await fetchDeskDayOnce(false);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    // Prefer lite recovery so Mission Control unsticks even if full payload flakes.
    if (/empty response|timed out|504|502|500|missing session clock/i.test(msg)) {
      await sleep(400);
      try {
        return await fetchDeskDayOnce(true);
      } catch {
        await sleep(600);
        return fetchDeskDayOnce(false);
      }
    }
    throw err;
  }
}

export async function fetchIndustryTape(book?: string | null): Promise<IndustryTape> {
  const q = book ? `&book=${encodeURIComponent(book)}` : "";
  const res = await fetch(`/api/ceo?action=industry-tape${q}`, { cache: "no-store" });
  return (await readJson(res)) as IndustryTape;
}

export async function fetchOpenBook(): Promise<{ ok?: boolean; plans?: DeskPlan[]; error?: string }> {
  const res = await fetch("/api/ceo?action=plans", { cache: "no-store" });
  return (await readJson(res)) as { ok?: boolean; plans?: DeskPlan[]; error?: string };
}

/** Operator play-by-play: wait | open | monitor | add | close */
export async function runPlanPhase(planId: string, phase: string) {
  const res = await fetch("/api/ceo", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      action: "tick-plan",
      planId,
      phase,
    }),
  });
  return readJson(res) as Promise<{
    ok?: boolean;
    error?: string;
    phase?: string;
    detail?: string;
    actions?: Array<{ type?: string; result?: string }>;
    plan?: DeskPlan;
  }>;
}

/**
 * Kick a desk-day pass. Railway runs fusion async by default so the Vercel
 * proxy never sits on a 30s+ response (which produced empty 500s).
 * Polls until `state.updatedAt` moves or `refreshing` clears.
 */
export async function runDeskPass(live = false): Promise<DeskDayState> {
  const res = await fetch("/api/ceo", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      action: "desk-day",
      reason: "manual",
      live,
      confirm: live,
      // Explicit: never ask the proxy to wait on NIM fusion.
      wait: false,
    }),
  });
  const started = (await readJson(res)) as DeskDayState;
  if (started.ok === false && started.error) {
    throw new Error(String(started.error));
  }
  const prevUpdated = started.state?.updatedAt || null;
  if (!started.refreshing && !started.accepted) {
    return started;
  }
  for (let i = 0; i < 45; i++) {
    await sleep(1500);
    try {
      const next = await fetchDeskDayOnce();
      const moved =
        next.state?.updatedAt &&
        prevUpdated &&
        next.state.updatedAt !== prevUpdated;
      if (moved || next.refreshing === false) {
        return next;
      }
    } catch {
      /* keep polling — pass may still be running */
    }
  }
  // Return best-effort snapshot even if fusion is still chewing.
  try {
    return await fetchDeskDayOnce();
  } catch {
    return started;
  }
}

/** Release a capital-slot occupant (clears dry ghosts that block Take LIVE). */
export async function releaseCapitalSlot(input: { symbol: string; reason?: string }) {
  const res = await fetch("/api/ceo", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      action: "release",
      symbol: input.symbol,
      reason: input.reason || "owner_clear",
    }),
  });
  return readJson(res) as Promise<{ ok?: boolean; released?: string; error?: string; used?: number }>;
}

/** Owner Take / Preview — fire the tradeable option-hunt sleeve into the capital slot. */
export async function takeOptionHunt(input: {
  live: boolean;
  best?: NonNullable<DeskDayState["optionHunt"]>["best"];
  why?: string;
}) {
  const { live, best, why } = input;
  const res = await fetch("/api/ceo", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      action: "take-hunt",
      confirm: live,
      dryRun: !live,
      best: best || undefined,
      why: why || undefined,
    }),
  });
  const data = (await readJson(res)) as {
    ok?: boolean;
    mode?: string;
    symbol?: string;
    instrument?: string;
    notional?: number;
    planId?: string;
    message?: string;
    error?: string;
    reason?: string;
    detail?: string;
    openBlocked?: boolean;
    openDetail?: string;
  };
  if (res.status >= 500) {
    throw new Error(
      String(data.message || data.error || `Desk API ${res.status} — Take LIVE did not complete`)
    );
  }
  if (data.openBlocked && data.ok) {
    data.message =
      data.message
      || `Armed in slot but open blocked (${data.openDetail || "NO_AFFORDABLE_OPTION"}) — add buying power.`;
  }
  return data;
}

export async function armDeskPlay(input: {
  rank: DeskRank;
  notionalUsd: number;
  live: boolean;
}) {
  const { rank, notionalUsd, live } = input;
  const thesisPct = Math.round((rank.agentExpectedReturn || 0.03) * 100);
  const entry = rank.price != null && Number.isFinite(Number(rank.price))
    ? Number(rank.price)
    : undefined;
  // Climax accelerator: real stop (~1.5%) + trail — not a naked buy with empty levels.
  const res = await fetch("/api/ceo", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      action: "arm-plan",
      climax: true,
      dryRun: !live,
      confirm: live,
      symbol: rank.symbol,
      idea: {
        id: rank.id,
        symbol: rank.symbol,
        kind: "accelerator",
        side: rank.side || "long",
        strategy: rank.strategy || "desk",
        title: `${rank.industryLabel} · ${rank.symbol} ${rank.side}`,
        notionalHint: notionalUsd,
        agentExpectedReturn: rank.agentExpectedReturn || 0.03,
        levels: entry != null ? { entry } : {},
        schedule: {
          due_label: rank.due,
          horizon: rank.horizon,
          open_when: "next_rth_if_closed",
        },
        accelerator: {
          mode: "climax",
          maxNotionalUsd: notionalUsd,
          targetPct: 0.01,
          stretchPct: 0.03,
          stopPct: 0.015,
        },
        layman_directive:
          `${rank.industryLabel} ${rank.symbol}: buy once, then worker manages stop/trail/time`
          + ` (~${thesisPct}% thesis · ${rank.horizon}). Not a naked hold.`,
        thesis: `${rank.industryLabel} ${rank.strategy} · ~${thesisPct}% · ${rank.horizon}`,
      },
    }),
  });
  return readJson(res);
}

/** Refresh regime thinking core (past-news rhyme + consensus). */
export async function runRegimePass(): Promise<{ ok?: boolean; regime?: DeskRegime; error?: string }> {
  const res = await fetch("/api/ceo", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "desk-regime", reason: "manual" }),
  });
  return readJson(res) as Promise<{ ok?: boolean; regime?: DeskRegime; error?: string }>;
}

/** Operator RISK OFF — close day longs; optionally flatten option shorts. */
export async function runDeskRiskOff(input: {
  plain?: string;
  headline?: string;
  flattenShorts?: boolean;
  live?: boolean;
} = {}) {
  const res = await fetch("/api/ceo", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      action: "desk-risk-off",
      reason: "operator",
      plain: input.plain,
      headline: input.headline,
      flattenLongs: true,
      flattenShorts: Boolean(input.flattenShorts),
      live: Boolean(input.live),
      confirm: Boolean(input.live),
    }),
  });
  return readJson(res);
}

/** Arm stop/trail on shares you already hold — no new buy. */
export async function protectHeldPosition(input: {
  symbol: string;
  avgCost?: number | null;
  mark?: number | null;
  quantity?: number | null;
  marketValue?: number | null;
  live: boolean;
}) {
  const res = await fetch("/api/ceo", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      action: "protect-held",
      protectHeld: true,
      dryRun: !input.live,
      confirm: input.live,
      symbol: input.symbol,
      entry: input.avgCost,
      avgCost: input.avgCost,
      mark: input.mark,
      quantity: input.quantity,
      marketValue: input.marketValue,
      stopPct: 0.015,
      targetPct: 0.01,
      stretchPct: 0.03,
    }),
  });
  return readJson(res);
}

export function fmtPct(n?: number | null, digits = 2) {
  if (n == null || Number.isNaN(Number(n))) return "—";
  const v = Number(n);
  const sign = v > 0 ? "+" : "";
  return `${sign}${v.toFixed(digits)}%`;
}

export function fmtUsd(n?: number | null) {
  if (n == null || Number.isNaN(Number(n))) return "—";
  return `$${Number(n).toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })}`;
}
