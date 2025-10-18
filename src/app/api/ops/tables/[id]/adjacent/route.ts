import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getRouteHandlerSupabaseClient } from "@/server/supabase";

const payloadSchema = z.object({
  adjacentIds: z.array(z.string().uuid()).max(64).default([]),
});

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(_req: NextRequest, context: RouteContext) {
  try {
    const supabase = await getRouteHandlerSupabaseClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: tableId } = await context.params;

    const { data: table, error: fetchError } = await supabase
      .from("table_inventory")
      .select("restaurant_id")
      .eq("id", tableId)
      .maybeSingle();

    if (fetchError || !table) {
      return NextResponse.json({ error: "Table not found" }, { status: 404 });
    }

    const { data: membership } = await supabase
      .from("restaurant_memberships")
      .select("role")
      .eq("restaurant_id", table.restaurant_id)
      .eq("user_id", user.id)
      .maybeSingle();

    if (!membership) {
      return NextResponse.json(
        { error: "Access denied to this restaurant" },
        { status: 403 }
      );
    }

    const { data, error } = await supabase
      .from("table_adjacencies")
      .select("table_b")
      .eq("table_a", tableId)
      .order("table_b", { ascending: true });

    if (error) {
      console.error("[ops/tables][adjacent][GET] Fetch error", { error });
      return NextResponse.json(
        { error: "Failed to load adjacency" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      tableId,
      adjacentIds: data?.map((row) => row.table_b) ?? [],
    });
  } catch (error) {
    console.error("[ops/tables][adjacent][GET] Unexpected error", { error });
    return NextResponse.json(
      { error: "An unexpected error occurred" },
      { status: 500 }
    );
  }
}

export async function PUT(req: NextRequest, context: RouteContext) {
  try {
    const supabase = await getRouteHandlerSupabaseClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: tableId } = await context.params;

    const body = await req.json();
    const parsed = payloadSchema.safeParse(body ?? {});
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request body", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { adjacentIds } = parsed.data;
    const uniqueAdjacentIds = Array.from(new Set(adjacentIds));

    if (uniqueAdjacentIds.some((id) => id === tableId)) {
      return NextResponse.json(
        { error: "A table cannot be adjacent to itself" },
        { status: 400 }
      );
    }

    const { data: table, error: fetchError } = await supabase
      .from("table_inventory")
      .select("id, restaurant_id, zone_id")
      .eq("id", tableId)
      .maybeSingle();

    if (fetchError || !table) {
      return NextResponse.json({ error: "Table not found" }, { status: 404 });
    }

    const { data: membership, error: membershipError } = await supabase
      .from("restaurant_memberships")
      .select("role")
      .eq("restaurant_id", table.restaurant_id)
      .eq("user_id", user.id)
      .maybeSingle();

    if (membershipError || !membership) {
      return NextResponse.json(
        { error: "Access denied to this restaurant" },
        { status: 403 }
      );
    }

    if (uniqueAdjacentIds.length > 0) {
      const { data: adjacentTables, error: adjacentFetchError } = await supabase
        .from("table_inventory")
        .select("id, restaurant_id, zone_id, active")
        .in("id", uniqueAdjacentIds);

      if (adjacentFetchError) {
        console.error("[ops/tables][adjacent][PUT] Fetch error", { error: adjacentFetchError });
        return NextResponse.json(
          { error: "Failed to fetch adjacent tables" },
          { status: 500 }
        );
      }

      if (!adjacentTables || adjacentTables.length !== uniqueAdjacentIds.length) {
        return NextResponse.json(
          { error: "One or more adjacent tables were not found" },
          { status: 404 }
        );
      }

      const invalidZone = adjacentTables.find((candidate) => candidate.zone_id !== table.zone_id);
      if (invalidZone) {
        return NextResponse.json(
          { error: "Adjacency requires tables to be in the same zone" },
          { status: 400 }
        );
      }

      const crossRestaurant = adjacentTables.find((candidate) => candidate.restaurant_id !== table.restaurant_id);
      if (crossRestaurant) {
        return NextResponse.json(
          { error: "Adjacent table belongs to a different restaurant" },
          { status: 400 }
        );
      }
    }

    const deleteResult = await supabase
      .from("table_adjacencies")
      .delete()
      .eq("table_a", tableId);

    if (deleteResult.error) {
      console.error("[ops/tables][adjacent][PUT] Delete error", { error: deleteResult.error });
      return NextResponse.json(
        { error: "Failed to reset adjacency" },
        { status: 500 }
      );
    }

    if (uniqueAdjacentIds.length > 0) {
      const rows = uniqueAdjacentIds.map((adjacentId) => {
        const [first, second] = tableId < adjacentId ? [tableId, adjacentId] : [adjacentId, tableId];
        return { table_a: first, table_b: second };
      });

      const insertResult = await supabase
        .from("table_adjacencies")
        .insert(rows);

      if (insertResult.error) {
        console.error("[ops/tables][adjacent][PUT] Insert error", { error: insertResult.error });
        return NextResponse.json(
          { error: "Failed to update adjacency" },
          { status: 500 }
        );
      }
    }

    const { data: updatedAdjacency, error: adjacencyError } = await supabase
      .from("table_adjacencies")
      .select("table_b")
      .eq("table_a", tableId)
      .order("table_b", { ascending: true });

    if (adjacencyError) {
      console.error("[ops/tables][adjacent][PUT] Fetch updated adjacency error", { error: adjacencyError });
      return NextResponse.json(
        { error: "Failed to load updated adjacency" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      tableId,
      adjacentIds: updatedAdjacency?.map((row) => row.table_b) ?? [],
    });
  } catch (error) {
    console.error("[ops/tables][adjacent][PUT] Unexpected error", { error });
    return NextResponse.json(
      { error: "An unexpected error occurred" },
      { status: 500 }
    );
  }
}
