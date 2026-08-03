<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## Cursor Cloud specific instructions

- Package manager is **npm** (`package-lock.json`). Node 20+ is required (verified working on Node 22). Standard scripts live in `package.json`: `npm run dev` (port 3000), `npm run build`, `npm run start`, `npm run lint`. See `README.md` for the basic run flow.
- This app (`industry-desk`) is a **thin Next.js proxy/UI** over an external backend called `gsb-swarm` on Railway (default `https://gsb-swarm-production.up.railway.app`). There is **no local database, Docker, or other service to start** — `npm run dev` is enough to run the app end to end, and the API routes in `src/app/api/*` forward to that hosted backend.
- The proxy authenticates to the backend using an operator password. `src/lib/railway.ts` has a **hardcoded fallback password**, so live features (Robinhood status/portfolio/review) work against the hosted backend even when no env vars are set. Override with `DASHBOARD_PASSWORD` and/or point elsewhere with `INDUSTRY_DESK_RAILWAY_URL` (see `.env.example`).
- ⚠️ The backend is wired to a **live Robinhood Agentic trading account** (`live_trading_enabled: true`). When testing, only use read-only actions: the Robinhood panel **Refresh** and the Execute panel **"Review only"** (a `review_only` dry run that never places an order). Do **not** click **"Execute (dry-run)"** or **"Place live plan"**, and never POST with `confirm=true`/`live=true`, unless intentionally placing a real trade.
- `npm run lint` currently reports 3 pre-existing errors in `src/components/AiExecutePanel.tsx` and `src/components/RobinhoodPanel.tsx` (unrelated to environment setup); treat those as baseline.
