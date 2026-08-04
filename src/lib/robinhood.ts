export type RhStatus = {
  ok?: boolean;
  configured?: boolean;
  live_trading_enabled?: boolean;
  options_trading_enabled?: boolean;
  max_notional_usd?: number;
  default_notional_usd?: number;
  account_number?: string | null;
  token_source?: string;
  note?: string;
  error?: string;
};

export async function fetchRhStatus(): Promise<RhStatus> {
  const res = await fetch("/api/robinhood?action=status", { cache: "no-store" });
  return res.json();
}

export async function connectRobinhood(): Promise<{ authorize_url?: string; error?: string }> {
  const res = await fetch("/api/robinhood?action=connect", { cache: "no-store" });
  return res.json();
}

export async function fetchPortfolio() {
  const res = await fetch("/api/robinhood?action=portfolio", { cache: "no-store" });
  return res.json();
}

export type RhLivePosition = {
  symbol: string;
  quantity: number;
  side: string;
  avgCost: number | null;
  marketValue: number | null;
  /** Last trade / mark from Agentic portfolio when present. */
  lastPrice: number | null;
  /** Session / day change in percent points when RH provides it (e.g. +3.02). */
  dayChangePct?: number | null;
};

function extractPositionRows(payload: unknown): Record<string, unknown>[] {
  if (!payload) return [];
  if (Array.isArray(payload)) return payload as Record<string, unknown>[];
  const root = payload as Record<string, unknown>;
  const parsed = (root.parsed as Record<string, unknown>) || root;
  const data = (parsed.data as Record<string, unknown>) || parsed;
  const nested = (data.data as Record<string, unknown>) || data;
  for (const key of ["results", "positions", "equity_positions", "items"]) {
    const v = nested[key];
    if (Array.isArray(v)) return v as Record<string, unknown>[];
  }
  if (Array.isArray(nested)) return nested as unknown as Record<string, unknown>[];
  return [];
}

type LivePositionsResult = {
  ok: boolean;
  positions: RhLivePosition[];
  buyingPower: number | null;
  accountNumber?: string | null;
  error?: string;
  stale?: boolean;
  warning?: string;
};

/** Last good book — keep showing holds through RH rate limits / proxy blips. */
let _lastGoodPositions: LivePositionsResult | null = null;

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function parsePositionsPayload(data: Record<string, unknown>): LivePositionsResult {
  const rows = extractPositionRows(data.positions);
  const quoteMarks = (data.quote_marks || {}) as Record<string, number>;
  const positions: RhLivePosition[] = [];
  for (const row of rows) {
    const instrument = row.instrument as Record<string, unknown> | undefined;
    const stock = row.stock as Record<string, unknown> | undefined;
    const sym = String(row.symbol || instrument?.symbol || stock?.symbol || "").toUpperCase();
    const qty = Number(row.quantity ?? row.shares ?? row.units ?? 0);
    if (!sym || !Number.isFinite(qty) || qty === 0) continue;
    const avg = Number(row.average_buy_price ?? row.avg_cost ?? row.average_price);
    const mkt = Number(row.market_value ?? row.equity ?? row.value);
    // Prefer extended / overnight prints after the regular session closes.
    const last = Number(
      row.last_non_reg_trade_price
        ?? row.extended_hours_price
        ?? row.overnight_price
        ?? row.last_extend_hours_trade_price
        ?? row.mark_price
        ?? row.adjusted_mark_price
        ?? row.last_trade_price
        ?? row.price
        ?? row.last_price
        ?? instrument?.last_non_reg_trade_price
        ?? instrument?.last_trade_price
        ?? stock?.last_trade_price
        ?? row.quote_last_price
    );
    const fromQuoteBatch = Number(quoteMarks[sym]);
    const lastPrice = Number.isFinite(last)
      ? last
      : Number.isFinite(fromQuoteBatch) && fromQuoteBatch > 0
        ? fromQuoteBatch
        : Number.isFinite(mkt) && qty
          ? mkt / Math.abs(qty)
          : null;
    // Prefer quote-batch mark after hours when portfolio last_trade is stale RTH.
    const mark =
      Number.isFinite(fromQuoteBatch) && fromQuoteBatch > 0
        ? fromQuoteBatch
        : lastPrice;
    const dayChg = Number(
      row.percent_change
        ?? row.percentage_change
        ?? row.day_change_percent
        ?? row.total_return_today_percent
        ?? instrument?.percent_change
    );
    positions.push({
      symbol: sym,
      quantity: qty,
      side: qty < 0 ? "short" : "long",
      avgCost: Number.isFinite(avg) ? avg : null,
      marketValue: Number.isFinite(mkt) ? mkt : null,
      lastPrice: mark,
      dayChangePct: Number.isFinite(dayChg) ? dayChg : null,
    });
  }
  positions.sort(
    (a, b) => Math.abs(b.marketValue || 0) - Math.abs(a.marketValue || 0)
  );

  const port =
    (data.portfolio as Record<string, unknown> | undefined)?.parsed as
      | Record<string, unknown>
      | undefined;
  const portRoot =
    (port?.data as Record<string, unknown> | undefined) ||
    port ||
    (data.portfolio as Record<string, unknown> | undefined)?.data ||
    {};
  const nested =
    ((portRoot as Record<string, unknown>).data as Record<string, unknown> | undefined) ||
    (portRoot as Record<string, unknown>);
  const bpObj = nested?.buying_power as Record<string, unknown> | number | undefined;
  const bpRaw =
    (typeof bpObj === "object" && bpObj ? bpObj.buying_power : bpObj) ??
    nested?.buying_power ??
    nested?.unleveraged_buying_power;
  const buyingPower = bpRaw != null && Number.isFinite(Number(bpRaw)) ? Number(bpRaw) : null;

  return {
    ok: true,
    positions,
    buyingPower,
    accountNumber: (data.account_number as string | null) || null,
    stale: Boolean(data.stale),
    warning: data.warning ? String(data.warning) : undefined,
  };
}

