import { NextResponse } from "next/server";

import { GuardError, requireRestaurantMember, requireSession } from "@/server/auth/guards";

export async function requireDashboardAccess(restaurantId: string): Promise<void> {
  const { supabase, user } = await requireSession();
  await requireRestaurantMember({
    supabase,
    userId: user.id,
    restaurantId,
  });
}

export function buildDashboardAccessErrorResponse(scope: string, error: unknown): NextResponse {
  if (error instanceof GuardError) {
    console.error(`[ops/dashboard][${scope}] access validation failed`, error.details ?? error.message);
    return NextResponse.json(
      {
        error: error.message,
        code: error.code,
      },
      {
        status: error.status,
        headers: error.status === 503 ? { "Retry-After": "30" } : undefined,
      },
    );
  }

  console.error(`[ops/dashboard][${scope}] unexpected access validation failure`, error);
  return NextResponse.json(
    {
      error: "Unable to verify access",
      code: "ACCESS_VALIDATION_FAILED",
    },
    { status: 500 },
  );
}
