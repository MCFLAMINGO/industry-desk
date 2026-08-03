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

/** Live Agentic equity holdings — independent of desk-day state. */
export async function fetchLivePositions(): Promise<{
  ok: boolean;
  positions: RhLivePosition[];
  buyingPower: number | null;
  accountNumber?: string | null;
  error?: string;
}> {
  const res = await fetch("/api/robinhood?action=portfolio", { cache: "no-store" });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.error) {
    return {
      ok: false,
      positions: [],
      buyingPower: null,
      error: String(data.error || `HTTP ${res.status}`),
    };
  }

  const rows = extractPositionRows(data.positions);
  const positions: RhLivePosition[] = [];
  for (const row of rows) {
    const instrument = row.instrument as Record<string, unknown> | undefined;
    const stock = row.stock as Record<string, unknown> | undefined;
    const sym = String(row.symbol || instrument?.symbol || stock?.symbol || "").toUpperCase();
    const qty = Number(row.quantity ?? row.shares ?? row.units ?? 0);
    if (!sym || !Number.isFinite(qty) || qty === 0) continue;
    const avg = Number(row.average_buy_price ?? row.avg_cost ?? row.average_price);
    const mkt = Number(row.market_value ?? row.equity ?? row.value);
    const last = Number(
      row.last_trade_price
        ?? row.mark_price
        ?? row.adjusted_mark_price
        ?? row.price
        ?? row.last_price
        ?? instrument?.last_trade_price
        ?? stock?.last_trade_price
    );
    const lastPrice = Number.isFinite(last)
      ? last
      : Number.isFinite(mkt) && qty
        ? mkt / Math.abs(qty)
        : null;
    positions.push({
      symbol: sym,
      quantity: qty,
      side: qty < 0 ? "short" : "long",
      avgCost: Number.isFinite(avg) ? avg : null,
      marketValue: Number.isFinite(mkt) ? mkt : null,
      lastPrice,
    });
  }
  positions.sort(
    (a, b) => Math.abs(b.marketValue || 0) - Math.abs(a.marketValue || 0)
  );

  const port = data.portfolio?.parsed?.data || data.portfolio?.parsed || data.portfolio?.data || {};
  const nested = port.data || port;
  const bpRaw =
    nested?.buying_power?.buying_power ?? nested?.buying_power ?? nested?.unleveraged_buying_power;
  const buyingPower = bpRaw != null && Number.isFinite(Number(bpRaw)) ? Number(bpRaw) : null;

  return {
    ok: true,
    positions,
    buyingPower,
    accountNumber: data.account_number || null,
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
