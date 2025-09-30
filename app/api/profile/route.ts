import { NextRequest, NextResponse } from "next/server";
import { ZodError } from "zod";

import type { User } from "@supabase/supabase-js";

import { profileUpdateSchema, type ProfileUpdatePayload } from "@/lib/profile/schema";
import { normalizeProfileRow, ensureProfileRow, PROFILE_COLUMNS } from "@/lib/profile/server";
import { getRouteHandlerSupabaseClient } from "@/server/supabase";
import type { Database } from "@/types/supabase";

function jsonError(status: number, code: string, message: string, details?: unknown) {
  return NextResponse.json({ code, message, details }, { status });
}

type ProfileUpdateRow = Database["public"]["Tables"]["profiles"]["Update"];

function buildUpdatePayload(body: ProfileUpdatePayload): ProfileUpdateRow {
  const payload: ProfileUpdateRow = {
    updated_at: new Date().toISOString(),
  };
  if (Object.prototype.hasOwnProperty.call(body, "name")) {
    payload.name = body.name ?? null;
  }
  if (Object.prototype.hasOwnProperty.call(body, "phone")) {
    payload.phone = body.phone ?? null;
  }
  if (Object.prototype.hasOwnProperty.call(body, "image")) {
    payload.image = body.image ?? null;
  }
  return payload;
}

export async function GET(): Promise<NextResponse> {
  try {
    const supabase = await getRouteHandlerSupabaseClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError) {
      console.error("[profile][get] failed to resolve auth", authError.message);
      return jsonError(500, "AUTH_RESOLUTION_FAILED", "Unable to verify your session");
    }

    if (!user) {
      return jsonError(401, "UNAUTHENTICATED", "You must be signed in to view your profile");
    }

    const row = await ensureProfileRow(supabase, user);
    const profile = normalizeProfileRow(row, user.email ?? null);

    return NextResponse.json({ profile });
  } catch (error) {
    console.error("[profile][get] unexpected", error);
    return jsonError(500, "UNEXPECTED_ERROR", "We couldn’t load your profile. Please try again.");
  }
}

export async function PUT(req: NextRequest): Promise<NextResponse> {
  let parsedBody: ProfileUpdatePayload | null = null;

  try {
    const supabase = await getRouteHandlerSupabaseClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError) {
      console.error("[profile][put] failed to resolve auth", authError.message);
      return jsonError(500, "AUTH_RESOLUTION_FAILED", "Unable to verify your session");
    }

    if (!user) {
      return jsonError(401, "UNAUTHENTICATED", "You must be signed in to update your profile");
    }

    let rawBody: unknown;
    try {
      rawBody = await req.json();
    } catch {
      return jsonError(400, "INVALID_JSON", "Request body must be valid JSON");
    }

    if (rawBody && typeof rawBody === "object" && Object.prototype.hasOwnProperty.call(rawBody, "email")) {
      const attemptedEmail = (rawBody as Record<string, unknown>).email;
      if (attemptedEmail !== undefined && attemptedEmail !== user.email) {
        return jsonError(400, "EMAIL_IMMUTABLE", "Email cannot be changed");
      }
    }

    const result = profileUpdateSchema.safeParse(rawBody ?? {});
    if (!result.success) {
      const flattened = result.error.flatten();
      return jsonError(400, "INVALID_PROFILE", "Please review the highlighted fields", flattened);
    }

    parsedBody = result.data;

    const row = await ensureProfileRow(supabase, user);

    if (!Object.keys(parsedBody).some((key) => key === "name" || key === "phone" || key === "image")) {
      const profile = normalizeProfileRow(row, user.email ?? null);
      return NextResponse.json({ profile });
    }

    const updatePayload = buildUpdatePayload(parsedBody);

    const { data: updated, error: updateError } = await supabase
      .from("profiles")
      .update(updatePayload)
      .eq("id", user.id)
      .select(PROFILE_COLUMNS)
      .single();

    if (updateError) {
      console.error("[profile][put] update failed", updateError.message);
      const code = updateError.code === "PGRST301" ? "FORBIDDEN" : "UPDATE_FAILED";
      const message =
        code === "FORBIDDEN"
          ? "You do not have permission to update this profile"
          : "Unable to save your profile. Please try again.";
      return jsonError(403, code, message);
    }

    const profile = normalizeProfileRow(updated, user.email ?? null);
    return NextResponse.json({ profile });
  } catch (error) {
    if (error instanceof ZodError) {
      const flattened = error.flatten();
      return jsonError(400, "INVALID_PROFILE", "Please review the highlighted fields", flattened);
    }

    console.error("[profile][put] unexpected", error, parsedBody ?? {});
    return jsonError(500, "UNEXPECTED_ERROR", "We couldn’t update your profile. Please try again.");
  }
}
