import { BOOKING_BLOCKING_STATUSES } from "@/lib/enums";
import { getVenuePolicy } from "@/server/capacity/policy";
import {
  loadActiveHoldsForDate,
  loadAdjacency,
  loadRestaurantTimezone,
  loadTablesForRestaurant,
} from "@/server/capacity/table-assignment/supabase";
import { getRestaurantSchedule } from "@/server/restaurants/schedule";
import { isTimeWithinPeriod, selectMatchingPeriod } from "@/server/restaurants/servicePeriodMatching";
import { getRestaurantTurnBands } from "@/server/restaurants/turnBands";
import { isHoldsEnabled } from "@/server/runtime-policy";
import { getServiceSupabaseClient } from "@/server/supabase";

import { checkRequestSeatability, type SeatabilityPreloadedContext } from "./seatability";

import type {
  AvailabilityCheckParams,
  AvailabilityResult,
  AlternativeSlotParams,
  TimeSlot,
  ServicePeriodWithCapacity,
  PeriodUtilization,
} from "./types";
import type { Database } from "@/types/supabase";
import type { SupabaseClient } from "@supabase/supabase-js";

type DbClient = SupabaseClient<Database, "public">;

type ServicePeriodRow = {
  id: string;
  name: string | null;
  day_of_week: number | null;
  start_time: string | null;
  end_time: string | null;
};

type CapacityRuleRow = {
  id: string;
  service_period_id: string | null;
  day_of_week: number | null;
  effective_date: string | null;
  max_covers: number | null;
  max_parties: number | null;
};

type BookingRow = {
  id: string;
  party_size: number | null;
  start_time: string | null;
  end_time: string | null;
  status: string | null;
};

type TableInventoryRow = {
  id: string;
  capacity: number | null;
  active: boolean | null;
  status: string | null;
};

type CapacityContext = {
  schedule: Awaited<ReturnType<typeof getRestaurantSchedule>>;
  periods: ServicePeriodRow[];
  rules: CapacityRuleRow[];
  bookings: BookingRow[];
  tables: TableInventoryRow[];
};

const DEFAULT_AVAILABLE_COVERS = Number.MAX_SAFE_INTEGER;
const DEFAULT_AVAILABLE_PARTIES = Number.MAX_SAFE_INTEGER;

function parseTimeToMinutes(value: string | null | undefined): number | null {
  if (!value) return null;
  const match = value.match(/^([0-9]{1,2}):([0-9]{2})(?::([0-9]{2}))?$/);
  if (!match) return null;
  const hours = Number.parseInt(match[1]!, 10);
  const minutes = Number.parseInt(match[2]!, 10) + (match[3] ? Number.parseInt(match[3]!, 10) : 0);
  return hours * 60 + minutes;
}

function resolveDayOfWeek(isoDate: string): number {
  const date = new Date(`${isoDate}T00:00:00Z`);
  const day = Number.isNaN(date.getTime()) ? new Date().getUTCDay() : date.getUTCDay();
  return day;
}

function selectCapacityRule(
  rules: CapacityRuleRow[],
  servicePeriodId: string | null,
  bookingDate: string,
  dayOfWeek: number,
): CapacityRuleRow | null {
  const eligible = rules.filter((rule) => {
    const effectiveMatch = !rule.effective_date || rule.effective_date <= bookingDate;
    const dayMatch = rule.day_of_week === null || rule.day_of_week === dayOfWeek;
    const serviceMatch = rule.service_period_id === null || rule.service_period_id === servicePeriodId;
    return effectiveMatch && dayMatch && serviceMatch;
  });

  if (eligible.length === 0) {
    return null;
  }

  eligible.sort((a, b) => {
    const effA = a.effective_date ?? "";
    const effB = b.effective_date ?? "";
    if (effA !== effB) {
      return effA > effB ? -1 : 1;
    }

    const dayA = a.day_of_week ?? -1;
    const dayB = b.day_of_week ?? -1;
    if (dayA !== dayB) {
      return dayA > dayB ? -1 : 1;
    }

    const serviceA = a.service_period_id ? 1 : 0;
    const serviceB = b.service_period_id ? 1 : 0;
    if (serviceA !== serviceB) {
      return serviceA > serviceB ? -1 : 1;
    }

    return 0;
  });

  return eligible[0] ?? null;
}

