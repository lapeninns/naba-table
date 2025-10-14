import { NextRequest, NextResponse } from "next/server";

import { getCustomersWithProfiles } from "@/server/ops/customers";
import { fetchUserMemberships } from "@/server/team/access";
import { getRouteHandlerSupabaseClient, getServiceSupabaseClient } from "@/server/supabase";
import {
  opsCustomersQuerySchema,
  type CustomerDTO,
  type OpsCustomersResponse,
} from "./schema";

export async function GET(req: NextRequest) {
  const supabase = await getRouteHandlerSupabaseClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError) {
    console.error("[ops/customers][GET] failed to resolve auth", authError.message);
    return NextResponse.json({ error: "Unable to verify session" }, { status: 500 });
  }

  if (!user) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  const rawParams = {
    restaurantId: req.nextUrl.searchParams.get("restaurantId") ?? undefined,
    page: req.nextUrl.searchParams.get("page") ?? undefined,
    pageSize: req.nextUrl.searchParams.get("pageSize") ?? undefined,
    sort: req.nextUrl.searchParams.get("sort") ?? undefined,
  };

  const parsed = opsCustomersQuerySchema.safeParse(rawParams);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid query", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const params = parsed.data;

  let memberships: Awaited<ReturnType<typeof fetchUserMemberships>>;
  try {
    memberships = await fetchUserMemberships(user.id, supabase);
  } catch (error) {
    console.error("[ops/customers][GET] membership lookup failed", error);
    return NextResponse.json({ error: "Unable to verify memberships" }, { status: 500 });
  }

  if (memberships.length === 0) {
    const empty: OpsCustomersResponse = {
      items: [],
      pageInfo: {
        page: params.page,
        pageSize: params.pageSize,
        total: 0,
        hasNext: false,
      },
    };
    return NextResponse.json(empty);
  }

  const membershipIds = memberships
    .map((membership) => membership.restaurant_id)
    .filter((id): id is string => typeof id === "string" && id.length > 0);

  let targetRestaurantId = params.restaurantId;

  if (targetRestaurantId) {
    const allowed = membershipIds.includes(targetRestaurantId);
    if (!allowed) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  } else {
    targetRestaurantId = membershipIds[0] ?? null;
  }

  if (!targetRestaurantId) {
    const empty: OpsCustomersResponse = {
      items: [],
      pageInfo: {
        page: params.page,
        pageSize: params.pageSize,
        total: 0,
        hasNext: false,
      },
    };
    return NextResponse.json(empty);
  }

  const serviceSupabase = getServiceSupabaseClient();

  try {
    const result = await getCustomersWithProfiles({
      restaurantId: targetRestaurantId,
      page: params.page,
      pageSize: params.pageSize,
      sortOrder: params.sort,
      client: serviceSupabase,
    });

    const items: CustomerDTO[] = result.customers.map((customer) => ({
      id: customer.id,
      name: customer.name,
      email: customer.email,
      phone: customer.phone,
      marketingOptIn: customer.marketingOptIn,
      createdAt: customer.createdAt,
      firstBookingAt: customer.firstBookingAt,
      lastBookingAt: customer.lastBookingAt,
      totalBookings: customer.totalBookings,
      totalCovers: customer.totalCovers,
      totalCancellations: customer.totalCancellations,
    }));

    const response: OpsCustomersResponse = {
      items,
      pageInfo: {
        page: result.page,
        pageSize: result.pageSize,
        total: result.total,
        hasNext: result.hasNext,
      },
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error("[ops/customers][GET] query failed", error);
    return NextResponse.json({ error: "Unable to fetch customers" }, { status: 500 });
  }
}
