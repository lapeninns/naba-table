import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { TodayBookingsCard } from "@/components/ops/dashboard/TodayBookingsCard";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { fetchUserMemberships } from "@/server/team/access";
import {
  getBookingsHeatmap,
  getTodayBookingsSummary,
  type BookingHeatmap,
  type TodayBookingsSummary,
} from "@/server/ops/bookings";
import { getServerComponentSupabaseClient } from "@/server/supabase";
import { formatDateKey } from "@/lib/utils/datetime";

export const metadata: Metadata = {
  title: "Ops Dashboard · SajiloReserveX",
  description: "Monitor today’s bookings and keep your front of house running smoothly.",
};

type OpsPageSearchParams = {
  date?: string;
};

function sanitizeDateParam(value: string | undefined): string | null {
  if (!value) {
    return null;
  }
  return /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : null;
}

function computeCalendarRange(date: string): { start: string; end: string } {
  const base = new Date(`${date}T00:00:00`);
  if (Number.isNaN(base.getTime())) {
    return { start: date, end: date };
  }

  const start = new Date(base);
  start.setDate(1);
  const startWeekday = start.getDay();
  start.setDate(start.getDate() - startWeekday);

  const end = new Date(start);
  end.setDate(end.getDate() + 41);

  return {
    start: formatDateKey(start),
    end: formatDateKey(end),
  };
}

export default async function OpsDashboardPage({ searchParams }: { searchParams?: Promise<OpsPageSearchParams> }) {
  const resolvedParams = (await searchParams) ?? {};
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

  const requestedDate = sanitizeDateParam(resolvedParams.date);

  let summary: TodayBookingsSummary | null = null;
  let heatmap: BookingHeatmap = {};
  try {
    summary = await getTodayBookingsSummary(primaryMembership.restaurant_id, {
      client: supabase,
      targetDate: requestedDate ?? undefined,
    });
  } catch (cause) {
    console.error("[ops] failed to load today bookings summary", {
      restaurantId: primaryMembership.restaurant_id,
      cause,
    });
  }

  if (summary) {
    const { start, end } = computeCalendarRange(summary.date);
    try {
      heatmap = await getBookingsHeatmap(primaryMembership.restaurant_id, {
        client: supabase,
        startDate: start,
        endDate: end,
      });
    } catch (cause) {
      console.error("[ops] failed to load booking heatmap", {
        restaurantId: primaryMembership.restaurant_id,
        cause,
      });
    }
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
        <TodayBookingsCard
          summary={summary}
          restaurantName={restaurantName}
          selectedDate={summary.date}
          heatmap={heatmap}
        />
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
