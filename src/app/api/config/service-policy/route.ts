import { NextResponse } from "next/server";

import { getRouteHandlerSupabaseClient } from "@/server/supabase";

export async function GET() {
  try {
    const supabase = await getRouteHandlerSupabaseClient();
    const { data, error } = await supabase
      .from("service_policy")
      .select("lunch_start, lunch_end, dinner_start, dinner_end, clean_buffer_minutes, allow_after_hours")
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error("[config/service-policy][GET] Database error", { error });
      return NextResponse.json({ error: "Failed to load service policy" }, { status: 500 });
    }

    if (!data) {
      return NextResponse.json({ error: "Service policy not configured" }, { status: 404 });
    }

    return NextResponse.json({
      policy: {
        lunch: {
          start: data.lunch_start,
          end: data.lunch_end,
        },
        dinner: {
          start: data.dinner_start,
          end: data.dinner_end,
        },
        cleanBufferMinutes: data.clean_buffer_minutes,
        allowAfterHours: data.allow_after_hours,
      },
    });
  } catch (error) {
    console.error("[config/service-policy][GET] Unexpected error", { error });
    return NextResponse.json({ error: "An unexpected error occurred" }, { status: 500 });
  }
}
