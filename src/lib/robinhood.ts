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
