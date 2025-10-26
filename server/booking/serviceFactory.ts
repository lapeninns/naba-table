
import {
  createBookingWithCapacityCheck,
  updateBookingWithCapacityCheck,
  type BookingResult as CapacityBookingResult,
} from "@/server/capacity";
import { getRestaurantSchedule } from "@/server/restaurants/schedule";
import { getServiceSupabaseClient } from "@/server/supabase";


import { BookingValidationService } from "./BookingValidationService";
import {
  mapCapacityErrorCode,
  type CapacityCheckInput,
  type CapacityCheckResult,
  type CapacityCommitInput,
  type CapacityCommitResult,
  type CapacityService,
  type Logger,
  type ScheduleRepository,
  type TimeProvider,
} from "./types";

import type { Database } from "@/types/supabase";
import type { SupabaseClient } from "@supabase/supabase-js";

type DbClient = SupabaseClient<Database, "public", any>;

type ServiceFactoryOptions = {
  client?: DbClient;
  logger?: Logger;
  timeProvider?: TimeProvider;
};

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
  party_size: number;
  start_time: string | null;
  status: string;
};

class SupabaseScheduleRepository implements ScheduleRepository {
  constructor(private readonly client: DbClient) {}

  async getSchedule(params: { restaurantId: string; date: string }) {
    return getRestaurantSchedule(params.restaurantId, {
      date: params.date,
      client: this.client,
    });
  }
}

class SupabaseCapacityService implements CapacityService {
  constructor(private readonly client: DbClient, private readonly logger?: Logger) {}

  private logDebug(message: string, context?: Record<string, unknown>) {
    if (this.logger) {
      this.logger.debug?.(message, context);
    }
  }

  private logWarn(message: string, context?: Record<string, unknown>) {
    if (this.logger) {
      this.logger.warn?.(message, context);
    }
  }

  async checkAvailability(input: CapacityCheckInput): Promise<CapacityCheckResult> {
    try {
      const dayOfWeek = resolveDayOfWeek(input.bookingDate);

      const { data: periodRows, error: periodError } = await this.client
        .from("restaurant_service_periods")
        .select("id,name,day_of_week,start_time,end_time")
        .eq("restaurant_id", input.restaurantId);

      if (periodError) {
        this.logWarn("Failed to load service periods for capacity check", {
          restaurantId: input.restaurantId,
          error: periodError.message,
        });
        return unknownCapacityResult("service_period_query_failed", periodError.message);
      }

      const periods = (periodRows ?? []) as ServicePeriodRow[];
      const matchingPeriod = selectMatchingPeriod(periods, input.startTime, dayOfWeek);

      const { data: ruleRows, error: ruleError } = await this.client
        .from("restaurant_capacity_rules")
        .select("id,service_period_id,day_of_week,effective_date,max_covers,max_parties")
        .eq("restaurant_id", input.restaurantId);

      if (ruleError) {
        this.logWarn("Failed to load capacity rules", {
          restaurantId: input.restaurantId,
          error: ruleError.message,
        });
        return unknownCapacityResult("capacity_rule_query_failed", ruleError.message);
      }

      const rules = (ruleRows ?? []) as CapacityRuleRow[];
      const activeRule = selectCapacityRule(rules, matchingPeriod?.id ?? null, input.bookingDate, dayOfWeek);

      const maxCovers = activeRule?.max_covers ?? Number.MAX_SAFE_INTEGER;
      const maxParties = activeRule?.max_parties ?? Number.MAX_SAFE_INTEGER;

      const bookingsQuery = this.client
        .from("bookings")
        .select("id,party_size,start_time,status")
        .eq("restaurant_id", input.restaurantId)
        .eq("booking_date", input.bookingDate)
        .not("status", "in", '("cancelled","no_show")');

      if (input.bookingId) {
        bookingsQuery.neq("id", input.bookingId);
      }

      const { data: bookingRows, error: bookingError } = await bookingsQuery;
      if (bookingError) {
        this.logWarn("Failed to load bookings for capacity check", {
          restaurantId: input.restaurantId,
          bookingDate: input.bookingDate,
          error: bookingError.message,
        });
        return unknownCapacityResult("booking_query_failed", bookingError.message);
      }

      const relevantBookings = (bookingRows ?? []) as BookingRow[];

      const applicableBookings = relevantBookings.filter((booking) => {
        if (!matchingPeriod) {
          return true;
        }
        return isTimeWithinPeriod(booking.start_time ?? null, matchingPeriod.start_time, matchingPeriod.end_time);
      });

      const bookedCovers = applicableBookings.reduce((total, booking) => total + (booking.party_size ?? 0), 0);
      const bookedParties = applicableBookings.length;

      const coversAfter = bookedCovers + input.partySize;
      const partiesAfter = bookedParties + 1;

      const capacityDetail = {
        servicePeriod: matchingPeriod?.name ?? null,
        servicePeriodId: matchingPeriod?.id ?? null,
        maxCovers,
        bookedCovers,
        availableCovers: Math.max(maxCovers - bookedCovers, 0),
        maxParties,
        bookedParties,
        availableParties: Math.max(maxParties - bookedParties, 0),
      };

      if (coversAfter > maxCovers || partiesAfter > maxParties) {
        return {
          ok: false,
          errorCode: "CAPACITY_EXCEEDED",
          detail: {
            ...capacityDetail,
            requestedCovers: input.partySize,
            requestedParties: 1,
          },
        };
      }

      return {
        ok: true,
        detail: capacityDetail,
      };
    } catch (error) {
      this.logWarn("Unexpected error during capacity check", {
        restaurantId: input.restaurantId,
        bookingDate: input.bookingDate,
        error: error instanceof Error ? error.message : String(error),
      });
      return unknownCapacityResult("unexpected_error", error instanceof Error ? error.message : String(error));
    }
  }

