import Link from "next/link";
import AiExecutePanel from "@/components/AiExecutePanel";
import RobinhoodPanel from "@/components/RobinhoodPanel";

export default function AiDeskPage() {
  return (
    <main className="shell py-10 sm:py-14">
      <div className="mb-8 max-w-2xl">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--teal)]">
          Industry book
        </p>
        <h1 className="display mt-2 text-4xl font-semibold text-[var(--ink)] sm:text-5xl">
          AI Trade
        </h1>
        <p className="mt-3 text-base leading-relaxed text-[var(--ink-soft)]">
          Your agentic AI sleeve — connect Robinhood once, then review or Execute ideas across the AI complex.
          Other industry books will plug into the same account.
        </p>
        <Link href="/connect" className="mt-4 inline-block text-sm font-semibold text-[var(--teal-deep)] hover:underline">
          Full connect guide →
        </Link>
      </div>

      <div className="grid gap-5 lg:grid-cols-[0.9fr_1.1fr]">
        <RobinhoodPanel />
        <AiExecutePanel />
      </div>
    </main>
  );
}
