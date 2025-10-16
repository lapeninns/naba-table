/**
 * Capacity Rules Management API
 * Story 4: Ops Dashboard - Capacity Configuration
 * 
 * Endpoints:
 * - GET /api/ops/capacity-rules - List capacity rules for a restaurant
 * - POST /api/ops/capacity-rules - Create/update capacity rule
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getRouteHandlerSupabaseClient } from "@/server/supabase";

// =====================================================
// Request Validation
// =====================================================

const capacityRuleSchema = z.object({
  restaurantId: z.string().uuid(),
  servicePeriodId: z.string().uuid().optional().nullable(),
  dayOfWeek: z.number().int().min(0).max(6).optional().nullable(), // 0 = Sunday, 6 = Saturday
  effectiveDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  maxCovers: z.number().int().min(0).max(9999).optional().nullable(),
  maxParties: z.number().int().min(0).max(999).optional().nullable(),
  notes: z.string().max(500).optional().nullable(),
  label: z.string().min(1).max(120).optional().nullable(),
  overrideType: z
    .enum(["holiday", "event", "manual", "emergency"])
    .optional()
    .nullable(),
});

// =====================================================
// GET /api/ops/capacity-rules - List rules
// =====================================================

export async function GET(req: NextRequest) {
  try {
    const supabase = await getRouteHandlerSupabaseClient();

    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get query parameters
    const searchParams = req.nextUrl.searchParams;
    const restaurantId = searchParams.get("restaurantId");

    if (!restaurantId) {
      return NextResponse.json(
        { error: "restaurantId query parameter is required" },
        { status: 400 }
      );
    }

    // Verify access
    const { data: membership } = await supabase
      .from("restaurant_memberships")
      .select("role")
      .eq("restaurant_id", restaurantId)
      .eq("user_id", user.id)
      .single();

    if (!membership) {
      return NextResponse.json(
        { error: "Access denied to this restaurant" },
        { status: 403 }
      );
    }

    // Fetch capacity rules with service period names
    const { data: rules, error } = await supabase
      .from("restaurant_capacity_rules")
      .select(`
        *,
        restaurant_service_periods (
          id,
          name,
          start_time,
          end_time
        )
      `)
      .eq("restaurant_id", restaurantId)
      .order("effective_date", { ascending: false, nullsFirst: false })
      .order("day_of_week", { ascending: true, nullsFirst: false });

    if (error) {
      console.error("[ops/capacity-rules][GET] Database error", { error });
      return NextResponse.json(
        { error: "Failed to fetch capacity rules" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      rules: rules ?? [],
      count: rules?.length ?? 0,
    });
  } catch (error) {
    console.error("[ops/capacity-rules][GET] Unexpected error", { error });
    return NextResponse.json(
      { error: "An unexpected error occurred" },
      { status: 500 }
    );
  }
}

// =====================================================
// POST /api/ops/capacity-rules - Create/update rule
// =====================================================

export async function POST(req: NextRequest) {
  try {
    const supabase = await getRouteHandlerSupabaseClient();

    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Parse and validate body
    const body = await req.json();
    const parsed = capacityRuleSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "Invalid request body",
          details: parsed.error.flatten(),
        },
        { status: 400 }
      );
    }

    const data = parsed.data;

    // Verify user has admin access
    const { data: membership } = await supabase
      .from("restaurant_memberships")
      .select("role")
      .eq("restaurant_id", data.restaurantId)
      .eq("user_id", user.id)
      .single();

    if (!membership || !["owner", "admin"].includes(membership.role)) {
      return NextResponse.json(
        { error: "Only owners and admins can manage capacity rules" },
        { status: 403 }
      );
    }

    // Validate: At least one of servicePeriodId, dayOfWeek, or effectiveDate must be set
    if (!data.servicePeriodId && data.dayOfWeek === null && !data.effectiveDate) {
      return NextResponse.json(
        {
          error: "At least one of servicePeriodId, dayOfWeek, or effectiveDate must be specified",
        },
        { status: 400 }
      );
    }

    // Validate: At least one of maxCovers or maxParties must be set
    if (data.maxCovers === null && data.maxParties === null) {
      return NextResponse.json(
        {
          error: "At least one of maxCovers or maxParties must be specified",
        },
        { status: 400 }
      );
    }

    // Check for existing rule with same scope
    let existingQuery = supabase
      .from("restaurant_capacity_rules")
      .select("id")
      .eq("restaurant_id", data.restaurantId);

    if (data.servicePeriodId) {
      existingQuery = existingQuery.eq("service_period_id", data.servicePeriodId);
    } else {
      existingQuery = existingQuery.is("service_period_id", null);
    }

    if (data.dayOfWeek !== undefined && data.dayOfWeek !== null) {
      existingQuery = existingQuery.eq("day_of_week", data.dayOfWeek);
    } else {
      existingQuery = existingQuery.is("day_of_week", null);
    }

    if (data.effectiveDate) {
      existingQuery = existingQuery.eq("effective_date", data.effectiveDate);
    } else {
      existingQuery = existingQuery.is("effective_date", null);
    }

    const { data: existing } = await existingQuery.maybeSingle();

    // Upsert (update if exists, insert if not)
    const ruleData = {
      restaurant_id: data.restaurantId,
      service_period_id: data.servicePeriodId,
      day_of_week: data.dayOfWeek,
      effective_date: data.effectiveDate,
      max_covers: data.maxCovers,
      max_parties: data.maxParties,
      notes: data.notes,
      label: data.label,
      override_type: data.overrideType,
    };

    if (existing) {
      // Update existing rule
      const { data: rule, error: updateError } = await supabase
        .from("restaurant_capacity_rules")
        .update(ruleData)
        .eq("id", existing.id)
        .select(`
          *,
          restaurant_service_periods (
            id,
            name,
            start_time,
            end_time
          )
        `)
        .single();

      if (updateError) {
        console.error("[ops/capacity-rules][POST] Update error", { error: updateError });
        return NextResponse.json(
          { error: "Failed to update capacity rule" },
          { status: 500 }
        );
      }

      return NextResponse.json({ rule, updated: true });
    } else {
      // Create new rule
      const { data: rule, error: createError } = await supabase
        .from("restaurant_capacity_rules")
        .insert(ruleData)
        .select(`
          *,
          restaurant_service_periods (
            id,
            name,
            start_time,
            end_time
          )
        `)
        .single();

      if (createError) {
        console.error("[ops/capacity-rules][POST] Create error", { error: createError });
        return NextResponse.json(
          { error: "Failed to create capacity rule" },
          { status: 500 }
        );
      }

      return NextResponse.json({ rule, updated: false }, { status: 201 });
    }
  } catch (error) {
    console.error("[ops/capacity-rules][POST] Unexpected error", { error });
    return NextResponse.json(
      { error: "An unexpected error occurred" },
      { status: 500 }
    );
  }
}

// =====================================================
// DELETE /api/ops/capacity-rules/[id] - Delete rule
// =====================================================
// Note: Could add this if needed, but typically rules are updated not deleted