  async createBooking(input: CapacityCommitInput): Promise<CapacityCommitResult> {
    const result = await createBookingWithCapacityCheck({
      restaurantId: input.restaurantId,
      customerId: assertValue(input.customerId, "customerId"),
      bookingDate: input.bookingDate,
      startTime: input.startTime,
      endTime: input.endTime,
      partySize: input.partySize,
      bookingType: input.bookingType,
      customerName: assertValue(input.customerName, "customerName"),
      customerEmail: input.customerEmail ?? "",
      customerPhone: input.customerPhone ?? "",
      seatingPreference: (input.seatingPreference ?? "any") as Database["public"]["Enums"]["seating_preference_type"],
      notes: input.notes ?? null,
      marketingOptIn: input.marketingOptIn,
      idempotencyKey: input.idempotencyKey ?? null,
      source: input.source ?? undefined,
      authUserId: input.authUserId ?? undefined,
      clientRequestId: input.clientRequestId ?? undefined,
      loyaltyPointsAwarded: input.loyaltyPointsAwarded ?? undefined,
      details: undefined,
    }, this.client);

    return toCommitResult(result);
  }

  async updateBooking(input: CapacityCommitInput & { bookingId: string }): Promise<CapacityCommitResult> {
    const result = await updateBookingWithCapacityCheck({
      bookingId: input.bookingId,
      restaurantId: input.restaurantId,
      customerId: assertValue(input.customerId, "customerId"),
      bookingDate: input.bookingDate,
      startTime: input.startTime,
      endTime: input.endTime,
      partySize: input.partySize,
      bookingType: input.bookingType,
      customerName: assertValue(input.customerName, "customerName"),
      customerEmail: input.customerEmail ?? "",
      customerPhone: input.customerPhone ?? "",
      seatingPreference: (input.seatingPreference ?? "any") as Database["public"]["Enums"]["seating_preference_type"],
      notes: input.notes ?? null,
      marketingOptIn: input.marketingOptIn,
      source: input.source ?? undefined,
      authUserId: input.authUserId ?? undefined,
      clientRequestId: input.clientRequestId ?? undefined,
      loyaltyPointsAwarded: input.loyaltyPointsAwarded ?? undefined,
      details: undefined,
    }, this.client);

    return toCommitResult(result);
  }
}

