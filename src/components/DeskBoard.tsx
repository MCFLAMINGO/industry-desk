"use client";

import { useCallback, useEffect, useMemo, useState, startTransition } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { RefreshCw, ExternalLink } from "lucide-react";
import clsx from "clsx";
import { DESK_BOOKS, INDUSTRIES } from "@/lib/industries";
import {
  armDeskPlay,
  fetchDeskDay,
  fetchIndustryTape,
  fetchOpenBook,
  fmtPct,
  fmtUsd,
  protectHeldPosition,
  runDeskPass,
  type DeskDayState,
  type DeskRank,
  type IndustryTape,
} from "@/lib/desk";
import {
  fetchLivePositions,
  fetchRhStatus,
  type RhLivePosition,
  type RhStatus,
} from "@/lib/robinhood";
import PlayByPlayRail from "@/components/PlayByPlayRail";
import LivePositionsRail, {
  LIVE_POSITIONS_POLL_MS,
} from "@/components/LivePositionsRail";

type SodStep = { title: string; detail: string; ready: boolean };

function buildSodSteps(input: {
  desk: DeskDayState | null;
  tape: IndustryTape | null;
  book: string;
  rankings: DeskRank[];
  bookSymbols: string[];
}): SodStep[] {
  const { desk, tape, book, rankings, bookSymbols } = input;
  const rh = desk?.state?.rhAssist;
  const mp = desk?.state?.morningPlan;
  const et = desk?.et;
  const top = rankings[0] || mp?.proposeArm || null;
  const tapeBook = tape?.books?.[0];
  const quoted = tapeBook?.quoted ?? rh?.quoted;
  const held = rh?.heldInUniverse || [];

  const syn = desk?.state?.synthesis || mp?.synthesis || null;
  const synReady = Boolean(syn?.global?.narrative || syn?.narrative);

  return [
    {
      title: "Analyze tape",
      detail: rh?.gloss?.quotes
        || (quoted != null
          ? `${quoted} live Robinhood quotes${book !== "all" ? ` · ${book}` : ""}.`
          : "Waiting on Robinhood tape…"),
      ready: Boolean(quoted),
    },
    {
      title: "Synthesize",
      detail: syn?.global?.action?.note
        || syn?.narrative
        || syn?.global?.narrative
        || "Refresh builds edge/Kelly + agree/disagree decision cards (not news wallpaper).",
      ready: synReady,
    },
    {
      title: "Pick a play",
      detail: top
        ? `Lead: ${top.symbol} ${top.side} · ${top.strategy} · score ${top.score}`
          + (top.synthesis?.verdict ? ` · Elite ${top.synthesis.verdict}` : "")
          + (top.inBook ? " · already open" : "")
          + "."
        : "No ranked play yet — hit Refresh after quotes land.",
      ready: Boolean(top),
    },
    {
      title: "Preview or Approve live",
      detail: et?.isRth
        ? "RTH open — Preview = dry-run, Approve live places on Agentic now."
        : "Off-hours OK — Approve live arms now and places at the next Mon–Fri 9:30 ET open (think Sunday, fill Monday).",
      ready: Boolean(top) && !top?.inBook,
    },
    {
      title: "Watch positions",
      detail: held.length
        ? `Live RH holds: ${held.join(", ")} — pinned at the top of this page.`
        : bookSymbols.length
          ? `No RH holdings in ${book === "all" ? "industry books" : book} — Live positions rail is above Start of day.`
          : "Live positions rail is above Start of day.",
      ready: true,
    },
  ];
}

function bookMeta(id: string | null) {
  if (!id || id === "all") {
    return {
      id: "all",
      name: "All books",
      tickers: INDUSTRIES.flatMap((i) => i.tickers).slice(0, 8),
      tagline: "Fluid ranking across every live industry sleeve.",
    };
  }
  const ind = INDUSTRIES.find((i) => i.id === id);
  return {
    id,
    name: ind?.name || id,
    tickers: ind?.tickers || [],
    tagline: ind?.tagline || "",
  };
}

function bookFromSearch(sp: URLSearchParams | { get(name: string): string | null }) {
  const raw = sp.get("book");
  if (!raw) return "all";
  const id = String(raw).toLowerCase();
  if (id === "all") return "all";
  if (DESK_BOOKS.some((b) => b.id === id)) return id;
  return "all";
}

