import { NextRequest, NextResponse } from "next/server";
import { railwayAuthed, railwayFetch } from "@/lib/railway";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(req: NextRequest) {
  const action = req.nextUrl.searchParams.get("action") || "status";
  try {
    if (action === "status") {
      const res = await railwayFetch("/api/robinhood/status");
      return NextResponse.json(await res.json().catch(() => ({})), { status: res.status });
    }
    if (action === "connect") {
      const res = await railwayAuthed("/api/robinhood/connect");
      return NextResponse.json(await res.json().catch(() => ({})), { status: res.status });
    }
    if (action === "portfolio" || action === "accounts") {
      const path = action === "accounts" ? "/api/robinhood/accounts" : "/api/robinhood/portfolio";
      const res = await railwayAuthed(path);
      return NextResponse.json(await res.json().catch(() => ({})), { status: res.status });
    }
    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
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
    const res = await railwayAuthed(path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    return NextResponse.json(await res.json().catch(() => ({})), { status: res.status });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
