import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    // Best-effort drain to avoid unhandled body streams; ignore payload content.
    await req.json().catch(() => null);
  } catch {
    // Ignore malformed JSON; we treat analytics as fire-and-forget.
  }

  return new NextResponse(null, { status: 204 });
}

export function GET() {
  return NextResponse.json({ message: "Analytics events endpoint. Use POST with { events: [] }." }, { status: 405 });
}
