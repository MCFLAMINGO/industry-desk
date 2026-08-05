"use client";

import { useMemo, useState } from "react";
import clsx from "clsx";
import { CheckCircle2, Crosshair, Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  fmtUsd,
  takeOptionHunt,
  type DeskDayState,
} from "@/lib/desk";

type HuntBest = NonNullable<NonNullable<DeskDayState["optionHunt"]>["best"]>;

type FireResult = {
  ok: boolean;
  live: boolean;
  symbol: string;
  mode?: string;
  planId?: string;
  message: string;
  at: number;
};

type Props = {
  desk: DeskDayState | null;
  buyingPower?: number | null;
  busy?: boolean;
  compact?: boolean;
  onFired?: () => void | Promise<void>;
};

function slotMatchesHunt(
  desk: DeskDayState | null,
  best: HuntBest | null | undefined
) {
  const inc = desk?.capitalSlot?.incumbent;
  if (!inc?.symbol || !best?.symbol) return null;
  if (String(inc.symbol).toUpperCase() !== String(best.symbol).toUpperCase()) return null;
  const incRight = String(inc.right || inc.contract?.right || "call").toLowerCase();
  const bestRight = String(best.right || "call").toLowerCase();
  if (incRight !== bestRight) return null;
  return inc;
}

/**
 * Shared Option hunt Preview / Take LIVE controls.
 * After a take, button state flips to ARMED so it does not look like nothing happened.
 */
