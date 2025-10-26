import { NextResponse } from "next/server";

import { getRouteHandlerSupabaseClient } from "@/server/supabase";

import type { NextRequest } from "next/server";

function stringifyError(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  try {
    return JSON.stringify(error);
  } catch {
    return String(error);
  }
}

type LeadPayload = {
  email: string;
};

function isLeadPayload(value: unknown): value is LeadPayload {
  return typeof value === "object" && value !== null && typeof (value as { email?: unknown }).email === "string";
}

// This route is used to store the leads that are generated from the landing page.
// The API call is initiated by <ButtonLead /> component
export async function POST(req: NextRequest) {
  const body = await req.json();

  if (!isLeadPayload(body)) {
    return NextResponse.json({ error: "Email is required" }, { status: 400 });
  }

  try {
    const supabase = await getRouteHandlerSupabaseClient();
    await supabase.from("leads").insert({ email: body.email });

    return NextResponse.json({});
  } catch (error: unknown) {
    const message = stringifyError(error);
    console.error(message);
    return NextResponse.json({ error: message || "Unable to store lead" }, { status: 500 });
  }
}
