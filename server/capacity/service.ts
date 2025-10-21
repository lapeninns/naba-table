import type { SupabaseClient } from "@supabase/supabase-js";

import { getServiceSupabaseClient } from "@/server/supabase";
import { getServicePeriods } from "@/server/restaurants/servicePeriods";
import type { Database } from "@/types/supabase";
import type {
  AvailabilityCheckParams,
  AvailabilityResult,
  AlternativeSlotParams,
  TimeSlot,
  ServicePeriodWithCapacity,
  PeriodUtilization,
} from "./types";

type DbClient = SupabaseClient<Database, "public", any>;

const DEFAULT_AVAILABLE_COVERS = Number.MAX_SAFE_INTEGER;

function parseTimeToMinutes(value: string | null | undefined): number | null {
  if (!value) return null;
  const match = value.match(/^([0-9]{1,2}):([0-9]{2})(?::([0-9]{2}))?$/);
  if (!match) return null;
  const hours = Number.parseInt(match[1]!, 10);
  const minutes = Number.parseInt(match[2]!, 10) + (match[3] ? Number.parseInt(match[3]!, 10) : 0);
  return hours * 60 + minutes;
}

function matchServicePeriod(time: string, periods: ServicePeriodWithCapacity[]): ServicePeriodWithCapacity | null {
  const target = parseTimeToMinutes(time);
  if (target === null) {
    return null;
  }

  for (const period of periods) {
    const start = parseTimeToMinutes(period.startTime);
    const end = parseTimeToMinutes(period.endTime);
    if (start === null || end === null) {
      continue;
    }

    if (end > start) {
      if (target >= start && target < end) {
        return period;
      }
    } else {
      // Handle overnight windows (e.g. 22:00 -> 02:00)
      if (target >= start || target < end) {
        return period;
      }
    }
  }

  return null;
}

export async function getServicePeriodsWithCapacity(
  restaurantId: string,
  _date?: string,
  client?: DbClient,
): Promise<ServicePeriodWithCapacity[]> {
  const supabase = client ?? getServiceSupabaseClient();
  const servicePeriods = await getServicePeriods(restaurantId, supabase);

  return servicePeriods.map((period) => ({
    periodId: period.id,
    periodName: period.name,
    startTime: period.startTime,
    endTime: period.endTime,
    maxCovers: null,
    maxParties: null,
    dayOfWeek: period.dayOfWeek ?? null,
  }));
}

export async function checkSlotAvailability(
  params: AvailabilityCheckParams,
  client?: DbClient,
): Promise<AvailabilityResult> {
  const periods = await getServicePeriodsWithCapacity(params.restaurantId, params.date, client);
  const activePeriod = matchServicePeriod(params.time, periods);

  return {
    available: true,
    reason: undefined,
    metadata: {
      servicePeriod: activePeriod?.periodName,
      maxCovers: null,
      bookedCovers: 0,
      availableCovers: DEFAULT_AVAILABLE_COVERS,
      utilizationPercent: 0,
      maxParties: null,
      bookedParties: 0,
    },
  };
}

export async function findAlternativeSlots(
  _params: AlternativeSlotParams,
  _client?: DbClient,
): Promise<TimeSlot[]> {
  return [];
}

export async function calculateCapacityUtilization(
  restaurantId: string,
  date: string,
  client?: DbClient,
): Promise<{ date: string; periods: PeriodUtilization[]; hasOverbooking: boolean }> {
  const periods = await getServicePeriodsWithCapacity(restaurantId, date, client);

  return {
    date,
    hasOverbooking: false,
    periods: periods.map((period) => ({
      periodId: period.periodId,
      periodName: period.periodName,
      startTime: period.startTime,
      endTime: period.endTime,
      bookedCovers: 0,
      bookedParties: 0,
      maxCovers: null,
      maxParties: null,
      utilizationPercentage: 0,
      isOverbooked: false,
    })),
  };
}
