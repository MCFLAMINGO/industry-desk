import Link from "next/link";
import RobinhoodPanel from "@/components/RobinhoodPanel";

export default function ConnectPage() {
  return (
    <main className="shell py-10 sm:py-14">
      <div className="mb-8 max-w-2xl">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--teal)]">
          Account
        </p>
        <h1 className="display mt-2 text-4xl font-semibold sm:text-5xl">
          Connect Robinhood
        </h1>
        <p className="mt-3 text-base leading-relaxed text-[var(--ink-soft)]">
          Industry Desk uses Robinhood&apos;s Agentic Trading MCP. One connection powers every industry book.
          Coinbase comes next as a second rail.
        </p>
      </div>

      <div className="grid gap-5 lg:grid-cols-[1.1fr_0.9fr]">
        <RobinhoodPanel />
        <aside className="glass space-y-4 rounded-3xl p-5">
          <h2 className="display text-xl font-semibold">Quick path</h2>
          <ol className="list-decimal space-y-2 pl-5 text-sm leading-relaxed text-[var(--ink-soft)]">
            <li>Robinhood primary account in good standing + Agentic access</li>
            <li>Click Connect and allow GSB / Industry Desk access</li>
            <li>If you see Robinhood&apos;s &quot;Uh oh&quot;, run the Mac localhost bridge from gsb-swarm</li>
            <li>Fund the Agentic account (separate from primary)</li>
            <li>
              Open the{" "}
              <Link href="/ai" className="font-semibold text-[var(--teal-deep)] hover:underline">
                AI Desk
              </Link>{" "}
              and Review before any live place
            </li>
          </ol>
          <pre className="overflow-x-auto rounded-2xl bg-[#042f2e] p-4 text-xs text-[#ccfbf1]">
{`cd gsb-swarm
node scripts/robinhood-connect-local.js`}
          </pre>
        </aside>
      </div>
    </main>
  );
}
