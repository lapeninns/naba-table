import { redirect } from "next/navigation";

import { OnboardingStepper } from "@/components/features/onboarding/OnboardingStepper";
import { ONBOARDING_STEPS } from "@/components/features/onboarding/steps";
import { getServiceSupabaseClient, getServerComponentSupabaseClient } from "@/server/supabase";

import { ReviewClient } from "./ReviewClient";

type Props = {
  searchParams: Promise<{ rid?: string }>;
};

export default async function OnboardingReviewPage({ searchParams }: Props) {
  const params = await searchParams;
  const restaurantId = params?.rid;
  if (!restaurantId) {
    redirect("/onboarding/profile");
  }

  const supabase = await getServerComponentSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/auth/signin?redirectedFrom=/onboarding/review");
  }

  const service = getServiceSupabaseClient();

  const { data: membership } = await service
    .from("restaurant_memberships")
    .select("id")
    .eq("restaurant_id", restaurantId)
    .eq("user_id", user!.id)
    .maybeSingle();

  if (!membership) {
    redirect("/onboarding/profile");
  }

  const [{ data: restaurant }, { data: hours }, { data: periods }, { data: zones }, { data: tables }] = await Promise.all([
    service
      .from("restaurants")
      .select(
        "id, name, slug, timezone, address, contact_email, contact_phone, reservation_interval_minutes, reservation_default_duration_minutes, reservation_last_seating_buffer_minutes",
      )
      .eq("id", restaurantId)
      .maybeSingle(),
    service
      .from("restaurant_operating_hours")
      .select("day_of_week, opens_at, closes_at, is_closed")
      .eq("restaurant_id", restaurantId)
      .is("effective_date", null)
      .order("day_of_week"),
    service
      .from("restaurant_service_periods")
      .select("name, day_of_week, start_time, end_time, booking_option")
      .eq("restaurant_id", restaurantId)
      .order("day_of_week"),
    service.from("zones").select("id, name, area_type, active").eq("restaurant_id", restaurantId).order("sort_order"),
    service
      .from("table_inventory")
      .select("id, table_number, capacity, min_party_size, max_party_size, category, seating_type, mobility, zone_id, status, active")
      .eq("restaurant_id", restaurantId)
      .order("table_number"),
  ]);

  return (
    <div className="space-y-6">
      <OnboardingStepper current={6} steps={ONBOARDING_STEPS} />
      <ReviewClient
        restaurantId={restaurantId}
        restaurant={restaurant}
        hours={hours ?? []}
        periods={periods ?? []}
        zones={zones ?? []}
        tables={tables ?? []}
      />
    </div>
  );
}
