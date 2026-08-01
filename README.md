# Industry Desk

Connect **Robinhood Agentic**. Pick an industry book. Let an agent watch it and Execute.

Clean teal product UI — separate from the GSB swarm ops dashboard.

## What’s live

- **AI Trade** desk — connect, portfolio, dry-run review, Execute (arm plan)
- Five preview books: Banking, Agriculture, Hospitality, Restaurants, Gig Workers
- Proxies Robinhood + plan APIs to the existing Railway swarm runtime

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

## Product direction

Industry packs act like focused analyst sleeves (AI first). Same Robinhood connection across books; cross-hedges and Coinbase come after the AI pack is polished.

## Stack

Next.js 16 · React 19 · Tailwind 4 · Framer Motion · Sonner
