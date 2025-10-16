/**
 * Capacity Rules API - Single rule operations
 * Story 5: Allow administrators to remove overrides or rules.
 */

import { NextRequest, NextResponse } from "next/server";

import { getRouteHandlerSupabaseClient } from "@/server/supabase";

const ADMIN_ROLES = ["owner", "admin"] as const;

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function DELETE(_request: NextRequest, context: RouteContext) {
  const { id: ruleId } = await context.params;

  if (!ruleId) {
    return NextResponse.json({ error: "Rule id is required" }, { status: 400 });
  }

  const supabase = await getRouteHandlerSupabaseClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError) {
    console.error("[ops/capacity-rules][DELETE] auth error", authError);
    return NextResponse.json({ error: "Unable to verify session" }, { status: 500 });
  }

  if (!user) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  // Fetch rule to validate ownership
  const { data: rule, error: fetchError } = await supabase
    .from("restaurant_capacity_rules")
    .select("id, restaurant_id")
    .eq("id", ruleId)
    .single();

  if (fetchError) {
    console.error("[ops/capacity-rules][DELETE] failed to load rule", fetchError);
    return NextResponse.json({ error: "Unable to load capacity rule" }, { status: 500 });
  }

  if (!rule) {
    return NextResponse.json({ error: "Capacity rule not found" }, { status: 404 });
  }

  // Verify membership and role
  const { data: membership, error: membershipError } = await supabase
    .from("restaurant_memberships")
    .select("role")
    .eq("restaurant_id", rule.restaurant_id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (membershipError) {
    console.error("[ops/capacity-rules][DELETE] membership query failed", membershipError);
    return NextResponse.json({ error: "Unable to verify permissions" }, { status: 500 });
  }

  if (!membership || !ADMIN_ROLES.includes(membership.role as (typeof ADMIN_ROLES)[number])) {
    return NextResponse.json({ error: "Only owners and admins can remove capacity rules" }, { status: 403 });
  }

  const { error: deleteError } = await supabase
    .from("restaurant_capacity_rules")
    .delete()
    .eq("id", ruleId);

  if (deleteError) {
    console.error("[ops/capacity-rules][DELETE] delete failed", deleteError);
    return NextResponse.json({ error: "Failed to delete capacity rule" }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
