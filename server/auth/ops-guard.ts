import { NextResponse } from "next/server";

import { mapSupabaseAuthError } from "@/server/auth/supabase-auth-errors";
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

export async function requireOpsAuth(
  req: NextRequest,
  res?: NextResponse,
): Promise<GuardResult | GuardFailure> {
  const next = res ?? NextResponse.next();
  const supabase = getMiddlewareSupabaseClient(req, next);

  const { data, error } = await supabase.auth.getUser();

  if (error) {
    const mapped = mapSupabaseAuthError(error);
    return guardError(mapped.status, mapped.code, mapped.message);
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