function isRateLimitedPayload(data: Record<string, unknown>, status: number) {
  if (status === 429) return true;
  if (String(data.code || "") === "RATE_LIMITED") return true;
  if (/RATE_LIMITED|rate.?limit|too many requests/i.test(String(data.error || ""))) return true;
  if (String(data.warning || "") === "RATE_LIMITED") return true;
  const pos = data.positions as Record<string, unknown> | undefined;
  const cat = (pos?.raw as Record<string, unknown> | undefined)?._meta as
    | Record<string, unknown>
    | undefined;
  return cat?.rh_error_category === "rate_limited";
}

async function fetchPortfolioRaw(): Promise<{
  status: number;
  data: Record<string, unknown>;
}> {
  const res = await fetch("/api/robinhood?action=portfolio", { cache: "no-store" });
  const text = await res.text();
  if (!text.trim()) {
    return {
      status: res.status || 502,
      data: { ok: false, error: `Empty response (${res.status})` },
    };
  }
  try {
    return { status: res.status, data: JSON.parse(text) as Record<string, unknown> };
  } catch {
    return {
      status: res.status || 502,
      data: { ok: false, error: `Invalid JSON (${res.status})` },
    };
  }
}

/** Live Agentic equity holdings — independent of desk-day state. */
export async function fetchLivePositions(): Promise<LivePositionsResult> {
  let last: { status: number; data: Record<string, unknown> } | null = null;
  for (let attempt = 0; attempt < 2; attempt++) {
    last = await fetchPortfolioRaw();
    const { status, data } = last;
    const rateLimited = isRateLimitedPayload(data, status);

    // Swarm may return stale=true + ok positions while RH is throttling.
    if (data.ok !== false && !data.error && (status < 400 || data.stale)) {
      const parsed = parsePositionsPayload(data);
      if (parsed.positions.length > 0 || !rateLimited) {
        if (parsed.positions.length > 0) _lastGoodPositions = parsed;
        return parsed;
      }
    }

    if (rateLimited && _lastGoodPositions) {
      return {
        ..._lastGoodPositions,
        ok: true,
        stale: true,
        warning: "RATE_LIMITED",
        error: undefined,
      };
    }

    const retryable = rateLimited || status === 502 || status === 503 || status === 504;
    if (retryable && attempt === 0) {
      await sleep(700);
      continue;
    }

    if (_lastGoodPositions && (rateLimited || status >= 500)) {
      return {
        ..._lastGoodPositions,
        ok: true,
        stale: true,
        warning: String(data.error || data.warning || `HTTP ${status}`),
      };
    }

    return {
      ok: false,
      positions: [],
      buyingPower: null,
      error: String(data.error || `HTTP ${status}`),
    };
  }

  return {
    ok: false,
    positions: [],
    buyingPower: null,
    error: String(last?.data?.error || "Could not load positions"),
  };
}

export async function dryRunReview(symbol: string, notionalUsd: number) {
  const res = await fetch("/api/robinhood", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      symbol,
      dryRun: true,
      confirm: false,
      notionalUsd,
      orderType: "market",
      trade_plan: { bias: "LONG" },
    }),
  });
  return res.json();
}

export async function armPlan(input: {
  symbol: string;
  notionalUsd: number;
  live?: boolean;
  title?: string;
}) {
  const res = await fetch("/api/ceo", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      action: "arm-plan",
      dryRun: !input.live,
      confirm: Boolean(input.live),
      symbol: input.symbol,
      idea: {
        id: `ai-${input.symbol.toLowerCase()}`,
        kind: "primary_equity",
        side: "long",
        title: input.title || `AI book · ${input.symbol}`,
        notionalHint: input.notionalUsd,
        levels: {},
        execution_plan: {
          steps: [
            {
              id: "open_equity",
              phase: "open",
              title: "Open equity",
              agent_action: "review_equity_order_then_place",
              order_kind: "equity",
              notional_usd: input.notionalUsd,
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
      },
    }),
  });
  return res.json();
}
