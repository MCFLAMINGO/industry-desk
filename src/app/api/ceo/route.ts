import { NextRequest, NextResponse } from "next/server";
import { railwayAuthed } from "@/lib/railway";

export const runtime = "nodejs";
export const maxDuration = 60;

const GET_TIMEOUT_MS = 20_000;
const POST_TIMEOUT_MS = 45_000;

async function asJson(res: Response) {
  const text = await res.text();
  if (!text.trim()) {
    return NextResponse.json(
      {
        ok: false,
        error: `Empty upstream response (${res.status})`,
      },
      { status: res.status >= 400 ? res.status : 502 }
    );
  }
  try {
    const data = JSON.parse(text) as Record<string, unknown>;
    return NextResponse.json(data, { status: res.status });
  } catch {
    return NextResponse.json(
      {
        ok: false,
        error: `Invalid upstream JSON (${res.status})`,
        body: text.slice(0, 200),
      },
      { status: 502 }
    );
  }
}

function fail(err: unknown, status = 500) {
  const message = err instanceof Error ? err.message : "Unknown error";
  const timedOut =
    message.includes("aborted") ||
    message.includes("Timeout") ||
    message.includes("timeout") ||
    (err instanceof Error && err.name === "AbortError");
  return NextResponse.json(
    {
      ok: false,
      error: timedOut ? `Desk API timed out — ${message}` : message,
    },
    { status: timedOut ? 504 : status }
  );
}

async function proxy(path: string, init: RequestInit = {}, timeoutMs = GET_TIMEOUT_MS) {
  const res = await railwayAuthed(path, {
    ...init,
    signal: AbortSignal.timeout(timeoutMs),
  });
  return asJson(res);
}

/** GET desk-day / industry-tape / plans — reuses Swarm Robinhood tokens. */
export async function GET(req: NextRequest) {
  const action = req.nextUrl.searchParams.get("action") || "desk-day";
  try {
    if (action === "desk-day") {
      return await proxy("/api/ceo/desk-day", {}, GET_TIMEOUT_MS);
    }
    if (action === "industry-tape") {
      const book = req.nextUrl.searchParams.get("book");
      const path = book
        ? `/api/ceo/industry-tape?book=${encodeURIComponent(book)}`
        : "/api/ceo/industry-tape";
      return await proxy(path, {}, GET_TIMEOUT_MS);
    }
    if (action === "plans" || action === "open-book") {
      const id = req.nextUrl.searchParams.get("id");
      const path = id
        ? `/api/ceo/plans?id=${encodeURIComponent(id)}`
        : "/api/ceo/plans";
      return await proxy(path, {}, GET_TIMEOUT_MS);
    }
    if (action === "trader") {
      return await proxy("/api/ceo/trader", {}, GET_TIMEOUT_MS);
    }
    if (action === "desk-newsletter") {
      const list = req.nextUrl.searchParams.get("list");
      const path =
        list === "1" || list === "true"
          ? `/api/ceo/desk-newsletter?list=1&limit=${encodeURIComponent(req.nextUrl.searchParams.get("limit") || "14")}`
          : "/api/ceo/desk-newsletter";
      return await proxy(path, {}, GET_TIMEOUT_MS);
    }
    if (action === "desk-alerts") {
      return await proxy(
        `/api/ceo/desk-alerts?limit=${encodeURIComponent(req.nextUrl.searchParams.get("limit") || "20")}`,
        {},
        GET_TIMEOUT_MS
      );
    }
    return NextResponse.json({ ok: false, error: "Unknown action" }, { status: 400 });
  } catch (err) {
    return fail(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const action = String(body.action || "arm-plan");
    const path =
      action === "execute"
        ? "/api/ceo/execute"
        : action === "tick-plan"
          ? "/api/ceo/tick-plan"
          : action === "trade-book"
            ? "/api/ceo/trade-book"
            : action === "desk-day"
              ? "/api/ceo/desk-day"
              : action === "desk-newsletter"
                ? "/api/ceo/desk-newsletter"
                : action === "trader-run"
                  ? "/api/ceo/trader/run"
                  : "/api/ceo/arm-plan";
    // desk-day is async on Railway by default — keep proxy budget short.
    const timeoutMs = action === "desk-day" ? 25_000 : POST_TIMEOUT_MS;
    return await proxy(
      path,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      },
      timeoutMs
    );
  } catch (err) {
    return fail(err);
  }
}