export default function OptionHuntControls({
  desk,
  buyingPower,
  busy,
  compact,
  onFired,
}: Props) {
  const best = desk?.optionHunt?.best;
  const [huntBusy, setHuntBusy] = useState<"preview" | "live" | null>(null);
  const [last, setLast] = useState<FireResult | null>(null);

  const matched = useMemo(() => slotMatchesHunt(desk, best), [desk, best]);
  const armedLive = Boolean(matched?.live);
  const armedDry = Boolean(matched && !matched.live);
  const sameAsLast =
    last
    && best?.symbol
    && String(last.symbol).toUpperCase() === String(best.symbol).toUpperCase();

  if (!best?.symbol || !best.tradeable) return null;

  const debit =
    best.debitUsd != null && Number.isFinite(Number(best.debitUsd))
      ? Math.round(Number(best.debitUsd))
      : null;
  const bp = buyingPower != null ? Number(buyingPower) : null;
  const cantAfford = bp != null && debit != null && bp < debit;

  async function fire(live: boolean) {
    if (live && cantAfford) {
      const msg = `Need ~$${debit} debit · BP ${fmtUsd(bp)}. Deposit or free cash — Take LIVE cannot fill.`;
      toast.error("Not enough buying power for LIVE option", { description: msg });
      setLast({
        ok: false,
        live: true,
        symbol: String(best!.symbol),
        message: msg,
        at: Date.now(),
      });
      return;
    }
    if (live) {
      const ok = window.confirm(
        `Take LIVE ${best!.symbol} ${String(best!.right || "call").toUpperCase()}`
          + (best!.strike != null ? ` $${best!.strike}` : "")
          + (debit != null ? ` · ~$${debit} debit` : "")
          + "?"
      );
      if (!ok) return;
    }
    setHuntBusy(live ? "live" : "preview");
    try {
      const out = await takeOptionHunt({ live, best });
      if (!out.ok) {
        throw new Error(out.detail || out.reason || out.error || out.message || "Hunt fire failed");
      }
      const message =
        out.message
        || `${out.instrument || best!.right} ${out.symbol || best!.symbol}`
          + (out.notional != null ? ` · $${out.notional}` : "")
          + (out.planId ? ` · plan ${String(out.planId).slice(0, 8)}` : "");
      setLast({
        ok: true,
        live,
        symbol: String(out.symbol || best!.symbol),
        mode: out.mode,
        planId: out.planId,
        message,
        at: Date.now(),
      });
      if (out.openBlocked) {
        toast.message(live ? "LIVE armed — cannot fill yet" : "Preview armed — open blocked", {
          description: message,
        });
      } else {
        toast.success(live ? "Take LIVE received — in capital slot" : "Preview armed", {
          description: message,
        });
      }
      await onFired?.();
    } catch (e) {
      const message = (e as Error).message || "Take failed";
      setLast({
        ok: false,
        live,
        symbol: String(best!.symbol),
        message,
        at: Date.now(),
      });
      toast.error(live ? "Take LIVE failed" : "Preview failed", { description: message });
    } finally {
      setHuntBusy(null);
    }
  }

  const showArmed = armedLive || armedDry || (sameAsLast && last?.ok);
  const liveArmed = armedLive || (sameAsLast && last?.ok && last.live);

  return (
    <div className={clsx("mt-2", compact ? "" : "")}>
      <div className="flex flex-wrap gap-2">
        {showArmed ? (
          <span
            className={clsx(
              "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold text-white",
              liveArmed ? "bg-[var(--ok)]" : "bg-stone-600"
            )}
          >
            <CheckCircle2 className="h-3.5 w-3.5" />
            {liveArmed
              ? `ARMED LIVE · ${best.symbol}`
              : `ARMED DRY · ${best.symbol}`}
            {matched?.planId ? ` · ${String(matched.planId).slice(0, 8)}` : ""}
          </span>
        ) : null}

        {!liveArmed ? (
          <>
            <button
              type="button"
              disabled={Boolean(busy || huntBusy || desk?.refreshing || armedDry)}
              onClick={() => void fire(false)}
              className={clsx(
                "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold disabled:opacity-50",
                compact
                  ? "border-[var(--teal-deep)]/40 bg-white text-[var(--teal-deep)]"
                  : "border-[var(--teal-deep)]/40 bg-white text-[var(--teal-deep)]"
              )}
            >
              {huntBusy === "preview" ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Crosshair className="h-3.5 w-3.5" />
              )}
              {huntBusy === "preview" ? "Arming…" : armedDry ? "Dry in slot" : "Preview"}
            </button>
            <button
              type="button"
              disabled={Boolean(busy || huntBusy || desk?.refreshing)}
              onClick={() => void fire(true)}
              className={clsx(
                "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50",
                cantAfford ? "bg-amber-700" : "bg-[var(--teal-deep)]"
              )}
            >
              {huntBusy === "live" ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Crosshair className="h-3.5 w-3.5" />
              )}
              {huntBusy === "live"
                ? "Firing…"
                : cantAfford
                  ? `Need ~$${debit} BP`
                  : "Take LIVE"}
            </button>
          </>
        ) : (
          <button
            type="button"
            disabled
            className="inline-flex items-center gap-1.5 rounded-full bg-[var(--ok)]/90 px-3 py-1.5 text-xs font-semibold text-white opacity-90"
          >
            <CheckCircle2 className="h-3.5 w-3.5" />
            Taken — in capital slot
          </button>
        )}
      </div>

      {(last || cantAfford || (liveArmed && cantAfford)) && (
        <p
          className={clsx(
            "mt-2 text-xs leading-relaxed",
            last && !last.ok
              ? "font-medium text-[var(--danger)]"
              : liveArmed && cantAfford
                ? "font-medium text-amber-800"
                : "text-[var(--ink-soft)]"
          )}
        >
          {last && !last.ok
            ? last.message
            : liveArmed && cantAfford
              ? `LIVE plan is in the slot, but open cannot fill — BP ${fmtUsd(bp)} vs ~$${debit} debit (NO_AFFORDABLE_OPTION). Add cash.`
              : last?.ok
                ? `${last.live ? "LIVE" : "Preview"} accepted: ${last.message}`
                : cantAfford
                  ? `Buying power ${fmtUsd(bp)} is below ~$${debit} debit — Take LIVE will not fill until you add cash.`
                  : null}
        </p>
      )}
    </div>
  );
}
