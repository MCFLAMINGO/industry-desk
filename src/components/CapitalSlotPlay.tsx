"use client";

import { useEffect, useState } from "react";
import clsx from "clsx";
import { Crosshair, Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  fetchOpenBook,
  releaseCapitalSlot,
  takeOptionHunt,
  type DeskDayState,
  type DeskPlan,
} from "@/lib/desk";

type Props = {
  desk: DeskDayState | null;
  busy?: boolean;
  onChanged?: () => void | Promise<void>;
};

/**
 * The armed capital-slot sleeve — sits next to Staging so a fired option
 * play is never buried under book-filtered protect plans.
 */
export default function CapitalSlotPlay({ desk, busy, onChanged }: Props) {
  const slot = desk?.capitalSlot?.incumbent;
  const [plan, setPlan] = useState<DeskPlan | null>(null);
  const [loading, setLoading] = useState(false);
  const [firing, setFiring] = useState<"preview" | "live" | null>(null);

  useEffect(() => {
    const id = slot?.planId;
    if (!id) {
      setPlan(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    void (async () => {
      try {
        const res = await fetch(`/api/ceo?action=plans&id=${encodeURIComponent(id)}`, {
          cache: "no-store",
        });
        const data = (await res.json()) as { plan?: DeskPlan; ok?: boolean };
        if (!cancelled) setPlan(data.plan || null);
      } catch {
        if (!cancelled) setPlan(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [slot?.planId, desk?.capitalSlot?.updatedAt as string | undefined]);

  if (!slot?.symbol) {
    return (
      <section className="mb-4 rounded-3xl border border-dashed border-[var(--line)] bg-white/50 px-5 py-4">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--teal)]">
          The play · capital slot
        </p>
        <p className="mt-1 text-sm text-[var(--ink-soft)]">
          Empty — sensors inform, nothing occupies the one risk sleeve yet. Option hunt / fusion
          fills this slot.
        </p>
      </section>
    );
  }

  const right = String(slot.right || slot.contract?.right || "call").toUpperCase();
  const strike = slot.contract?.strike ?? slot.optionMeta?.strike;
  const exp = String(slot.contract?.expiration || slot.optionMeta?.expiration || "").slice(0, 10);
  const live = Boolean(slot.live || (plan?.live && !plan?.dry_run));
  const status = plan?.status || (live ? "armed" : "dry");
  const goneQuiet = status === "completed" || status === "cancelled";

  async function promote(liveFire: boolean) {
    if (liveFire) {
      const ok = window.confirm(
        `Take LIVE ${slot!.symbol} ${right}`
          + (strike != null ? ` $${strike}` : "")
          + " into the capital slot?"
      );
      if (!ok) return;
    }
    setFiring(liveFire ? "live" : "preview");
    try {
      const huntBest = desk?.optionHunt?.best;
      const out = await takeOptionHunt({
        live: liveFire,
        best: huntBest?.symbol === slot!.symbol
          ? huntBest
          : {
              symbol: slot!.symbol,
              right: String(slot!.right || "call"),
              strike: strike ?? null,
              expiration: exp || null,
              tradeable: true,
            },
        why: `Owner promote capital slot ${slot!.symbol} ${right}`,
      });
      if (!out.ok) {
        throw new Error(out.detail || out.reason || out.error || out.message || "Fire failed");
      }
      toast.success(liveFire ? "Slot LIVE" : "Slot preview re-armed", {
        description: out.message || `${out.instrument} ${out.symbol}`,
      });
      // Nudge play-by-play even if parent refresh is slow.
      try {
        await fetchOpenBook();
      } catch {
        /* ignore */
      }
      await onChanged?.();
    } catch (e) {
      toast.error(liveFire ? "Take LIVE failed" : "Preview failed", {
        description: (e as Error).message,
      });
    } finally {
      setFiring(null);
    }
  }

  return (
    <section className="mb-4 overflow-hidden rounded-3xl border-2 border-[var(--teal-deep)] bg-white shadow-[var(--shadow)]">
      <div className="flex flex-wrap items-center justify-between gap-2 bg-[var(--teal-deep)] px-5 py-2.5 text-[#ecfeff]">
        <p className="text-xs font-semibold uppercase tracking-[0.18em]">
          The play · capital slot
        </p>
        <span
          className={clsx(
            "rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide",
            live ? "bg-[var(--ok)] text-white" : "bg-white/20 text-white"
          )}
        >
          {live ? "LIVE" : "DRY / PREVIEW"}
          {goneQuiet ? " · finished tick" : ""}
        </span>
      </div>
      <div className="flex flex-wrap items-start justify-between gap-4 px-5 py-4">
        <div className="min-w-0 flex-1">
          <p className="display text-2xl font-semibold text-[var(--ink)]">
            {slot.symbol} {right}
            {strike != null ? ` $${strike}` : ""}
            {exp ? ` · ${exp}` : ""}
          </p>
          <p className="mt-1 text-sm text-[var(--ink-soft)]">
            {slot.sizeCapUsd != null ? `≤$${Math.round(Number(slot.sizeCapUsd))} cap` : "Sized sleeve"}
            {slot.edgeScore != null ? ` · edge ${Number(slot.edgeScore).toFixed(2)}` : ""}
            {plan?.id ? ` · plan ${plan.id.slice(0, 8)}` : slot.planId ? ` · plan ${String(slot.planId).slice(0, 8)}` : ""}
            {loading ? " · syncing…" : ""}
            {status ? ` · ${status}` : ""}
          </p>
          <p className="mt-2 line-clamp-3 text-sm leading-relaxed text-[var(--ink)]">
            {slot.thesis || slot.exitPlan?.rule || "Capital slot occupied — manage / bank gains, do not spray."}
          </p>
          {goneQuiet ? (
            <p className="mt-2 text-xs font-medium text-amber-800">
              Dry sleeve was stop-closed on a bad premium unit tick earlier — slot still holds this idea.
              Take LIVE (or Preview) to put it back on the play rail.
            </p>
          ) : null}
        </div>
        <div className="flex shrink-0 flex-col gap-2">
          {!live ? (
            <>
              <button
                type="button"
                disabled={Boolean(busy || firing)}
                onClick={() => void promote(false)}
                className="inline-flex items-center justify-center gap-1.5 rounded-full border border-[var(--teal-deep)]/40 bg-white px-3 py-1.5 text-xs font-semibold text-[var(--teal-deep)] disabled:opacity-50"
              >
                {firing === "preview" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Crosshair className="h-3.5 w-3.5" />}
                Preview on rail
              </button>
              <button
                type="button"
                disabled={Boolean(busy || firing)}
                onClick={() => void promote(true)}
                className="inline-flex items-center justify-center gap-1.5 rounded-full bg-[var(--teal-deep)] px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
              >
                {firing === "live" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Crosshair className="h-3.5 w-3.5" />}
                Take LIVE
              </button>
              <button
                type="button"
                disabled={Boolean(busy || firing)}
                onClick={() => {
                  void (async () => {
                    try {
                      const out = await releaseCapitalSlot({
                        symbol: String(slot!.symbol),
                        reason: "owner_clear_ghost",
                      });
                      if (!out.ok) throw new Error(out.error || "Release failed");
                      toast.success(`Cleared ${slot!.symbol} from capital slot`);
                      await onChanged?.();
                    } catch (e) {
                      toast.error("Clear failed", { description: (e as Error).message });
                    }
                  })();
                }}
                className="inline-flex items-center justify-center rounded-full border border-[var(--line)] px-3 py-1.5 text-xs font-medium text-[var(--ink-soft)] disabled:opacity-50"
              >
                Clear ghost
              </button>
            </>
          ) : (
            <p className="max-w-[12rem] text-xs text-[var(--ink-soft)]">
              Live in the slot — play-by-play below manages stop / bank.
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
