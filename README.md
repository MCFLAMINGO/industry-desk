# Industry Desk

**Sellable product** — Robinhood Agentic industry books.

Live: [industry-desk.vercel.app](https://industry-desk.vercel.app)

## Lab + product (pre-launch)

Until Industry Desk goes live to customers, ship features to **both**:

| Surface | Role |
|---|---|
| **GSB Swarm dashboard** | Testing ground / operator lab |
| **Industry Desk (this repo)** | Product UI — keep in sync with lab features |

Workflow for now:

1. Build / try in Swarm dashboard **and** mirror into this app in the same pass.
2. Shared Railway trading backend powers both (Robinhood tokens, plans, desk-day).
3. After go-live: lab stays experimental; product only gets stable graduated UX.

## What’s live

- `/desk?book=…` — Analyze → Rank → Approve → **Play-by-play** (real-time mark / stop / target)
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
