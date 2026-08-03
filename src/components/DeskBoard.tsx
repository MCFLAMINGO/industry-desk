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
  type DeskPlan,
  type DeskRank,
  type IndustryTape,
} from "@/lib/desk";
import { fetchRhStatus, type RhStatus } from "@/lib/robinhood";

const STEPS = [
  "Analyze tape",
  "Pick a play",
  "Preview or Approve live",
  "Watch Open book",
  "Results",
] as const;

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
  const [plans, setPlans] = useState<DeskPlan[]>([]);
  const [rh, setRh] = useState<RhStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const [arming, setArming] = useState<string | null>(null);
  const [notional, setNotional] = useState(25);
  const [loadError, setLoadError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoadError(null);
    const errors: string[] = [];
    const [d, t, p, s] = await Promise.allSettled([
      fetchDeskDay(),
      fetchIndustryTape(book === "all" ? null : book),
      fetchOpenBook(),
      fetchRhStatus(),
    ]);

    if (d.status === "fulfilled") setDesk(d.value);
    else errors.push(`Desk day: ${d.reason?.message || d.reason}`);

    if (t.status === "fulfilled") setTape(t.value);
    else errors.push(`Tape: ${t.reason?.message || t.reason}`);

    if (p.status === "fulfilled") {
      setPlans(p.value.plans || []);
      if (p.value.error) errors.push(`Open book: ${p.value.error}`);
    } else {
      errors.push(`Could not load open book — ${p.reason?.message || p.reason}`);
      toast.error("Could not load open book", {
        description: String(p.reason?.message || p.reason),
      });
    }

    if (s.status === "fulfilled") setRh(s.value);

    if (errors.length) setLoadError(errors.join(" · "));
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
      await load();
      toast.success("Desk refreshed");
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
    if (live && !confirm(`Approve LIVE ${rank.side} ${rank.symbol} for ~$${notional}?`)) {
      return;
    }
    setArming(`${rank.id}:${live ? "live" : "dry"}`);
    try {
      const out = await armDeskPlay({ rank, notionalUsd: notional, live });
      if (out.error) throw new Error(String(out.error));
      toast.success(live ? "Live plan armed" : "Preview armed", {
        description: String(out.message || `${rank.symbol} on the worker`),
      });
      await load();
    } catch (e) {
      toast.error(live ? "Approve failed" : "Preview failed", {
        description: (e as Error).message,
      });
    } finally {
      setArming(null);
    }
  }

  const openForBook = useMemo(() => {
    if (!book || book === "all") return plans;
    const syms = new Set(
      (tapeBook?.names || []).map((n) => n.symbol.toUpperCase()).concat(
        meta.tickers.map((t) => t.toUpperCase())
      )
    );
    return plans.filter((p) => syms.has(String(p.symbol || "").toUpperCase()));
  }, [plans, book, tapeBook, meta.tickers]);

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
          disabled={busy}
          onClick={onRefresh}
          className="inline-flex items-center gap-1.5 rounded-full border border-[var(--line)] bg-white/60 px-3.5 py-1.5 text-sm font-medium text-[var(--ink-soft)] hover:text-[var(--teal-deep)] disabled:opacity-50"
        >
          <RefreshCw className={clsx("h-3.5 w-3.5", busy && "animate-spin")} />
          Refresh
        </button>
        <Link
          href="/connect"
          className="rounded-full bg-[var(--teal)] px-3.5 py-1.5 text-sm font-semibold text-white"
        >
          Robinhood
        </Link>
      </div>

      <section className="glass mb-8 rounded-3xl p-5 sm:p-6">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--teal)]">
          Start of day
        </p>
        <ol className="mt-4 grid gap-3 sm:grid-cols-5">
          {STEPS.map((label, i) => (
            <li key={label} className="flex items-start gap-2 text-sm">
              <span className="mono flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[var(--teal-deep)] text-xs font-semibold text-[#f0fdfa]">
                {i + 1}
              </span>
              <span className="pt-0.5 text-[var(--ink)]">{label}</span>
            </li>
          ))}
        </ol>
        {desk?.state?.note ? (
          <p className="mt-4 text-sm text-[var(--ink-soft)]">{desk.state.note}</p>
        ) : null}
        {desk?.state?.morningPlan?.headline ? (
          <p className="mt-2 text-sm font-medium text-[var(--ink)]">
            {desk.state.morningPlan.headline}
          </p>
        ) : null}
      </section>

      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--teal)]">
            Ranked plays
          </p>
          <p className="mt-1 text-sm text-[var(--ink-soft)]">
            Preview arms dry-run. Approve live needs confirm +{" "}
            <span className="mono">ROBINHOOD_LIVE_TRADING</span>.
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
                  </div>
                  <p className="mt-1 text-sm text-[var(--ink-soft)]">
                    {r.industryLabel} · score {r.score}
                    {r.price != null ? ` · ${fmtUsd(r.price)}` : ""}
                    {r.changePct != null ? ` · ${fmtPct(r.changePct)}` : ""}
                  </p>
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

      <section className="mb-8">
        <div className="mb-3 flex items-end justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--teal)]">
              Open book
            </p>
            <p className="mt-1 text-sm text-[var(--ink-soft)]">
              Live and dry-run plans on the Agentic worker.
            </p>
          </div>
          <button
            type="button"
            onClick={load}
            className="text-sm font-medium text-[var(--teal-deep)] hover:underline"
          >
            Reload
          </button>
        </div>
        {loadError ? (
          <p className="mb-3 text-sm text-[var(--danger)]">{loadError}</p>
        ) : null}
        <div className="grid gap-3">
          {openForBook.length === 0 ? (
            <div className="glass rounded-3xl p-5 text-sm text-[var(--ink-soft)]">
              No open plans for this book.
            </div>
          ) : (
            openForBook.map((p) => (
              <article key={p.id} className="glass rounded-3xl p-4 sm:p-5">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="display text-xl font-semibold">{p.symbol || "—"}</h3>
                  <span className="rounded-full border border-[var(--line)] px-2 py-0.5 text-xs uppercase">
                    {p.side || "—"}
                  </span>
                  <span
                    className={clsx(
                      "rounded-full px-2 py-0.5 text-xs",
                      p.live ? "bg-[var(--teal-deep)] text-white" : "bg-amber-100 text-amber-900"
                    )}
                  >
                    {p.live ? "Live" : "Dry-run"}
                  </span>
                  <span className="text-xs text-[var(--ink-soft)]">{p.status}</span>
                </div>
                <p className="mt-2 text-sm text-[var(--ink-soft)]">
                  {p.kind || "plan"}
                  {p.filled_notional != null ? ` · filled ${fmtUsd(p.filled_notional)}` : ""}
                  {p.updated_at ? ` · updated ${new Date(p.updated_at).toLocaleString()}` : ""}
                </p>
              </article>
            ))
          )}
        </div>
      </section>
    </main>
  );
}