export default function DeskBoard() {
  const searchParams = useSearchParams();
  // Local book state = instant tab highlight. URL sync must not remount / block clicks.
  const [book, setBookState] = useState(() => bookFromSearch(searchParams));
  const meta = bookMeta(book === "all" ? "all" : book);

  const [desk, setDesk] = useState<DeskDayState | null>(null);
  const [tape, setTape] = useState<IndustryTape | null>(null);
  const [rh, setRh] = useState<RhStatus | null>(null);
  const [livePositions, setLivePositions] = useState<RhLivePosition[]>([]);
  const [positionsLoading, setPositionsLoading] = useState(true);
  const [positionsRefreshing, setPositionsRefreshing] = useState(false);
  const [positionsError, setPositionsError] = useState<string | null>(null);
  const [positionsTickAt, setPositionsTickAt] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [arming, setArming] = useState<string | null>(null);
  const [notional, setNotional] = useState(25);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [deskUpdatedAt, setDeskUpdatedAt] = useState<string | null>(null);
  const [playRefreshToken, setPlayRefreshToken] = useState(0);

  // Keep local book in sync if the user hits back/forward or deep-links.
  useEffect(() => {
    const fromUrl = bookFromSearch(searchParams);
    setBookState((prev) => (prev === fromUrl ? prev : fromUrl));
  }, [searchParams]);

  useEffect(() => {
    function onPop() {
      setBookState(bookFromSearch(new URLSearchParams(window.location.search)));
    }
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  const loadPositions = useCallback(async (opts?: { quiet?: boolean }) => {
    if (!opts?.quiet) setPositionsLoading(true);
    setPositionsRefreshing(true);
    try {
      const data = await fetchLivePositions();
      if (!data.ok) {
        setPositionsError(data.error || "Could not load positions");
        setLivePositions([]);
        return data;
      }
      setLivePositions(data.positions);
      setPositionsError(null);
      setPositionsTickAt(Date.now());
      return data;
    } catch (e) {
      setPositionsError((e as Error).message);
      setLivePositions([]);
      return null;
    } finally {
      setPositionsLoading(false);
      setPositionsRefreshing(false);
    }
  }, []);

  /** Heavy desk snapshot — independent of which book tab is active. */
  const load = useCallback(async () => {
    setLoadError(null);
    const errors: string[] = [];
    const [d, p, s] = await Promise.allSettled([
      fetchDeskDay(),
      fetchOpenBook(),
      fetchRhStatus(),
    ]);
    void loadPositions({ quiet: true });

    let nextDesk: DeskDayState | null = null;
    if (d.status === "fulfilled") {
      nextDesk = d.value;
      setDesk(d.value);
    } else {
      errors.push(`Desk day: ${d.reason?.message || d.reason}`);
    }

    if (p.status === "rejected") {
      errors.push(`Could not load open book — ${p.reason?.message || p.reason}`);
      toast.error("Could not load open book", {
        description: String(p.reason?.message || p.reason),
      });
    } else if (p.status === "fulfilled" && p.value.error) {
      errors.push(`Open book: ${p.value.error}`);
    }

    if (s.status === "fulfilled") setRh(s.value);

    if (errors.length) setLoadError(errors.join(" · "));
    const at = new Date().toISOString();
    setDeskUpdatedAt(at);
    return { desk: nextDesk, at };
  }, [loadPositions]);

  useEffect(() => {
    load();
  }, [load]);

  // Light tape fetch when the book tab changes — do not re-run full desk load.
  useEffect(() => {
    let cancelled = false;
    fetchIndustryTape(book === "all" ? null : book)
      .then((t) => {
        if (!cancelled) setTape(t);
      })
      .catch((err) => {
        if (!cancelled) {
          console.warn("[desk] tape:", err);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [book]);

  useEffect(() => {
    const iv = window.setInterval(
      () => loadPositions({ quiet: true }),
      LIVE_POSITIONS_POLL_MS
    );
    return () => window.clearInterval(iv);
  }, [loadPositions]);

  const rankings = useMemo(() => {
    const rows = desk?.state?.rankings || [];
    if (!book || book === "all") return rows.slice(0, 12);
    return rows.filter((r) => r.industryId === book).slice(0, 12);
  }, [desk, book]);

  const tapeBook = tape?.books?.[0];
  const buyingPower = tape?.buyingPower ?? null;
  const core = tapeBook?.core?.join(", ") || meta.tickers.slice(0, 3).join(", ");
  const tang = tapeBook?.tangential?.join(", ") || meta.tickers.slice(3, 6).join(", ");

  function setBook(next: string) {
    const id = bookFromSearch({ get: () => next });
    // Instant UI — never wait on Next soft-nav / Suspense for searchParams.
    setBookState(id);
    const href = id === "all" ? "/desk?book=all" : `/desk?book=${encodeURIComponent(id)}`;
    startTransition(() => {
      try {
        window.history.pushState(null, "", href);
      } catch {
        /* ignore */
      }
    });
  }

  async function onRefresh() {
    setBusy(true);
    try {
      // Async on Railway — returns when fusion finishes (or times out gracefully).
      const refreshed = await runDeskPass(false);
      setDesk(refreshed);
      const at = new Date().toISOString();
      setDeskUpdatedAt(at);
      setLoadError(null);
      const pos = await loadPositions({ quiet: true });
      setPlayRefreshToken((n) => n + 1);
      const rows = refreshed?.state?.rankings || [];
      const forBook =
        !book || book === "all" ? rows : rows.filter((r) => r.industryId === book);
      const session = refreshed?.et?.isRth ? "RTH open" : "session closed";
      const lead = forBook[0]?.symbol;
      const heldN = pos && "positions" in pos ? pos.positions.length : livePositions.length;
      const stillRunning = refreshed?.refreshing === true;
      toast.success(stillRunning ? "Desk refresh running" : "Desk refreshed", {
        description: [
          stillRunning ? "fusion still working — board will catch up" : null,
          `${forBook.length} ranked play${forBook.length === 1 ? "" : "s"}`,
          lead ? `lead ${lead}` : null,
          `${heldN} RH position${heldN === 1 ? "" : "s"}`,
          session,
          new Date(at).toLocaleTimeString(),
        ]
          .filter(Boolean)
          .join(" · "),
      });
    } catch (e) {
      toast.error("Refresh failed", { description: (e as Error).message });
    } finally {
      setBusy(false);
    }
  }

  async function onArm(rank: DeskRank, live: boolean) {
    if (live && rank.inBook) {
      toast.message("Approve live blocked", {
        description: `${rank.symbol} is already held or has a live plan — manage it in Your Robinhood book / play-by-play.`,
      });
      return;
    }
    if (live) {
      const offHours = desk?.et && !desk.et.isRth;
      const ok = confirm(
        offHours
          ? `Approve LIVE ${rank.side} ${rank.symbol} for ~$${notional}?\n\nSession is closed — this arms now and places at the next Mon–Fri 9:30 ET open (Sunday think → Monday fill).`
          : `Approve LIVE ${rank.side} ${rank.symbol} for ~$${notional}?`
      );
      if (!ok) return;
    }
    setArming(`${rank.id}:${live ? "live" : "dry"}`);
    try {
      const out = await armDeskPlay({ rank, notionalUsd: notional, live });
      if (out.error) throw new Error(String(out.error));
      toast.success(live ? "Live plan armed" : "Preview armed", {
        description: String(out.message || `${rank.symbol} on the worker`),
      });
      await load();
      setPlayRefreshToken((n) => n + 1);
    } catch (e) {
      toast.error(live ? "Approve failed" : "Preview failed", {
        description: (e as Error).message,
      });
    } finally {
      setArming(null);
    }
  }

  const bookSymbols = useMemo(() => {
    if (tapeBook?.names?.length) return tapeBook.names.map((n) => n.symbol);
    return meta.tickers;
  }, [tapeBook, meta.tickers]);

  /** Always show every Agentic holding up top (never hide behind book tabs). */
  const heldPositions = useMemo(() => {
    const fromLive = livePositions;
    const fromDesk = desk?.state?.rhActivity?.positions || [];
    const merged = new Map<string, RhLivePosition>();
    for (const p of fromDesk) {
      merged.set(String(p.symbol).toUpperCase(), {
        symbol: String(p.symbol).toUpperCase(),
        quantity: Number(p.quantity || 0),
        side: p.side || "long",
        avgCost: p.avgCost ?? null,
        marketValue: p.marketValue ?? null,
        lastPrice: p.mark != null && Number.isFinite(Number(p.mark)) ? Number(p.mark) : null,
        dayChangePct:
          p.changePct != null && Number.isFinite(Number(p.changePct))
            ? Number(p.changePct)
            : null,
      });
    }
    for (const p of fromLive) merged.set(p.symbol, p);
    return [...merged.values()].sort(
      (a, b) => Math.abs(b.marketValue || 0) - Math.abs(a.marketValue || 0)
    );
  }, [livePositions, desk]);

  const markBySymbol = useMemo(() => {
    const out: Record<string, number | null | undefined> = {};
    // Rankings are a fallback only — they freeze when the desk idles after close.
    for (const r of desk?.state?.rankings || []) {
      out[r.symbol.toUpperCase()] = r.price;
    }
    for (const p of desk?.state?.rhActivity?.positions || []) {
      if (p.mark != null && Number.isFinite(Number(p.mark))) {
        out[String(p.symbol).toUpperCase()] = Number(p.mark);
      }
    }
    // Live portfolio poll always wins when present.
    for (const p of livePositions) {
      const px =
        p.lastPrice != null && Number.isFinite(p.lastPrice)
          ? p.lastPrice
          : p.marketValue != null && p.quantity
            ? p.marketValue / Math.abs(p.quantity)
            : null;
      if (px != null && Number.isFinite(px) && px > 0) out[p.symbol] = px;
    }
    return out;
  }, [desk, livePositions]);

  const sodSteps = useMemo(
    () =>
      buildSodSteps({
        desk,
        tape,
        book,
        rankings,
        bookSymbols,
      }),
    [desk, tape, book, rankings, bookSymbols]
  );

  return (
    <main className="shell py-8 sm:py-10">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3 text-xs font-semibold uppercase tracking-[0.16em] text-[var(--teal)]">
        <p>Industry Desk → Analyze → Rank → Approve</p>
        <a
          href="https://gsb-swarm-dashboard.vercel.app/execute"
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 font-medium normal-case tracking-normal text-[var(--ink-soft)] hover:text-[var(--teal-deep)]"
        >
          Lab (Swarm dashboard) <ExternalLink className="h-3.5 w-3.5" />
        </a>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-6"
      >
        <h1 className="display text-4xl font-semibold sm:text-5xl">{meta.name}</h1>
        <p className="mt-3 max-w-2xl text-base leading-relaxed text-[var(--ink-soft)]">
          {fmtUsd(buyingPower)} buying power
          {rh?.configured ? " · Robinhood Agentic connected" : " · connect Robinhood to trade"}
          {core ? (
            <>
              {" "}
              — analyzing {core}
              {tang ? ` + ${tang}` : ""} on Robinhood tape.
            </>
          ) : null}
        </p>
        {meta.tagline ? (
          <p className="mt-1 text-sm text-[var(--ink-soft)]">{meta.tagline}</p>
        ) : null}
        {desk?.dayGoal ? (
          <p className="mt-2 text-sm text-[var(--ink-soft)]">
            Day band{" "}
            <span className="mono font-medium text-[var(--ink)]">
              {Math.round((desk.dayGoal.min || 0.01) * 100)}–
              {Math.round((desk.dayGoal.stretch || 0.03) * 100)}%
            </span>
            {desk.dayPnlPctEst != null ? (
              <>
                {" "}
                · book now{" "}
                <span className="mono font-semibold text-[var(--ink)]">
                  {fmtPct(desk.dayPnlPctEst * 100)}
                </span>
              </>
            ) : null}
            {desk.dayPeakPnlPct != null ? (
              <>
                {" "}
                · peak{" "}
                <span className="mono font-semibold text-[var(--ink)]">
                  {fmtPct(desk.dayPeakPnlPct * 100)}
                </span>
              </>
            ) : null}
          </p>
        ) : null}
      </motion.div>

      {desk?.bankMode || desk?.dayGoalHit ? (
        <div className="mb-6 rounded-3xl border border-amber-300 bg-amber-50/90 px-4 py-3 text-sm text-amber-950">
          <p className="font-semibold">BANK MODE — agents stop opening new nickels</p>
          <p className="mt-1 text-amber-950/90">
            Day goal was hit or peaked and rolled. Workers protect/trail existing Agentic holds
            (you cannot sell except through agents). Refresh desk to attach Protect on any naked
            inventory. Options puts are still a separate sleeve — not auto last-hour yet.
          </p>
        </div>
      ) : null}

      {desk?.lastDecision ? (
        <div className="mb-6 rounded-3xl border border-[var(--line)] bg-white/70 px-4 py-3 text-sm text-[var(--ink)]">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--teal)]">
            Fusion decision
            {desk.lastDecision.action ? (
              <span className="mono ml-2 normal-case tracking-normal text-[var(--ink)]">
                {desk.lastDecision.action}
                {desk.lastDecision.symbol ? ` · ${desk.lastDecision.symbol}` : ""}
                {desk.lastDecision.confidence != null
                  ? ` · ${Math.round(desk.lastDecision.confidence * 100)}%`
                  : ""}
              </span>
            ) : null}
          </p>
          <p className="mt-1.5 leading-relaxed text-[var(--ink-soft)]">
            {desk.lastDecision.why || "No why returned."}
          </p>
          {desk.lastDecision.contextBytes != null ? (
            <p className="mt-1 text-xs text-[var(--ink-soft)]">
              Packed {Math.round(desk.lastDecision.contextBytes / 1024)} KB desk state
              {desk.lastDecision.duration_ms != null
                ? ` · decided in ${desk.lastDecision.duration_ms}ms`
                : ""}
              {" · NIM fusion (not uptape script)"}
            </p>
          ) : null}
        </div>
      ) : null}

      {desk?.newsletter?.sections ? (
        <div className="mb-6 rounded-3xl border border-[var(--line)] bg-[#fffaf3] px-4 py-4 text-sm text-[var(--ink)]">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--teal)]">
            Daily desk letter
            {desk.newsletter.dateLabel ? (
              <span className="mono ml-2 normal-case tracking-normal text-[var(--ink-soft)]">
                {desk.newsletter.dateLabel}
              </span>
            ) : null}
            {desk.newsletter.email?.sent ? (
              <span className="mono ml-2 normal-case tracking-normal text-[var(--ink-soft)]">
                · emailed to owner
              </span>
            ) : null}
          </p>
          <p className="mt-1 text-xs text-[var(--ink-soft)]">
            The book in real terms — yesterday into today, tomorrow, and further out.
          </p>
          {(
            [
              ["Yesterday", desk.newsletter.sections.yesterday],
              ["Today", desk.newsletter.sections.today],
              ["Tomorrow", desk.newsletter.sections.tomorrow],
              ["Further out", desk.newsletter.sections.future],
            ] as const
          ).map(([label, body]) =>
            body ? (
              <div key={label} className="mt-3 border-t border-[var(--line)] pt-3 first:mt-2">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--teal-deep)]">
                  {label}
                </p>
                <p className="mt-1 leading-relaxed text-[var(--ink)]">{body}</p>
              </div>
            ) : null
          )}
          {desk.newsletter.sections.closing ? (
            <p className="mt-3 text-xs italic text-[var(--ink-soft)]">
              {desk.newsletter.sections.closing}
            </p>
          ) : null}
        </div>
      ) : null}

      {desk?.hintMemory && (desk.hintMemory.total || 0) > 0 ? (
        <div className="mb-6 rounded-3xl border border-[var(--line)] bg-white/55 px-4 py-3 text-sm text-[var(--ink)]">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--teal)]">
            Hint memory
            <span className="mono ml-2 normal-case tracking-normal text-[var(--ink-soft)]">
              {desk.hintMemory.watching || 0} watching · {desk.hintMemory.confirmed || 0} confirmed ·{" "}
              {desk.hintMemory.strategyReady || 0} strategy-ready
            </span>
          </p>
          <p className="mt-1 text-xs text-[var(--ink-soft)]">
            See a hint, watch it, wait for week/month repeat — then fusion invents the larger-move plan.
          </p>
          <ul className="mt-2 space-y-2">
            {[
              ...(desk.hintMemory.strategyReadyList || []).slice(0, 3),
              ...(desk.hintMemory.confirmedList || []).slice(0, 2),
              ...(desk.hintMemory.watchingList || []).slice(0, 2),
            ]
              .slice(0, 5)
              .map((h) => (
                <li key={h.id || h.label} className="border-t border-[var(--line)] pt-2 first:border-0 first:pt-0">
                  <p className="leading-snug">
                    <span className="mono text-xs uppercase text-[var(--teal-deep)]">
                      {h.status || "watching"}
                      {h.symbol ? ` · ${h.symbol}` : ""}
                      {h.weekHits != null || h.monthHits != null
                        ? ` · w${h.weekHits || 0}/m${h.monthHits || 0}`
                        : ""}
                    </span>
                    <span className="ml-2 text-[var(--ink)]">{h.label}</span>
                  </p>
                  {h.watchFor ? (
                    <p className="mt-0.5 text-xs text-[var(--ink-soft)]">Watch for: {h.watchFor}</p>
                  ) : null}
                  {h.status === "strategy_ready" && h.largerMove ? (
                    <p className="mt-0.5 text-xs text-[var(--ink-soft)]">Larger move: {h.largerMove}</p>
                  ) : null}
                </li>
              ))}
          </ul>
        </div>
      ) : null}

      <div className="relative z-20 mb-8 flex flex-wrap items-center gap-2">
        {DESK_BOOKS.map((b) => {
          const active = book === b.id;
          const href = b.id === "all" ? "/desk?book=all" : `/desk?book=${encodeURIComponent(b.id)}`;
          return (
            <Link
              key={b.id}
              href={href}
              scroll={false}
              prefetch={false}
              onClick={(e) => {
                // Instant local switch — avoid Next soft-nav remounting Suspense on ?book=
                e.preventDefault();
                setBook(b.id);
              }}
              className={clsx(
                "rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors",
                active
                  ? "bg-[var(--teal-deep)] text-[#f0fdfa]"
                  : "border border-[var(--line)] bg-white/60 text-[var(--ink-soft)] hover:text-[var(--teal-deep)]"
              )}
              aria-current={active ? "page" : undefined}
            >
              {b.label}
            </Link>
          );
        })}
        <button
          type="button"
          disabled={busy || Boolean(arming)}
          onClick={onRefresh}
          className="inline-flex items-center gap-1.5 rounded-full border border-[var(--line)] bg-white/60 px-3.5 py-1.5 text-sm font-medium text-[var(--ink-soft)] hover:text-[var(--teal-deep)] disabled:opacity-50"
        >
          <RefreshCw className={clsx("h-3.5 w-3.5", busy && "animate-spin")} />
          {busy ? "Refreshing…" : "Refresh desk"}
        </button>
        <Link
          href="/connect"
          className="rounded-full bg-[var(--teal)] px-3.5 py-1.5 text-sm font-semibold text-white"
        >
          Robinhood
        </Link>
        {deskUpdatedAt ? (
          <span className="text-xs text-[var(--ink-soft)]">
            Updated {new Date(deskUpdatedAt).toLocaleTimeString()}
          </span>
        ) : null}
      </div>

      <LivePositionsRail
        positions={heldPositions}
        markBySymbol={markBySymbol}
        loading={positionsLoading || positionsRefreshing}
        error={positionsError}
        lastTickAt={positionsTickAt}
        disabled={busy}
        onRefresh={async () => {
          const data = await loadPositions();
          if (data && "ok" in data && data.ok) {
            toast.success("Positions updated", {
              description: `${data.positions.length} holding${data.positions.length === 1 ? "" : "s"} · ${new Date().toLocaleTimeString()}`,
            });
          } else {
            toast.error("Positions refresh failed", {
              description:
                (data && "error" in data && data.error) || positionsError || "Unknown",
            });
          }
        }}
        onProtect={async (input) => {
          if (input.live) {
            const ok = confirm(
              `Protect LIVE ${input.symbol}?\n\nNo new buy. Worker sells on ~1.5% hard stop, trail, or EOD.\nNeeds ROBINHOOD_LIVE_TRADING for real exits.`
            );
            if (!ok) return;
          }
          try {
            const out = (await protectHeldPosition(input)) as {
              error?: string;
              message?: string;
              levels?: { stop?: number };
              plan?: { levels?: { stop?: number } };
            };
            if (out.error) throw new Error(String(out.error));
            const stop = out.levels?.stop ?? out.plan?.levels?.stop;
            toast.success(input.live ? "Protect live armed" : "Protect preview armed", {
              description: [
                out.message || input.symbol,
                stop != null ? `stop $${stop}` : null,
                "see play-by-play",
              ]
                .filter(Boolean)
                .join(" · "),
            });
            setPlayRefreshToken((n) => n + 1);
          } catch (e) {
            toast.error("Protect failed", { description: (e as Error).message });
          }
        }}
      />

      <section className="glass mb-8 rounded-3xl p-5 sm:p-6">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--teal)]">
          Start of day
        </p>
        <ol className="mt-4 grid gap-4 sm:grid-cols-5">
          {sodSteps.map((step, i) => (
            <li key={step.title} className="min-w-0">
              <div className="flex items-start gap-2">
                <span
                  className={clsx(
                    "mono flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold",
                    step.ready
                      ? "bg-[var(--teal-deep)] text-[#f0fdfa]"
                      : "bg-[var(--line)] text-[var(--ink-soft)]"
                  )}
                >
                  {i + 1}
                </span>
                <div className="min-w-0 pt-0.5">
                  <p className="text-sm font-semibold text-[var(--ink)]">{step.title}</p>
                  <p className="mt-1 text-xs leading-relaxed text-[var(--ink-soft)]">{step.detail}</p>
                </div>
              </div>
            </li>
          ))}
        </ol>
        {desk?.state?.morningPlan?.headline ? (
          <p className="mt-4 text-sm font-medium text-[var(--ink)]">
            {desk.state.morningPlan.headline}
          </p>
        ) : null}
        {(desk?.state?.synthesis || desk?.state?.morningPlan?.synthesis) ? (
          <div className="mt-4 rounded-2xl border border-[var(--line)] bg-white/50 px-3 py-3">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--teal)]">
              Fiduciary synthesis
            </p>
            <p className="mt-1.5 text-sm leading-relaxed text-[var(--ink)]">
              {(desk.state.synthesis || desk.state.morningPlan?.synthesis)?.global?.action?.note
                || (desk.state.synthesis || desk.state.morningPlan?.synthesis)?.global?.narrative
                || (desk.state.synthesis || desk.state.morningPlan?.synthesis)?.narrative}
            </p>
            <p className="mt-1 text-xs text-[var(--ink-soft)]">
              {[
                (desk.state.synthesis || desk.state.morningPlan?.synthesis)?.approveCount != null
                  ? `${(desk.state.synthesis || desk.state.morningPlan?.synthesis)?.approveCount} approve`
                  : null,
                (desk.state.synthesis || desk.state.morningPlan?.synthesis)?.previewCount != null
                  ? `${(desk.state.synthesis || desk.state.morningPlan?.synthesis)?.previewCount} preview`
                  : null,
                (desk.state.synthesis || desk.state.morningPlan?.synthesis)?.conflictCount != null
                  ? `${(desk.state.synthesis || desk.state.morningPlan?.synthesis)?.conflictCount} conflict`
                  : null,
                (desk.state.synthesis || desk.state.morningPlan?.synthesis)?.microCount != null
                  ? `${(desk.state.synthesis || desk.state.morningPlan?.synthesis)?.microCount} reliable micro`
                  : null,
                (desk.state.synthesis || desk.state.morningPlan?.synthesis)?.top?.join(" · "),
              ]
                .filter(Boolean)
                .join(" · ")}
            </p>
          </div>
        ) : null}
        {!desk?.et?.isRth ? (
          <p className="mt-2 rounded-2xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-950">
            Session closed — you can still <span className="font-semibold">Approve live</span> when you have time
            (Sunday night included). The worker holds the plan and places at the next regular open (Mon–Fri 9:30 ET),
            instead of firing a weekend GFD that dies queued.
          </p>
        ) : null}
      </section>

      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--teal)]">
            Ranked plays
          </p>
          <p className="mt-1 text-sm text-[var(--ink-soft)]">
            Next moves only — live fills stay in Live positions at the top. Preview always works;
            Approve live needs confirm + <span className="mono">ROBINHOOD_LIVE_TRADING</span>
            {desk?.et?.isRth ? "." : " · off-hours waits for next open."}
          </p>
        </div>
        <label className="flex items-center gap-2 text-sm text-[var(--ink-soft)]">
          Notional
          <input
            className="field w-24 py-2"
            type="number"
            min={5}
            step={5}
            value={notional}
            onChange={(e) => setNotional(Number(e.target.value) || 25)}
          />
        </label>
      </div>

      <div className="mb-10 grid gap-3">
        {rankings.length === 0 ? (
          <div className="glass rounded-3xl p-5 text-sm text-[var(--ink-soft)]">
            No rankings for this book in the last desk pass. Hit <span className="font-semibold">Refresh desk</span>
            {" "}— we now keep per-book ranks (not only the global top 16).
          </div>
        ) : (
          rankings.map((r, i) => (
            <motion.article
              key={r.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.03 }}
              className="glass rounded-3xl p-4 sm:p-5"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="display text-2xl font-semibold">{r.symbol}</h2>
                    <span className="rounded-full border border-[var(--line)] px-2 py-0.5 text-xs uppercase">
                      {r.side}
                    </span>
                    <span className="rounded-full border border-[var(--line)] px-2 py-0.5 text-xs">
                      {r.strategy}
                    </span>
                    <span className="rounded-full border border-[var(--line)] px-2 py-0.5 text-xs">
                      {r.horizon}
                    </span>
                    {r.inBook ? (
                      <span className="rounded-full bg-[var(--teal-deep)] px-2 py-0.5 text-xs text-white">
                        Already open
                      </span>
                    ) : null}
                    {r.dryPreview ? (
                      <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-900">
                        Dry preview
                      </span>
                    ) : null}
                    {r.synthesis?.recommend ? (
                      <span
                        className={clsx(
                          "rounded-full px-2 py-0.5 text-xs font-semibold",
                          r.synthesis.recommend === "APPROVE" && "bg-emerald-100 text-emerald-900",
                          r.synthesis.recommend === "PREVIEW" && "bg-sky-100 text-sky-900",
                          r.synthesis.recommend === "CONFLICT" && "bg-amber-100 text-amber-950",
                          r.synthesis.recommend === "PASS" && "bg-rose-100 text-rose-900",
                          r.synthesis.recommend === "WATCH" && "bg-slate-100 text-slate-800"
                        )}
                      >
                        {r.synthesis.recommend}
                      </span>
                    ) : null}
                    {r.synthesis?.verdict ? (
                      <span className="rounded-full border border-[var(--line)] px-2 py-0.5 text-xs">
                        Micro {r.synthesis.verdict}
                        {r.synthesis.conviction != null ? ` · ${r.synthesis.conviction}` : ""}
                      </span>
                    ) : r.synthesis?.quality && !r.synthesis.quality.reliable ? (
                      <span className="rounded-full border border-[var(--line)] px-2 py-0.5 text-xs text-[var(--ink-soft)]">
                        Thin micro
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-1 text-sm text-[var(--ink-soft)]">
                    {r.industryLabel} · score {r.score}
                    {r.price != null ? ` · ${fmtUsd(r.price)}` : ""}
                    {r.changePct != null ? ` · ${fmtPct(r.changePct)}` : ""}
                    {r.synthesis?.vsBook?.note ? ` · ${r.synthesis.vsBook.note}` : ""}
                  </p>
                  {r.synthesis?.edge ? (
                    <p className="mt-2 mono text-xs text-[var(--ink)]">
                      {r.synthesis.edge.hasEdge ? "Edge" : "No edge"}
                      {` · p=${r.synthesis.edge.p} b=${r.synthesis.edge.b} E=${r.synthesis.edge.expectancy}`}
                      {r.synthesis.size
                        ? r.synthesis.size.blocked
                          ? ` · size ${r.synthesis.size.blocked}`
                          : ` · ~$${r.synthesis.size.notional_usd} ¼Kelly`
                        : ""}
                    </p>
                  ) : null}
                  {r.synthesis?.thesis ? (
                    <p className="mt-2 text-xs leading-relaxed text-[var(--ink)]">{r.synthesis.thesis}</p>
                  ) : null}
                  {r.synthesis?.stanceLabel ? (
                    <p
                      className={clsx(
                        "mt-1 text-xs font-medium",
                        r.synthesis.stance === "disagree" || r.synthesis.recommend === "CONFLICT"
                          ? "text-amber-800"
                          : "text-[var(--teal-deep)]"
                      )}
                    >
                      {r.synthesis.stanceLabel}
                    </p>
                  ) : null}
                  {r.synthesis?.invalidate?.length ? (
                    <p className="mt-1 text-xs text-[var(--ink-soft)]">
                      Kill if: {r.synthesis.invalidate.join(" · ")}
                    </p>
                  ) : null}
                  {r.synthesis?.alt?.available ? (
                    <p className="mt-2 text-xs leading-relaxed text-[var(--ink)]">
                      Alt (public):{" "}
                      {[
                        r.synthesis.alt.ats?.available
                          ? `ATS ${r.synthesis.alt.ats.signal}${r.synthesis.alt.ats.vs4wAvg != null ? ` ${r.synthesis.alt.ats.vs4wAvg}×` : ""}`
                          : null,
                        r.synthesis.alt.regsho?.available
                          ? `RegSHO ${r.synthesis.alt.regsho.signal}${r.synthesis.alt.regsho.shortRatio != null ? ` ${(r.synthesis.alt.regsho.shortRatio * 100).toFixed(0)}%` : ""}`
                          : null,
                        r.synthesis.alt.insider?.available
                          ? `Form4 ${r.synthesis.alt.insider.signal} (${r.synthesis.alt.insider.count45d})`
                          : null,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                  ) : null}
                  {r.reasons?.length ? (
                    <p className="mt-2 text-xs text-[var(--ink-soft)]">{r.reasons.join(" · ")}</p>
                  ) : null}
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={Boolean(arming)}
                    onClick={() => onArm(r, false)}
                    className="btn btn-ghost px-4 py-2 text-sm"
                  >
                    {arming === `${r.id}:dry` ? "Previewing…" : "Preview"}
                  </button>
                  <button
                    type="button"
                    disabled={Boolean(arming)}
                    onClick={() => onArm(r, true)}
                    className={clsx(
                      "btn px-4 py-2 text-sm",
                      r.inBook ? "btn-ghost opacity-80" : "btn-primary"
                    )}
                    title={
                      r.inBook
                        ? "Already held / live plan — tap for why Approve is blocked"
                        : "Arm live plan on Agentic"
                    }
                  >
                    {arming === `${r.id}:live`
                      ? "Approving…"
                      : r.inBook
                        ? "Already held"
                        : "Approve live"}
                  </button>
                </div>
              </div>
            </motion.article>
          ))
        )}
      </div>

      {loadError ? (
        <p className="mb-4 text-sm text-[var(--danger)]">{loadError}</p>
      ) : null}

      <PlayByPlayRail
        bookFilter={book}
        symbols={bookSymbols}
        refreshToken={playRefreshToken}
      />
    </main>
  );
}
