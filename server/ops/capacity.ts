import type { SupabaseClient } from "@supabase/supabase-js";

import { getServiceSupabaseClient } from "@/server/supabase";
import type { Database, Tables } from "@/types/supabase";

type DbClient = SupabaseClient<Database, "public", any>;

export type ServicePeriodWithCapacity = {
  periodId: string;
  periodName: string;
  startTime: string;
  endTime: string;
  maxCovers: number | null;
  maxParties: number | null;
  dayOfWeek: number | null;
};

export type PeriodUtilization = {
  periodId: string;
  periodName: string;
  startTime: string;
  endTime: string;
  bookedCovers: number;
  bookedParties: number;
  maxCovers: number | null;
  maxParties: number | null;
  utilizationPercentage: number;
  isOverbooked: boolean;
};

export type CapacityUtilizationResponse = {
  date: string;
  periods: PeriodUtilization[];
  hasOverbooking: boolean;
};

type BookingForCapacity = {
  id: string;
  startTime: string | null;
  partySize: number;
  status: string;
};

const CANCELLED_STATUSES = ["cancelled", "no_show"];

function parseTime(timeStr: string | null): number | null {
  if (!timeStr) return null;
  const match = timeStr.match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);
  if (!match) return null;
  const hours = parseInt(match[1]!, 10);
  const minutes = parseInt(match[2]!, 10);
  return hours * 60 + minutes;
}

function matchBookingToPeriod(
  booking: BookingForCapacity,
  periods: ServicePeriodWithCapacity[],
): string | null {
  const bookingMinutes = parseTime(booking.startTime);
  if (bookingMinutes === null) return null;

  for (const period of periods) {
    const periodStart = parseTime(period.startTime);
    const periodEnd = parseTime(period.endTime);

    if (periodStart === null || periodEnd === null) continue;

    const isInRange =
      periodEnd > periodStart
        ? bookingMinutes >= periodStart && bookingMinutes < periodEnd
        : bookingMinutes >= periodStart || bookingMinutes < periodEnd;

    if (isInRange) {
      return period.periodId;
    }
  }

  return null;
}

export async function getServicePeriodsWithCapacity(
  restaurantId: string,
  date: string,
  client?: DbClient,
): Promise<ServicePeriodWithCapacity[]> {
  const supabase = client ?? getServiceSupabaseClient();

  const targetDate = new Date(date);
  const dayOfWeek = targetDate.getUTCDay();

  const { data: periods, error: periodsError } = await supabase
    .from("restaurant_service_periods")
    .select("id, name, start_time, end_time, day_of_week")
    .eq("restaurant_id", restaurantId)
    .or(`day_of_week.is.null,day_of_week.eq.${dayOfWeek}`);

  if (periodsError) {
    throw periodsError;
  }

  if (!periods || periods.length === 0) {
    return [];
  }

  const periodIds = periods.map((p) => p.id);

  const { data: capacityRules, error: capacityError } = await supabase
    .from("restaurant_capacity_rules")
    .select("service_period_id, max_covers, max_parties, day_of_week, effective_date")
    .eq("restaurant_id", restaurantId)
    .in("service_period_id", periodIds)
    .or(`day_of_week.is.null,day_of_week.eq.${dayOfWeek}`)
    .or(`effective_date.is.null,effective_date.lte.${date}`)
    .order("effective_date", { ascending: false, nullsFirst: false });

  if (capacityError) {
    throw capacityError;
  }

  const capacityMap = new Map<string, { maxCovers: number | null; maxParties: number | null }>();
  (capacityRules ?? []).forEach((rule) => {
    if (!capacityMap.has(rule.service_period_id!)) {
      capacityMap.set(rule.service_period_id!, {
        maxCovers: rule.max_covers,
        maxParties: rule.max_parties,
      });
    }
  });

  return periods.map((period) => {
    const capacity = capacityMap.get(period.id) ?? { maxCovers: null, maxParties: null };
    return {
      periodId: period.id,
      periodName: period.name,
      startTime: period.start_time,
      endTime: period.end_time,
      maxCovers: capacity.maxCovers,
      maxParties: capacity.maxParties,
      dayOfWeek: period.day_of_week,
    };
  });
}

export async function calculateCapacityUtilization(
  restaurantId: string,
  date: string,
  client?: DbClient,
): Promise<CapacityUtilizationResponse> {
  const supabase = client ?? getServiceSupabaseClient();

  const periods = await getServicePeriodsWithCapacity(restaurantId, date, supabase);

  if (periods.length === 0) {
    return {
      date,
      periods: [],
      hasOverbooking: false,
    };
  }

  const { data: bookings, error: bookingsError } = await supabase
    .from("bookings")
    .select("id, start_time, party_size, status")
    .eq("restaurant_id", restaurantId)
    .eq("booking_date", date);

  if (bookingsError) {
    throw bookingsError;
  }

  const bookingsData: BookingForCapacity[] = (bookings ?? []).map((b) => ({
    id: b.id,
    startTime: b.start_time,
    partySize: b.party_size,
    status: b.status,
  }));

  const utilizationMap = new Map<
    string,
    {
      bookedCovers: number;
      bookedParties: number;
    }
  >();

  periods.forEach((period) => {
    utilizationMap.set(period.periodId, { bookedCovers: 0, bookedParties: 0 });
  });

  bookingsData.forEach((booking) => {
    if (CANCELLED_STATUSES.includes(booking.status)) {
      return;
    }

    const periodId = matchBookingToPeriod(booking, periods);
    if (periodId && utilizationMap.has(periodId)) {
      const current = utilizationMap.get(periodId)!;
      current.bookedCovers += booking.partySize;
      current.bookedParties += 1;
    }
  });

  let hasOverbooking = false;

  const utilizationResults: PeriodUtilization[] = periods.map((period) => {
    const utilization = utilizationMap.get(period.periodId) ?? { bookedCovers: 0, bookedParties: 0 };

    const utilizationPercentage =
      period.maxCovers !== null && period.maxCovers > 0
        ? Math.round((utilization.bookedCovers / period.maxCovers) * 100)
        : 0;

    const isOverbooked =
      (period.maxCovers !== null && utilization.bookedCovers > period.maxCovers) ||
      (period.maxParties !== null && utilization.bookedParties > period.maxParties);

    if (isOverbooked) {
      hasOverbooking = true;
    }

    return {
      periodId: period.periodId,
      periodName: period.periodName,
      startTime: period.startTime,
      endTime: period.endTime,
      bookedCovers: utilization.bookedCovers,
      bookedParties: utilization.bookedParties,
      maxCovers: period.maxCovers,
      maxParties: period.maxParties,
      utilizationPercentage,
      isOverbooked,
    };
  });

  return {
    date,
    periods: utilizationResults,
    hasOverbooking,
  };
}
