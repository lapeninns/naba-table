import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { TodayBookingsCard } from "@/components/ops/dashboard/TodayBookingsCard";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { fetchUserMemberships } from "@/server/team/access";
import { getTodayBookingsSummary, type TodayBookingsSummary } from "@/server/ops/bookings";
import { getServerComponentSupabaseClient } from "@/server/supabase";

export const metadata: Metadata = {
  title: "Ops Dashboard · SajiloReserveX",
  description: "Monitor today’s bookings and keep your front of house running smoothly.",
};

export default async function OpsDashboardPage() {
  const supabase = await getServerComponentSupabaseClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error) {
    console.error("[ops] failed to resolve auth", error.message);
  }

  if (!user) {
    redirect(`/signin?redirectedFrom=/ops`);
  }

  const memberships = await fetchUserMemberships(user.id, supabase);

  if (memberships.length === 0) {
    return (
      <main className="flex min-h-[60vh] items-center justify-center px-6 py-16">
        <div className="max-w-lg rounded-lg border border-dashed border-border/60 bg-muted/20 px-6 py-8 text-center">
          <h1 className="text-xl font-semibold text-foreground">No restaurant access yet</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Ask an owner or manager to send you an invitation so you can manage bookings.
          </p>
        </div>
      </main>
    );
  }

  // MVP selects the first membership; future iterations will enable switching.
  const primaryMembership = memberships[0];
  const restaurantName = primaryMembership.restaurants?.name ?? "Restaurant";

  let summary: TodayBookingsSummary | null = null;
  try {
    summary = await getTodayBookingsSummary(primaryMembership.restaurant_id, {
      client: supabase,
    });
  } catch (cause) {
    console.error("[ops] failed to load today bookings summary", {
      restaurantId: primaryMembership.restaurant_id,
      cause,
    });
  }

  return (
    <main className="mx-auto flex max-w-5xl flex-col gap-8 px-6 py-10">
      <header className="flex flex-col gap-2">
        <h1 className="text-3xl font-semibold tracking-tight text-foreground">Operations</h1>
        <p className="text-sm text-muted-foreground">
          Stay on top of today’s reservations and spot issues before service begins.
        </p>
      </header>

      {summary ? (
        <TodayBookingsCard summary={summary} restaurantName={restaurantName} />
      ) : (
        <Alert variant="destructive" className="border-border/60 bg-destructive/10 text-destructive">
          <AlertTitle>Bookings unavailable</AlertTitle>
          <AlertDescription>
            We couldn’t load today’s reservations right now. Please refresh the page or try again shortly.
          </AlertDescription>
        </Alert>
      )}
    </main>
  );
}