async function loadCapacityContext(
  restaurantId: string,
  date: string,
  client?: DbClient,
): Promise<CapacityContext> {
  const supabase = client ?? getServiceSupabaseClient();
  const schedulePromise = getRestaurantSchedule(restaurantId, { date, client: supabase });
  const periodsPromise = supabase
    .from("restaurant_service_periods")
    .select("id,name,day_of_week,start_time,end_time")
    .eq("restaurant_id", restaurantId);
  const rulesPromise = supabase
    .from("restaurant_capacity_rules" as never)
    .select("id,service_period_id,day_of_week,effective_date,max_covers,max_parties")
    .eq("restaurant_id", restaurantId);
  const tablesPromise = supabase
    .from("table_inventory")
    .select("id,capacity,active,status")
    .eq("restaurant_id", restaurantId)
    .eq("active", true);
  // Count only bookings whose status blocks capacity, matching the
  // seatability layer (BOOKING_BLOCKING_STATUSES). Previously this excluded
  // only cancelled/no_show and therefore counted completed/checked_in
  // bookings, diverging from seatability and double-counting seats that are
  // no longer reservable.
  const bookingsPromise = supabase
    .from("bookings")
    .select("id,party_size,start_time,end_time,status")
    .eq("restaurant_id", restaurantId)
    .eq("booking_date", date)
    .in("status", [...BOOKING_BLOCKING_STATUSES]);

  const [schedule, periodResult, ruleResult, tableResult, bookingResult] = await Promise.all([
    schedulePromise,
    periodsPromise,
    rulesPromise,
    tablesPromise,
    bookingsPromise,
  ]);

  if (periodResult.error) {
    throw new Error(`Failed to load service periods for capacity check: ${periodResult.error.message}`);
  }

  if (ruleResult.error) {
    throw new Error(`Failed to load capacity rules: ${ruleResult.error.message}`);
  }

  if (bookingResult.error) {
    throw new Error(`Failed to load bookings for capacity check: ${bookingResult.error.message}`);
  }

  if (tableResult.error) {
    throw new Error(`Failed to load table inventory for capacity check: ${tableResult.error.message}`);
  }

  return {
    schedule,
    periods: (periodResult.data ?? []) as ServicePeriodRow[],
    rules: (ruleResult.data ?? []) as CapacityRuleRow[],
    bookings: (bookingResult.data ?? []) as BookingRow[],
    tables: (tableResult.data ?? []) as TableInventoryRow[],
  };
}

function evaluateAvailability(
  context: CapacityContext,
  params: Pick<AvailabilityCheckParams, "date" | "time" | "partySize" | "durationMinutes" | "bookingOption">,
): AvailabilityResult {
  const dayOfWeek = resolveDayOfWeek(params.date);
  const matchingPeriod = selectMatchingPeriod(context.periods, params.time, dayOfWeek);
  const scheduleSlot = context.schedule.slots.find((slot) => slot.value === params.time) ?? null;
  const activeRule = selectCapacityRule(
    context.rules,
    matchingPeriod?.id ?? scheduleSlot?.periodId ?? null,
    params.date,
    dayOfWeek,
  );
  const inventoryCapacity = context.tables.reduce((total, table) => total + Math.max(table.capacity ?? 0, 0), 0);
  const inventoryPartyCount = context.tables.length > 0 ? context.tables.length : null;

  const maxCovers = activeRule?.max_covers ?? (inventoryCapacity > 0 ? inventoryCapacity : null);
  const maxParties = activeRule?.max_parties ?? inventoryPartyCount;
  const effectiveMaxCovers = maxCovers ?? DEFAULT_AVAILABLE_COVERS;
  const effectiveMaxParties = maxParties ?? DEFAULT_AVAILABLE_PARTIES;
  const defaultDurationMinutes =
    params.durationMinutes ?? context.schedule.defaultDurationMinutes ?? 90;
  const candidateStartMinutes = parseTimeToMinutes(params.time);
  const candidateEndMinutes =
    candidateStartMinutes === null ? null : candidateStartMinutes + defaultDurationMinutes;

  const applicableBookings = context.bookings.filter((booking) => {
    const bookingStartMinutes = parseTimeToMinutes(booking.start_time);
    if (bookingStartMinutes === null || candidateStartMinutes === null || candidateEndMinutes === null) {
      return true;
    }
    const bookingEndMinutes =
      parseTimeToMinutes(booking.end_time) ?? bookingStartMinutes + defaultDurationMinutes;

    if (matchingPeriod && booking.start_time) {
      const inPeriod = isTimeWithinPeriod(
        booking.start_time,
        matchingPeriod.start_time,
        matchingPeriod.end_time,
      );
      if (!inPeriod) {
        return false;
      }
    }

    return bookingStartMinutes < candidateEndMinutes && candidateStartMinutes < bookingEndMinutes;
  });

  const bookedCovers = applicableBookings.reduce((total, booking) => total + (booking.party_size ?? 0), 0);
  const bookedParties = applicableBookings.length;
  const availableCovers = maxCovers === null ? DEFAULT_AVAILABLE_COVERS : Math.max(effectiveMaxCovers - bookedCovers, 0);
  const availableParties = maxParties === null ? DEFAULT_AVAILABLE_PARTIES : Math.max(effectiveMaxParties - bookedParties, 0);
  const utilizationPercent =
    maxCovers && maxCovers > 0 ? Math.min(100, Math.round((bookedCovers / maxCovers) * 100)) : 0;

  const metadata = {
    servicePeriod: scheduleSlot?.periodName ?? matchingPeriod?.name ?? undefined,
    maxCovers,
    bookedCovers,
    availableCovers,
    utilizationPercent,
    maxParties,
    bookedParties,
    availableParties,
  };

  if (context.schedule.isClosed || !scheduleSlot || scheduleSlot.disabled) {
    return {
      available: false,
      reason: "Selected time is not available for reservations.",
      metadata,
    };
  }

  if (bookedCovers + params.partySize > effectiveMaxCovers) {
    return {
      available: false,
      reason: "No capacity available for this time slot.",
      metadata,
    };
  }

  if (bookedParties + 1 > effectiveMaxParties) {
    return {
      available: false,
      reason: "No capacity available for this time slot.",
      metadata,
    };
  }

  return {
    available: true,
    reason: undefined,
    metadata,
  };
}

