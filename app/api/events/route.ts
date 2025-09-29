import { NextResponse, type NextRequest } from "next/server";

export async function POST(req: NextRequest) {
  try {
    let body: unknown = null;
    try {
      body = await req.json();
    } catch {
      body = null;
    }
    if (process.env.NODE_ENV !== "production") {
      // eslint-disable-next-line no-console
      console.debug("[events]", body);
    }
    return NextResponse.json({ ok: true }, { status: 202 });
  } catch (error) {
    console.error("[events] failed", error);
    return NextResponse.json({ error: "Unable to record event" }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({ ok: true }, { status: 200 });
}
