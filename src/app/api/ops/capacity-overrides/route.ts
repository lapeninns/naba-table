/**
 * Capacity Overrides API
 * Story 5: Surface date-specific capacity configuration to admins.
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { getRouteHandlerSupabaseClient } from "@/server/supabase";

const ADMIN_ROLES = ["owner", "admin"] as const;

const DATE_REGEX = /^[0-9]{4}-[0-9]{2}-[0-9]{2}$/;

const overridesQuerySchema = z.object({
  restaurantId: z.string().uuid(),
  from: z.string().regex(DATE_REGEX).optional(),
  to: z.string().regex(DATE_REGEX).optional(),
});

type OverridesQuery = z.infer<typeof overridesQuerySchema>;

function getDefaultRange(): { from: string; to: string } {
  const now = new Date();
  const fromDate = new Date(now);
  const toDate = new Date(now);

  fromDate.setDate(now.getDate() - 30);
  toDate.setDate(now.getDate() + 60);

  const format = (date: Date) => date.toISOString().split("T")[0]!;

  return {
    from: format(fromDate),
    to: format(toDate),
  };
}

function parseQuery(request: NextRequest): OverridesQuery | null {
  const raw = Object.fromEntries(request.nextUrl.searchParams.entries());
  const result = overridesQuerySchema.safeParse(raw);
  if (!result.success) {
    return null;
  }
  return result.data;
}

export async function GET(request: NextRequest) {
  const query = parseQuery(request);

  if (!query) {
    return NextResponse.json({ error: "Invalid query parameters" }, { status: 400 });
  }

  const range = (() => {
    if (query.from && query.to) {
      return { from: query.from, to: query.to };
    }
    return getDefaultRange();
  })();

  const supabase = await getRouteHandlerSupabaseClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError) {
    console.error("[ops/capacity-overrides][GET] auth error", authError);
    return NextResponse.json({ error: "Unable to verify session" }, { status: 500 });
  }

  if (!user) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  const { data: membership, error: membershipError } = await supabase
    .from("restaurant_memberships")
    .select("role")
    .eq("restaurant_id", query.restaurantId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (membershipError) {
    console.error("[ops/capacity-overrides][GET] membership error", membershipError);
    return NextResponse.json({ error: "Unable to verify permissions" }, { status: 500 });
  }

  if (!membership) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (!ADMIN_ROLES.includes(membership.role as (typeof ADMIN_ROLES)[number])) {
    return NextResponse.json({ error: "Only owners and admins can view overrides" }, { status: 403 });
  }

  try {
    const { data, error } = await supabase
      .from("restaurant_capacity_rules")
      .select(
        `
          id,
          restaurant_id,
          service_period_id,
          day_of_week,
          effective_date,
          max_covers,
          max_parties,
          notes,
          label,
          override_type,
          created_at,
          restaurant_service_periods (
            id,
            name,
            start_time,
            end_time
          )
        `
      )
      .eq("restaurant_id", query.restaurantId)
      .not("effective_date", "is", null)
      .gte("effective_date", range.from)
      .lte("effective_date", range.to)
      .order("effective_date", { ascending: true })
      .order("created_at", { ascending: true });

    if (error) {
      console.error("[ops/capacity-overrides][GET] query error", error);
      return NextResponse.json({ error: "Failed to fetch overrides" }, { status: 500 });
    }

    const overrides =
      data?.map((rule) => {
        const servicePeriodRecord = Array.isArray(rule.restaurant_service_periods)
          ? rule.restaurant_service_periods[0]
          : rule.restaurant_service_periods;

        return {
          id: rule.id,
          restaurantId: rule.restaurant_id,
          servicePeriodId: rule.service_period_id,
          servicePeriod: servicePeriodRecord
            ? {
                id: servicePeriodRecord.id,
                name: servicePeriodRecord.name,
                startTime: servicePeriodRecord.start_time,
                endTime: servicePeriodRecord.end_time,
              }
            : null,
          dayOfWeek: rule.day_of_week,
          effectiveDate: rule.effective_date,
          maxCovers: rule.max_covers,
          maxParties: rule.max_parties,
          notes: rule.notes,
          label: rule.label,
          overrideType: rule.override_type,
          createdAt: rule.created_at,
        };
      }) ?? [];

    return NextResponse.json({
      overrides,
      range,
      count: overrides.length,
    });
  } catch (error) {
    console.error("[ops/capacity-overrides][GET] unexpected error", error);
    return NextResponse.json({ error: "Unexpected error while loading overrides" }, { status: 500 });
  }
}
