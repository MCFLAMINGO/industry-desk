import { NextRequest, NextResponse } from "next/server";
import { railwayAuthed, railwayFetch } from "@/lib/railway";

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
      error: timedOut ? `Robinhood proxy timed out — ${message}` : message,
    },
    { status: timedOut ? 504 : status }
  );
}

async function proxyAuthed(path: string, init: RequestInit = {}, timeoutMs = GET_TIMEOUT_MS) {
  const res = await railwayAuthed(path, {
    ...init,
    signal: AbortSignal.timeout(timeoutMs),
  });
  return asJson(res);
}

export async function GET(req: NextRequest) {
  const action = req.nextUrl.searchParams.get("action") || "status";
  try {
    if (action === "status") {
      const res = await railwayFetch("/api/robinhood/status", {
        signal: AbortSignal.timeout(GET_TIMEOUT_MS),
      });
      return asJson(res);
    }
    if (action === "connect") {
      return await proxyAuthed("/api/robinhood/connect");
    }
    if (action === "portfolio" || action === "accounts") {
      const path =
        action === "accounts" ? "/api/robinhood/accounts" : "/api/robinhood/portfolio";
      return await proxyAuthed(path);
    }
    return NextResponse.json({ ok: false, error: "Unknown action" }, { status: 400 });
  } catch (err) {
    return fail(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const action = String(body.action || "execute");
    const path =
      action === "import-tokens"
        ? "/api/robinhood/import-tokens"
        : action === "options"
          ? "/api/robinhood/options"
          : "/api/robinhood/execute";
    const payload =
      action === "import-tokens"
        ? {
            access_token: body.access_token || body.accessToken,
            refresh_token: body.refresh_token || body.refreshToken,
            client_id: body.client_id || body.clientId,
          }
        : body;
    return await proxyAuthed(
      path,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      },
      POST_TIMEOUT_MS
    );
  } catch (err) {
    return fail(err);
  }
}
