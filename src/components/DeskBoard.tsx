"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
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
  runDeskPass,
  type DeskDayState,
  type DeskRank,
  type IndustryTape,
} from "@/lib/desk";
import { fetchRhStatus, type RhStatus } from "@/lib/robinhood";
import PlayByPlayRail from "@/components/PlayByPlayRail";

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
      title: "Watch Open book",
      detail: held.length
        ? `Robinhood holds in books: ${held.join(", ")}. Play-by-play tracks marks below.`
        : bookSymbols.length
          ? `No Robinhood holdings in ${book === "all" ? "industry books" : book} right now — submitted ≠ filled.`
          : "Open book loads below.",
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

export default function DeskBoard() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const book = searchParams.get("book") || "restaurants";
  const meta = bookMeta(book === "all" ? "all" : book);

  const [desk, setDesk] = useState<DeskDayState | null>(null);
  const [tape, setTape] = useState<IndustryTape | null>(null);
  const [rh, setRh] = useState<RhStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const [arming, setArming] = useState<string | null>(null);
  const [notional, setNotional] = useState(25);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [deskUpdatedAt, setDeskUpdatedAt] = useState<string | null>(null);
  const [playRefreshToken, setPlayRefreshToken] = useState(0);

  const load = useCallback(async () => {
    setLoadError(null);
    const errors: string[] = [];
    const [d, t, p, s] = await Promise.allSettled([
      fetchDeskDay(),
      fetchIndustryTape(book === "all" ? null : book),
      fetchOpenBook(),
      fetchRhStatus(),
    ]);

    let nextDesk: DeskDayState | null = null;
    if (d.status === "fulfilled") {
      nextDesk = d.value;
      setDesk(d.value);
    } else {
      errors.push(`Desk day: ${d.reason?.message || d.reason}`);
    }

    if (t.status === "fulfilled") setTape(t.value);
    else errors.push(`Tape: ${t.reason?.message || t.reason}`);

    if (p.status === "rejected") {
      errors.push(`Could not load open book — ${p.reason?.message || p.reason}`);
      toast.error("Could not load open book", {
        description: String(p.reason?.message || p.reason),
      });
    } else if (p.value.error) {
      errors.push(`Open book: ${p.value.error}`);
    }

    if (s.status === "fulfilled") setRh(s.value);

    if (errors.length) setLoadError(errors.join(" · "));
    const at = new Date().toISOString();
    setDeskUpdatedAt(at);
    return { desk: nextDesk, at };
  }, [book]);

  useEffect(() => {
    load();
  }, [load]);

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
    const q = next === "all" ? "/desk?book=all" : `/desk?book=${encodeURIComponent(next)}`;
    router.push(q);
  }

  async function onRefresh() {
    setBusy(true);
    try {
      await runDeskPass(false);
      const { desk: next, at } = await load();
      setPlayRefreshToken((n) => n + 1);
      const rows = next?.state?.rankings || [];
      const forBook =
        !book || book === "all" ? rows : rows.filter((r) => r.industryId === book);
      const session = next?.et?.isRth ? "RTH open" : "session closed";
      const lead = forBook[0]?.symbol;
      toast.success("Desk refreshed", {
        description: [
          `${forBook.length} ranked play${forBook.length === 1 ? "" : "s"}`,
          lead ? `lead ${lead}` : null,
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
      toast.message("Already open", {
        description: "Live plan or Robinhood hold blocks Approve live.",
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
      </motion.div>

      <div className="mb-8 flex flex-wrap items-center gap-2">
        {DESK_BOOKS.map((b) => {
          const active = (book || "all") === b.id;
          return (
            <button
              key={b.id}
              type="button"
              onClick={() => setBook(b.id)}
              className={clsx(
                "rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors",
                active
                  ? "bg-[var(--teal-deep)] text-[#f0fdfa]"
                  : "border border-[var(--line)] bg-white/60 text-[var(--ink-soft)] hover:text-[var(--teal-deep)]"
              )}
            >
              {b.label}
            </button>
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
            Each play is a decision card: edge/Kelly, agree/disagree, thesis + kill criteria — not a news badge.
            Preview = dry-run. Approve live needs{" "}
            <span className="mono">ROBINHOOD_LIVE_TRADING</span>
            {desk?.et?.isRth ? "." : " · off-hours approve waits for next open."}
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
            No rankings yet for this book. Hit Refresh after Robinhood quotes land, or try All.
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
                    disabled={Boolean(arming) || Boolean(r.inBook)}
                    onClick={() => onArm(r, true)}
                    className="btn btn-primary px-4 py-2 text-sm"
                  >
                    {arming === `${r.id}:live` ? "Approving…" : "Approve live"}
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
