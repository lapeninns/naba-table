import { redirect } from "next/navigation";

import { getServerComponentSupabaseClient, getServiceSupabaseClient } from "@/server/supabase";

function resolveStep(counts: { hours: number; periods: number; zones: number; tables: number }): number {
  if (counts.hours === 0) return 3;
  if (counts.periods === 0) return 4;
  if (counts.zones === 0 || counts.tables === 0) return 5;
  return 6;
}

export default async function OnboardingIndex() {
  const supabase = await getServerComponentSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth/signin?redirectedFrom=/onboarding");
  }

  const service = getServiceSupabaseClient();

  const { data: membershipRows } = await service
    .from("restaurant_memberships")
    .select("restaurant_id, role")
    .eq("user_id", user!.id)
    .order("created_at", { ascending: false })
    .limit(1);

  const restaurantId = membershipRows?.[0]?.restaurant_id ?? null;

  if (!restaurantId) {
    redirect("/onboarding/profile");
  }

  const [hoursRes, periodsRes, zonesRes, tablesRes] = await Promise.all([
    service
      .from("restaurant_operating_hours")
      .select("id")
      .eq("restaurant_id", restaurantId!)
      .is("effective_date", null),
    service.from("restaurant_service_periods").select("id").eq("restaurant_id", restaurantId!),
    service.from("zones").select("id").eq("restaurant_id", restaurantId!),
    service.from("table_inventory").select("id").eq("restaurant_id", restaurantId!),
  ]);

  const counts = {
    hours: hoursRes.data?.length ?? 0,
    periods: periodsRes.data?.length ?? 0,
    zones: zonesRes.data?.length ?? 0,
    tables: tablesRes.data?.length ?? 0,
  };

  const step = resolveStep(counts);
  const ridParam = `?rid=${restaurantId}`;
  if (step === 3) redirect(`/onboarding/hours${ridParam}`);
  if (step === 4) redirect(`/onboarding/services${ridParam}`);
  if (step === 5) redirect(`/onboarding/tables${ridParam}`);
  redirect(`/onboarding/review${ridParam}`);
}
