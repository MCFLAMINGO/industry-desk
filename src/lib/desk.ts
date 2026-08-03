/** Industry Desk → Railway desk-day / tape / plans helpers. */

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
  created_at?: string;
  updated_at?: string;
  steps?: Array<{
    id?: string;
    phase?: string;
    title?: string;
    status?: string;
  }>;
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
    morningPlan?: {
      headline?: string;
      narrative?: string;
      proposeArm?: DeskRank | null;
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
        schedule: { due_label: rank.due, horizon: rank.horizon },
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
