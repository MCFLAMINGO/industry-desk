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
  autoExecute?: boolean;
  autoLive?: boolean;
  fiduciary?: { note?: string; maxLive?: number };
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
  const res = await fetch("/api/ceo", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      action: "arm-plan",
      dryRun: !live,
      confirm: live,
      symbol: rank.symbol,
      idea: {
        id: rank.id,
        symbol: rank.symbol,
        kind: rank.strategy === "desk" ? "primary_equity" : rank.strategy,
        side: rank.side || "long",
        strategy: rank.strategy,
        title: `${rank.industryLabel} · ${rank.symbol} ${rank.side}`,
        notionalHint: notionalUsd,
        agentExpectedReturn: rank.agentExpectedReturn,
        levels: {},
        schedule: {
          due_label: rank.due,
          horizon: rank.horizon,
          // Backend defers live opens to next RTH when armed off-hours / Sunday
          open_when: "next_rth_if_closed",
        },
        execution_plan: {
          steps: [
            {
              id: "open_equity",
              phase: "open",
              title: `Open ${rank.symbol}`,
              agent_action: "review_equity_order_then_place",
              order_kind: "equity",
              notional_usd: notionalUsd,
            },
            {
              id: "monitor_position",
              phase: "monitor",
              title: "Monitor position / tape",
              agent_action: "poll_quotes_and_compare_levels",
            },
            {
              id: "close_manage",
              phase: "close",
              title: "Close early, on target, or by time",
              agent_action: "close_at_stop_target_or_deadline",
            },
          ],
        },
        thesis: `${rank.industryLabel} ${rank.strategy} · ~${thesisPct}% · ${rank.horizon}`,
      },
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
