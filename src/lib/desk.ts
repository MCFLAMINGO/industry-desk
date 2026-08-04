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
  orderState?: string | null;
} {
  const open = plan.steps?.find((s) => s.phase === "open");
  if (!plan.live || plan.dry_run || open?.status === "dry_run_done") {
    return { kind: "dry", label: "Dry-run · not placed" };
  }
  const order = open?.result?.placed?.parsed?.data?.order;
  const state = String(plan.order_state || order?.state || "").toLowerCase() || null;
  const cum = Number(plan.filled_qty ?? order?.cumulative_quantity ?? 0);
  if (cum > 0 || state === "filled" || state === "partially_filled") {
    const amt = plan.filled_notional;
    return {
      kind: "filled",
      label: amt != null ? `Filled ~$${amt}` : "Filled in Robinhood",
      orderState: state,
    };
  }
  if (state === "queued" || state === "unconfirmed" || state === "confirmed" || open?.status === "done") {
    return {
      kind: "submitted_unfilled",
      label: `Submitted · ${state || "queued"} · not filled (no position)`,
      orderState: state,
    };
  }
  if (plan.open_filled && plan.filled_notional != null) {
    return { kind: "unknown", label: `Marked ~$${plan.filled_notional} (verify in RH)`, orderState: state };
  }
  return { kind: "unknown", label: "No fill yet", orderState: state };
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

export type DeskDayState = {
  ok?: boolean;
  error?: string;
  et?: {
    dateKey?: string;
    weekday?: string;
    hour?: number;
    minute?: number;
    isRth?: boolean;
    isMorningPlanWindow?: boolean;
    isAfterClose?: boolean;
  };
  dayGoal?: { min?: number; stretch?: number };
  /** Fraction, e.g. 0.0119 = +1.19% book day estimate */
  dayPnlPctEst?: number | null;
  dayPeakPnlPct?: number | null;
  dayGoalHit?: boolean;
  bankMode?: boolean;
  /** Latest NIM fusion entry decision (not a tape scoreboard). */
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

export async function fetchDeskDay(): Promise<DeskDayState> {
  const res = await fetch("/api/ceo?action=desk-day", { cache: "no-store" });
  return (await readJson(res)) as DeskDayState;
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

export async function runDeskPass(live = false) {
  const res = await fetch("/api/ceo", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      action: "desk-day",
      reason: "manual",
      live,
      confirm: live,
    }),
  });
  return readJson(res);
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