export async function getServicePeriodsWithCapacity(
  restaurantId: string,
  date?: string,
  client?: DbClient,
): Promise<ServicePeriodWithCapacity[]> {
  const bookingDate = date ?? new Date().toISOString().slice(0, 10);
  const context = await loadCapacityContext(restaurantId, bookingDate, client);
  const dayOfWeek = resolveDayOfWeek(bookingDate);
  const inventoryCapacity = context.tables.reduce((total, table) => total + Math.max(table.capacity ?? 0, 0), 0);
  const inventoryPartyCount = context.tables.length > 0 ? context.tables.length : null;

  return context.periods.map((period) => {
    const rule = selectCapacityRule(context.rules, period.id, bookingDate, dayOfWeek);
    return {
      periodId: period.id,
      periodName: period.name ?? "Service period",
      startTime: period.start_time ?? "",
      endTime: period.end_time ?? "",
      maxCovers: rule?.max_covers ?? (inventoryCapacity > 0 ? inventoryCapacity : null),
      maxParties: rule?.max_parties ?? inventoryPartyCount,
      dayOfWeek: period.day_of_week ?? null,
    };
  });
}

export async function checkSlotAvailability(
  params: AvailabilityCheckParams,
  client?: DbClient,
): Promise<AvailabilityResult> {
  const context = await loadCapacityContext(params.restaurantId, params.date, client);
  const aggregateAvailability = evaluateAvailability(context, params);
  const matchingSlot = context.schedule.slots.find((slot) => slot.value === params.time) ?? null;

  if (!aggregateAvailability.available) {
    return aggregateAvailability;
  }

  const seatability = await checkRequestSeatability(
    {
      restaurantId: params.restaurantId,
      date: params.date,
      time: params.time,
      partySize: params.partySize,
      bookingOption: matchingSlot?.bookingOption ?? params.bookingOption ?? null,
    },
    client,
  );

  if (!seatability.seatable) {
    return {
      available: false,
      reason: "We can’t seat this party at the selected time. Please try another slot or contact the venue.",
      metadata: aggregateAvailability.metadata,
    };
  }

  return aggregateAvailability;
}

