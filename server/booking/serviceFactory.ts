
import {
  checkSlotAvailability,
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

type DbClient = SupabaseClient<Database, "public">;

type ServiceFactoryOptions = {
  client?: DbClient;
  logger?: Logger;
  timeProvider?: TimeProvider;
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
      const startMinutes = toMinutes(input.startTime);
      const endMinutes = toMinutes(input.endTime);
      const durationMinutes =
        startMinutes !== null && endMinutes !== null
          ? Math.max(endMinutes - startMinutes, 0)
          : undefined;

      const availability = await checkSlotAvailability(
        {
          restaurantId: input.restaurantId,
          date: input.bookingDate,
          time: input.startTime,
          partySize: input.partySize,
          durationMinutes,
        },
        this.client,
      );

      if (!availability.available) {
        return {
          ok: false,
          errorCode: "CAPACITY_EXCEEDED",
          detail: {
            ...availability.metadata,
            requestedCovers: input.partySize,
            requestedParties: 1,
          },
        };
      }

      return {
        ok: true,
        detail: availability.metadata,
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
      details: input.details ?? undefined,
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

function toMinutes(value: string): number | null {
  const match = value.match(/^([0-9]{1,2}):([0-9]{2})(?::([0-9]{2}))?$/);
  if (!match) {
    return null;
  }
  const hours = Number.parseInt(match[1]!, 10);
  const minutes = Number.parseInt(match[2]!, 10);
  return hours * 60 + minutes;
}

function toCommitResult(result: CapacityBookingResult): CapacityCommitResult {
  return {
    success: result.success,
    booking: (result.booking ?? undefined) as CapacityCommitResult["booking"],
    duplicate: result.duplicate ?? false,
    error: result.error ? mapCapacityErrorCode(result.error) : undefined,
    details: (result.details ?? undefined) as Record<string, unknown> | undefined,
    originalResult: result,
  };
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
