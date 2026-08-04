import { NextRequest, NextResponse } from "next/server";
import { railwayAuthed } from "@/lib/railway";

export const runtime = "nodejs";
export const maxDuration = 60;

async function asJson(res: Response) {
  const text = await res.text();
  if (!text.trim()) {
    return NextResponse.json(
      { error: `Empty upstream response (${res.status})` },
      { status: res.status || 502 }
    );
  }
  try {
    return NextResponse.json(JSON.parse(text), { status: res.status });
  } catch {
    return NextResponse.json(
      { error: `Invalid upstream JSON (${res.status})`, body: text.slice(0, 200) },
      { status: 502 }
    );
  }
}

/** GET desk-day / industry-tape / plans — reuses Swarm Robinhood tokens. */
export async function GET(req: NextRequest) {
  const action = req.nextUrl.searchParams.get("action") || "desk-day";
  try {
    if (action === "desk-day") {
      const res = await railwayAuthed("/api/ceo/desk-day");
      return asJson(res);
    }
    if (action === "industry-tape") {
      const book = req.nextUrl.searchParams.get("book");
      const path = book
        ? `/api/ceo/industry-tape?book=${encodeURIComponent(book)}`
        : "/api/ceo/industry-tape";
      const res = await railwayAuthed(path);
      return asJson(res);
    }
    if (action === "plans" || action === "open-book") {
      const id = req.nextUrl.searchParams.get("id");
      const path = id
        ? `/api/ceo/plans?id=${encodeURIComponent(id)}`
        : "/api/ceo/plans";
      const res = await railwayAuthed(path);
      return asJson(res);
    }
    if (action === "trader") {
      const res = await railwayAuthed("/api/ceo/trader");
      return asJson(res);
    }
    if (action === "desk-newsletter") {
      const list = req.nextUrl.searchParams.get("list");
      const path =
        list === "1" || list === "true"
          ? `/api/ceo/desk-newsletter?list=1&limit=${encodeURIComponent(req.nextUrl.searchParams.get("limit") || "14")}`
          : "/api/ceo/desk-newsletter";
      const res = await railwayAuthed(path);
      return asJson(res);
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
    const res = await railwayAuthed(path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    return asJson(res);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
