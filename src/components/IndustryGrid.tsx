"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowUpRight, Lock } from "lucide-react";
import { INDUSTRIES } from "@/lib/industries";

export default function IndustryGrid() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {INDUSTRIES.map((ind, i) => {
        const live = ind.status === "live";
        const inner = (
          <motion.article
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.08 * i, duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
            className="glass group relative h-full overflow-hidden rounded-3xl p-5 transition-transform duration-300 hover:-translate-y-1"
          >
            <div
              className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
              style={{
                background:
                  "radial-gradient(500px 180px at 20% 0%, rgba(20,184,166,0.16), transparent 70%)",
              }}
            />
            <div className="relative flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--teal)]">
                  {live ? "Live" : "Preview"}
                </p>
                <h2 className="display mt-2 text-2xl font-semibold text-[var(--ink)]">
                  {ind.name}
                </h2>
              </div>
              {live ? (
                <ArrowUpRight className="h-5 w-5 text-[var(--teal)]" />
              ) : (
                <Lock className="h-4 w-4 text-[var(--ink-soft)]" />
              )}
            </div>
            <p className="relative mt-3 text-[0.98rem] leading-relaxed text-[var(--ink-soft)]">
              {ind.tagline}
            </p>
            <p className="relative mt-4 text-sm text-[var(--ink)]">{ind.focus}</p>
            <div className="relative mt-5 flex flex-wrap gap-1.5">
              {ind.tickers.slice(0, 4).map((t) => (
                <span
                  key={t}
                  className="mono rounded-full border border-[var(--line)] bg-white/70 px-2.5 py-1 text-xs text-[var(--teal-deep)]"
                >
                  {t}
                </span>
              ))}
            </div>
          </motion.article>
        );

        if (live && ind.href) {
          return (
            <Link key={ind.id} href={ind.href} className="block h-full">
              {inner}
            </Link>
          );
        }
        return (
          <div key={ind.id} className="h-full opacity-85" aria-disabled="true">
            {inner}
          </div>
        );
      })}
    </div>
  );
}
