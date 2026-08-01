"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import IndustryGrid from "@/components/IndustryGrid";
import { BRAND } from "@/lib/industries";

export default function HomePage() {
  return (
    <main>
      <section className="relative overflow-hidden">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "linear-gradient(115deg, rgba(17,94,89,0.92) 0%, rgba(15,118,110,0.78) 42%, rgba(45,212,191,0.35) 100%)",
          }}
        />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-30"
          style={{
            backgroundImage:
              "radial-gradient(circle at 1px 1px, rgba(255,255,255,0.35) 1px, transparent 0)",
            backgroundSize: "28px 28px",
          }}
        />
        <div className="shell relative py-16 sm:py-24">
          <motion.p
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="display text-4xl font-semibold tracking-tight text-[#ecfeff] sm:text-6xl"
          >
            {BRAND.name}
          </motion.p>
          <motion.h1
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.08 }}
            className="mt-5 max-w-2xl text-2xl font-medium leading-snug text-[#f0fdfa] sm:text-3xl"
          >
            An agent that watches an industry and can trade it on Robinhood.
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.16 }}
            className="mt-4 max-w-xl text-base leading-relaxed text-[#ccfbf1]"
          >
            {BRAND.blurb} Start with the AI Trade book. Five more industry sleeves are on deck.
          </motion.p>
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.24 }}
            className="mt-8 flex flex-wrap gap-3"
          >
            <Link href="/ai" className="btn btn-primary bg-[#042f2e] hover:bg-[#134e4a]">
              Open AI Desk
            </Link>
            <Link
              href="/connect"
              className="btn btn-ghost border-white/30 bg-white/10 text-white hover:border-white/60 hover:text-white"
            >
              Connect Robinhood
            </Link>
          </motion.div>
        </div>
      </section>

      <section className="shell py-12 sm:py-16">
        <div className="mb-6 flex items-end justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--teal)]">
              Industry books
            </p>
            <h2 className="display mt-2 text-3xl font-semibold text-[var(--ink)]">
              Pick a desk
            </h2>
          </div>
          <p className="hidden max-w-sm text-right text-sm text-[var(--ink-soft)] sm:block">
            One Robinhood Agentic account. Six focused books. Cross-hedges come after each pack is live.
          </p>
        </div>
        <IndustryGrid />
      </section>
    </main>
  );
}
