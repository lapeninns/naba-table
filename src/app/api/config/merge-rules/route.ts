import { NextResponse } from "next/server";
import { getRouteHandlerSupabaseClient } from "@/server/supabase";

export async function GET() {
  try {
    const supabase = await getRouteHandlerSupabaseClient();
    const { data, error } = await supabase
      .from("merge_rules")
      .select("id, from_a, from_b, to_capacity, enabled, require_same_zone, require_adjacency, cross_category_merge")
      .order("from_a", { ascending: true })
      .order("from_b", { ascending: true });

    if (error) {
      console.error("[config/merge-rules][GET] Database error", { error });
      return NextResponse.json({ error: "Failed to load merge rules" }, { status: 500 });
    }

    return NextResponse.json({
      rules: (data ?? []).map((rule) => ({
        id: rule.id,
        from: [rule.from_a, rule.from_b],
        toCapacity: rule.to_capacity,
        enabled: rule.enabled,
        requireSameZone: rule.require_same_zone,
        requireAdjacency: rule.require_adjacency,
        crossCategoryMerge: rule.cross_category_merge,
      })),
    });
  } catch (error) {
    console.error("[config/merge-rules][GET] Unexpected error", { error });
    return NextResponse.json({ error: "An unexpected error occurred" }, { status: 500 });
  }
}
