import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { getServerComponentSupabaseClient, getServiceSupabaseClient } from "@/server/supabase";
import { fetchUserMemberships } from "@/server/team/access";
import { OpsWalkInBookingClient } from "@/components/ops/bookings/OpsWalkInBookingClient";

const RESTAURANT_FIELDS = "id,slug,name,timezone,address";

export const metadata: Metadata = {
  title: "Create walk-in booking · SajiloReserveX",
  description: "Record a walk-in guest and keep your floor plan up to date.",
};

export default async function OpsWalkInBookingPage() {
  const supabase = await getServerComponentSupabaseClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error) {
    console.error("[ops/walk-in] auth resolution failed", error.message);
  }

  if (!user) {
    redirect("/signin?redirectedFrom=/ops/bookings/new");
  }

  const memberships = await fetchUserMemberships(user.id, supabase);

  if (memberships.length === 0) {
    redirect("/ops");
  }

  const restaurantIds = memberships.map((membership) => membership.restaurant_id);
  const serviceClient = getServiceSupabaseClient();

  const { data: restaurantsData, error: restaurantsError } = await serviceClient
    .from("restaurants")
    .select(RESTAURANT_FIELDS)
    .in("id", restaurantIds);

  if (restaurantsError) {
    console.error("[ops/walk-in] failed to load restaurants", restaurantsError.message);
    throw restaurantsError;
  }

  const restaurants = (restaurantsData ?? []).map((row) => ({
    id: row.id,
    slug: row.slug ?? row.id ?? "",
    name: row.name ?? "Restaurant",
    timezone: row.timezone ?? "UTC",
    address: row.address ?? "",
  }));

  return <OpsWalkInBookingClient restaurants={restaurants} />;
}
