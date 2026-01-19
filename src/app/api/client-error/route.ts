import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const payload = await req.json().catch(() => null);
    console.error("[client-error]", {
      path: (payload as { path?: string })?.path ?? null,
      message: (payload as { message?: string })?.message ?? null,
      stack: (payload as { stack?: string })?.stack ?? null,
      userId: (payload as { userId?: string | null })?.userId ?? null,
      bookingId: (payload as { bookingId?: string | null })?.bookingId ?? null,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("[client-error] failed to record", error);
  }

  return NextResponse.json({ ok: true }, { status: 200 });
}
