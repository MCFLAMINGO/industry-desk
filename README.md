# Industry Desk

**Sellable product** — Robinhood Agentic industry books.

Live: [industry-desk.vercel.app](https://industry-desk.vercel.app)

## Lab → product

| Surface | Role |
|---|---|
| **GSB Swarm dashboard** | Testing ground. Try new trading / desk features here first. |
| **Industry Desk (this repo)** | Customer-facing product. Graduate a feature here after it works in the lab. |

Workflow:

1. Prototype and break things in the Swarm dashboard / Railway swarm.
2. When a flow is solid (connect, tape, rank, preview, approve, open book), port the UX into this app.
3. Keep Swarm as the lab — don’t turn Industry Desk into an ops console.

Robinhood tokens and plan workers still run on the shared Railway trading backend today; this app is the product UI over that rail.

## What’s live

- `/desk?book=restaurants` (and other books) — Analyze → Rank → Approve → Open book
- `/connect` — Robinhood Agentic connect (prefer Mac localhost bridge if HTTPS “Uh oh”)
- `/ai` — focused AI sleeve shortcuts
- Home industry grid → desk books

## Run

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

Optional env (see `.env.example`):

```bash
DASHBOARD_PASSWORD=your-operator-password
INDUSTRY_DESK_RAILWAY_URL=https://gsb-swarm-production.up.railway.app
```

## Stack

Next.js 16 · React 19 · Tailwind 4 · Framer Motion · Sonner