function assertValue<T>(value: T | null | undefined, field: string): T {
  if (value === null || value === undefined) {
    throw new Error(`Missing required field: ${field}`);
  }
  return value;
}

function toCommitResult(result: CapacityBookingResult): CapacityCommitResult {
  return {
    success: result.success,
    booking: (result.booking ?? undefined) as any,
    duplicate: result.duplicate ?? false,
    error: result.error ? mapCapacityErrorCode(result.error) : undefined,
    details: (result.details ?? undefined) as Record<string, unknown> | undefined,
    originalResult: result,
  };
}

function resolveDayOfWeek(isoDate: string): number {
  const date = new Date(`${isoDate}T00:00:00Z`);
  const day = Number.isNaN(date.getTime()) ? new Date().getUTCDay() : date.getUTCDay();
  return day;
}

function timeToMinutes(value: string | null | undefined): number | null {
  if (!value) {
    return null;
  }

  const match = /^(\d{1,2}):(\d{2})(?::(\d{2}))?$/.exec(value);
  if (!match) {
    return null;
  }

  const hours = Number.parseInt(match[1]!, 10);
  const minutes = Number.parseInt(match[2]!, 10);
  const seconds = match[3] ? Number.parseInt(match[3]!, 10) : 0;
  if (Number.isNaN(hours) || Number.isNaN(minutes) || Number.isNaN(seconds)) {
    return null;
  }

  return hours * 60 + minutes + Math.floor(seconds / 60);
}

function isTimeWithinPeriod(target: string | null, start: string | null, end: string | null): boolean {
  const targetMinutes = timeToMinutes(target);
  const startMinutes = timeToMinutes(start);
  const endMinutes = timeToMinutes(end);

  if (targetMinutes === null || startMinutes === null || endMinutes === null) {
    return true;
  }

  if (endMinutes > startMinutes) {
    return targetMinutes >= startMinutes && targetMinutes < endMinutes;
  }

  if (endMinutes < startMinutes) {
    return targetMinutes >= startMinutes || targetMinutes < endMinutes;
  }

  return true;
}

function selectMatchingPeriod(periods: ServicePeriodRow[], requestedTime: string, dayOfWeek: number): ServicePeriodRow | null {
  const candidatePeriods = periods
    .filter((period) => period.day_of_week === null || period.day_of_week === dayOfWeek)
    .filter((period) => isTimeWithinPeriod(requestedTime, period.start_time, period.end_time));

  if (candidatePeriods.length === 0) {
    return null;
  }

  candidatePeriods.sort((a, b) => {
    const startA = timeToMinutes(a.start_time) ?? -1;
    const startB = timeToMinutes(b.start_time) ?? -1;
    if (startA !== startB) {
      return startA - startB;
    }
    const nameA = a.name ?? "";
    const nameB = b.name ?? "";
    return nameA.localeCompare(nameB);
  });

  return candidatePeriods[0] ?? null;
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

function unknownCapacityResult(reason: string, message?: string): CapacityCheckResult {
  return {
    ok: false,
    errorCode: "UNKNOWN",
    detail: {
      reason,
      message,
    },
  };
}

export function createBookingValidationService(options?: ServiceFactoryOptions) {
  const client = options?.client ?? getServiceSupabaseClient();
  const scheduleRepo = new SupabaseScheduleRepository(client);
  const capacityService = new SupabaseCapacityService(client, options?.logger);

  return new BookingValidationService(scheduleRepo, capacityService, {
    logger: options?.logger,
    timeProvider: options?.timeProvider,
  });
}

export type BookingValidationServiceFactoryOptions = ServiceFactoryOptions;
