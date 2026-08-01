import { NextRequest, NextResponse } from "next/server";
import { railwayAuthed } from "@/lib/railway";

export const runtime = "nodejs";
export const maxDuration = 60;

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
            : "/api/ceo/arm-plan";
    const res = await railwayAuthed(path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    return NextResponse.json(await res.json().catch(() => ({})), { status: res.status });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
