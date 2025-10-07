import { NextResponse } from "next/server";
import { z } from "zod";

import type { RestaurantFilters } from "@/lib/restaurants/types";
import { listRestaurants, ListRestaurantsError } from "@/server/restaurants";

const querySchema = z.object({
  search: z.string().optional(),
  timezone: z.string().optional(),
  minCapacity: z
    .union([z.string().transform((value) => Number.parseInt(value, 10)), z.number()])
    .pipe(z.number().int().min(0))
    .optional(),
});

export async function GET(request: Request) {
  const url = new URL(request.url);
  const initial = {
    search: url.searchParams.get("search") || undefined,
    timezone: url.searchParams.get("timezone") || undefined,
    minCapacity: url.searchParams.get("minCapacity") || undefined,
  };

  const parsed = querySchema.safeParse(initial);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Invalid filters",
        details: parsed.error.flatten(),
      },
      { status: 400 }
    );
  }

  const filters: RestaurantFilters = {
    search: parsed.data.search,
    timezone:
      parsed.data.timezone && parsed.data.timezone !== "all" ? parsed.data.timezone : undefined,
    minCapacity: parsed.data.minCapacity,
  };

  try {
    const restaurants = await listRestaurants(filters);
    return NextResponse.json({ data: restaurants });
  } catch (error) {
    if (error instanceof ListRestaurantsError) {
      return NextResponse.json({ error: error.message }, { status: 502 });
    }

    return NextResponse.json({ error: "Unexpected error" }, { status: 500 });
  }
}
