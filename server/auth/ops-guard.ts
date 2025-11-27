import { NextResponse } from "next/server";

import { getMiddlewareSupabaseClient } from "@/server/supabase";

import type { Database } from "@/types/supabase";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { NextRequest } from "next/server";

type GuardResult = {
  userId: string;
  supabase: SupabaseClient<Database>;
};

type GuardFailure = NextResponse;

function guardError(status: number, code: string, message: string): GuardFailure {
  return NextResponse.json({ error: message, code }, { status });
}

export async function requireOpsAuth(req: NextRequest): Promise<GuardResult | GuardFailure> {
  const next = NextResponse.next();
  const supabase = getMiddlewareSupabaseClient(req, next);

  const { data, error } = await supabase.auth.getUser();

  if (error) {
    return guardError(500, "SESSION_RESOLUTION_FAILED", "Unable to verify session");
  }

  if (!data.user) {
    return guardError(401, "UNAUTHENTICATED", "Authentication required");
  }

  const { data: memberships, error: membershipError } = await supabase
    .from("restaurant_memberships")
    .select("role")
    .eq("user_id", data.user.id)
    .limit(1);

  if (membershipError) {
    return guardError(500, "MEMBERSHIP_VALIDATION_FAILED", "Unable to verify access");
  }

  if (!memberships || memberships.length === 0) {
    return guardError(403, "FORBIDDEN", "Forbidden");
  }

  return { userId: data.user.id, supabase };
}
