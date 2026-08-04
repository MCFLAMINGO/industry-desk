"use client";

import { ExternalLink } from "lucide-react";

/** Robinhood has no public chart iframe — deep-link the stock + show TradingView. */
export function robinhoodStockUrl(symbol: string) {
  return `https://robinhood.com/stocks/${encodeURIComponent(symbol.toUpperCase())}`;
}

export function tradingViewEmbedUrl(symbol: string) {
  const params = new URLSearchParams({
    symbol: symbol.toUpperCase(),
    interval: "15",
    theme: "light",
    style: "1",
    locale: "en",
    toolbarbg: "f4faf9",
    hideideas: "1",
    hidesidetoolbar: "1",
    symboledit: "0",
    saveimage: "0",
    withdateranges: "1",
    calendar: "0",
    allow_symbol_change: "0",
  });
  return `https://s.tradingview.com/widgetembed/?${params.toString()}`;
}

type Props = {
  symbol: string | null | undefined;
  label?: string;
};

export default function RhChartPanel({ symbol, label }: Props) {
  const sym = symbol ? String(symbol).toUpperCase() : null;
  if (!sym) {
    return (
      <div className="flex min-h-[220px] items-center justify-center rounded-2xl border border-dashed border-[var(--line)] bg-white/40 px-4 text-sm text-[var(--ink-soft)]">
        Stage a name to load its chart.
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-[var(--line)] bg-white/70">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--line)] px-3 py-2">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--teal)]">
          {label || "Chart"}{" "}
          <span className="mono normal-case tracking-normal text-[var(--ink)]">{sym}</span>
        </p>
        <div className="flex flex-wrap items-center gap-3 text-xs font-medium">
          <a
            href={robinhoodStockUrl(sym)}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 text-[var(--teal-deep)] hover:underline"
          >
            Open in Robinhood <ExternalLink className="h-3 w-3" />
          </a>
          <a
            href={`https://www.tradingview.com/chart/?symbol=${encodeURIComponent(sym)}`}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 text-[var(--ink-soft)] hover:text-[var(--teal-deep)]"
          >
            TradingView <ExternalLink className="h-3 w-3" />
          </a>
        </div>
      </div>
      <iframe
        title={`${sym} chart`}
        src={tradingViewEmbedUrl(sym)}
        className="h-[240px] w-full border-0 sm:h-[280px]"
        loading="lazy"
        referrerPolicy="no-referrer-when-downgrade"
      />
      <p className="px-3 py-1.5 text-[10px] text-[var(--ink-soft)]">
        Robinhood Agentic has no embeddable graph — this is live market context via TradingView, with a one-click jump into Robinhood.
      </p>
    </div>
  );
}