export async function findAlternativeSlots(
  params: AlternativeSlotParams,
  client?: DbClient,
): Promise<TimeSlot[]> {
  const supabase = client ?? getServiceSupabaseClient();
  const context = await loadCapacityContext(params.restaurantId, params.date, supabase);
  const preferredMinutes = parseTimeToMinutes(params.preferredTime);
  const searchWindowMinutes = params.searchWindowMinutes ?? 120;
  const maxAlternatives = params.maxAlternatives ?? 5;

  // N+1 mitigation (#5): checkRequestSeatability runs once per candidate slot and
  // would otherwise re-load the restaurant/date-constant resources for each one.
  // Load them ONCE here and pass them into every per-candidate check:
  //   - timezone + turn bands + tables + adjacency: restaurant-scoped
  //   - active holds: restaurant + date scoped
  // Only context bookings stay per-candidate because they are window-specific.
  const [preloadTimezone, preloadTurnBands, preloadTables] = await Promise.all([
    // Fail CLOSED on a timezone load error: a wrong timezone yields wrong
    // alternative-slot times, so let the error propagate rather than silently
    // degrading to the default zone — consistent with checkRequestSeatability. A
    // genuinely unset timezone still resolves to null and falls back below. (#9)
    loadRestaurantTimezone(params.restaurantId, supabase),
    getRestaurantTurnBands(params.restaurantId, supabase).catch(() => ({})),
    loadTablesForRestaurant(params.restaurantId, supabase),
  ]);
  const preloadAdjacency = await loadAdjacency(
    params.restaurantId,
    preloadTables.map((table) => table.id),
    supabase,
  );
  const preloadPolicy = getVenuePolicy({
    timezone: preloadTimezone ?? undefined,
    turnBandsByOption: preloadTurnBands,
  });
  const preloadHolds: SeatabilityPreloadedContext['holdsForDay'] = isHoldsEnabled()
    ? await loadActiveHoldsForDate(params.restaurantId, params.date, preloadPolicy, supabase).catch(
        () => [],
      )
    : [];
  const seatabilityPreloaded: SeatabilityPreloadedContext = {
    restaurantTimezone: preloadTimezone,
    turnBandsByOption: preloadTurnBands,
    holdsForDay: preloadHolds,
    tables: preloadTables,
    adjacency: preloadAdjacency,
  };

  const candidates = context.schedule.slots
    .filter((slot) => !slot.disabled && slot.value !== params.preferredTime)
    .flatMap((slot) => {
      const minutes = parseTimeToMinutes(slot.value);
      if (minutes === null) {
        return [];
      }

      if (preferredMinutes !== null && Math.abs(minutes - preferredMinutes) > searchWindowMinutes) {
        return [];
      }

      return [{ value: slot.value, minutes }];
    })
    .sort((a, b) => {
      if (preferredMinutes !== null) {
        const distanceA = Math.abs(a.minutes - preferredMinutes);
        const distanceB = Math.abs(b.minutes - preferredMinutes);
        if (distanceA !== distanceB) {
          return distanceA - distanceB;
        }
      }
      return a.minutes - b.minutes;
    });

  const alternatives: TimeSlot[] = [];

  for (const candidate of candidates) {
    const matchingSlot = context.schedule.slots.find((slot) => slot.value === candidate.value) ?? null;
    const evaluation = evaluateAvailability(context, {
      date: params.date,
      time: candidate.value,
      partySize: params.partySize,
      bookingOption: matchingSlot?.bookingOption ?? params.bookingOption ?? null,
    });

    if (!evaluation.available) {
      continue;
    }

    const seatability = await checkRequestSeatability(
      {
        restaurantId: params.restaurantId,
        date: params.date,
        time: candidate.value,
        partySize: params.partySize,
        bookingOption: matchingSlot?.bookingOption ?? params.bookingOption ?? null,
      },
      supabase,
      seatabilityPreloaded,
    );

    if (!seatability.seatable) {
      continue;
    }

    alternatives.push({
      time: candidate.value,
      available: true,
      utilizationPercent: evaluation.metadata.utilizationPercent,
      bookedCovers: evaluation.metadata.bookedCovers,
      maxCovers: evaluation.metadata.maxCovers ?? undefined,
    });

    if (alternatives.length >= maxAlternatives) {
      break;
    }
  }

  return alternatives;
}

export async function calculateCapacityUtilization(
  restaurantId: string,
  date: string,
  client?: DbClient,
): Promise<{ date: string; periods: PeriodUtilization[]; hasOverbooking: boolean }> {
  const context = await loadCapacityContext(restaurantId, date, client);
  const dayOfWeek = resolveDayOfWeek(date);
  const inventoryCapacity = context.tables.reduce((total, table) => total + Math.max(table.capacity ?? 0, 0), 0);
  const inventoryPartyCount = context.tables.length > 0 ? context.tables.length : null;

  const periods = context.periods.map((period) => {
    const rule = selectCapacityRule(context.rules, period.id, date, dayOfWeek);
    const maxCovers = rule?.max_covers ?? (inventoryCapacity > 0 ? inventoryCapacity : null);
    const maxParties = rule?.max_parties ?? inventoryPartyCount;
    const bookedInPeriod = context.bookings.filter((booking) =>
      isTimeWithinPeriod(booking.start_time ?? "", period.start_time, period.end_time),
    );
    const bookedCovers = bookedInPeriod.reduce((total, booking) => total + (booking.party_size ?? 0), 0);
    const bookedParties = bookedInPeriod.length;
    const utilizationPercentage =
      maxCovers && maxCovers > 0 ? Math.min(100, Math.round((bookedCovers / maxCovers) * 100)) : 0;
    const isOverbooked =
      (maxCovers !== null && bookedCovers > maxCovers) ||
      (maxParties !== null && bookedParties > maxParties);

    return {
      periodId: period.id,
      periodName: period.name ?? "Service period",
      startTime: period.start_time ?? "",
      endTime: period.end_time ?? "",
      bookedCovers,
      bookedParties,
      maxCovers,
      maxParties,
      utilizationPercentage,
      isOverbooked,
    };
  });

  return {
    date,
    hasOverbooking: periods.some((period) => period.isOverbooked),
    periods,
  };
}
