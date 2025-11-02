import { DateTime } from "luxon";

import { isBookingType, type BookingType } from "@/lib/enums";
import { inferMealTypeFromTime, calculateDurationMinutes } from "@/server/bookings";
import { PastBookingError, assertBookingNotInPast } from "@/server/bookings/pastTimeValidation";
import { OperatingHoursError, assertBookingWithinOperatingWindow } from "@/server/bookings/timeValidation";
import { recordObservabilityEvent } from "@/server/observability";


import { mapCapacityErrorCode } from "./types";

import type {
  BookingError,
  BookingErrorCode,
  BookingInput,
  BookingValidationResponse,
  ValidationContext,
  ValidationResult,
  ValidationSuccessMetadata,
  ValidationFailureMetadata,
  CapacityService,
  ScheduleRepository,
  TimeProvider,
  Logger,
  CapacityCommitInput,
  CapacityCommitResult,
  BookingCommitSuccess,
  BookingErrorSeverity,
} from "./types";
import type { BookingRecord as ExistingBookingRecord } from "@/server/capacity";

export class BookingValidationError extends Error {
  readonly response: BookingValidationResponse & { ok: false };

  constructor(response: BookingValidationResponse & { ok: false }) {
    super(response.issues[0]?.message ?? "Booking validation failed");
    this.name = "BookingValidationError";
    this.response = response;
  }
}

type CoreValidationOutcome =
  | {
      ok: true;
      response: BookingValidationResponse & { ok: true };
      metadata: ValidationSuccessMetadata;
    }
  | {
      ok: false;
      response: BookingValidationResponse & { ok: false };
      metadata: ValidationFailureMetadata;
    };

type ValidationOptions = {
  existingBooking?: ExistingBookingRecord | null;
  checkCapacity?: boolean;
};

type OverrideResolution = {
  ok: boolean;
  overridden: boolean;
  updatedIssues: BookingError[];
  overrideCodes: BookingErrorCode[];
};

const BOOKING_OVERRIDE_CAPABILITY = "booking.override";

function ensureLogger(logger?: Logger): Logger {
  if (logger) {
    return logger;
  }
  return {
    debug: (message, context) => console.debug("[booking-validation]", message, context ?? {}),
    info: (message, context) => console.info("[booking-validation]", message, context ?? {}),
    warn: (message, context) => console.warn("[booking-validation]", message, context ?? {}),
    error: (message, context) => console.error("[booking-validation]", message, context ?? {}),
  };
}

function ensureTimeProvider(time?: TimeProvider): TimeProvider {
  if (time) {
    return time;
  }
  return {
    now: () => new Date(),
  };
}

export class BookingValidationService {
  private readonly time: TimeProvider;
  private readonly logger: Logger;

  constructor(
    private readonly scheduleRepo: ScheduleRepository,
    private readonly capacityService: CapacityService,
    options?: { timeProvider?: TimeProvider; logger?: Logger },
  ) {
    this.time = ensureTimeProvider(options?.timeProvider);
    this.logger = ensureLogger(options?.logger);
  }

  async validateCreate(input: BookingInput, ctx: ValidationContext): Promise<ValidationResult> {
    const outcome = await this.runValidation(input, ctx, { checkCapacity: true });
    return {
      response: outcome.response,
      metadata: outcome.metadata,
    };
  }

  async validateUpdate(
    existing: ExistingBookingRecord,
    patch: BookingInput,
    ctx: ValidationContext,
  ): Promise<ValidationResult> {
    const normalizedInput: BookingInput = {
      ...patch,
      bookingId: existing.id,
      restaurantId: existing.restaurant_id,
      durationMinutes: patch.durationMinutes ?? calculateDurationMinutes(existing.booking_type as BookingType),
      start: patch.start ?? new Date(existing.start_at ?? `${existing.booking_date}T${existing.start_time}`).toISOString(),
      serviceId: patch.serviceId ?? existing.booking_type,
      bookingType: patch.bookingType ?? (existing.booking_type as BookingType),
    };

    const outcome = await this.runValidation(normalizedInput, ctx, {
      existingBooking: existing,
      checkCapacity: true,
    });
    return {
      response: outcome.response,
      metadata: outcome.metadata,
    };
  }

  async createWithEnforcement(input: BookingInput, ctx: ValidationContext): Promise<BookingCommitSuccess> {
    const outcome = await this.runValidation(input, ctx, { checkCapacity: false });
    if (!outcome.ok) {
      throw new BookingValidationError(outcome.response);
    }

    const { metadata } = outcome;
    const { bookingType, bookingDate, startTime, endTime } = metadata;

    const clientRequestId = this.extractClientRequestId(ctx);

    const commitPayload: CapacityCommitInput = {
      restaurantId: input.restaurantId,
      bookingDate,
      startTime,
      endTime,
      partySize: input.partySize,
      bookingType,
      seatingPreference: input.seatingPreference ?? null,
      customerName: input.customerName ?? null,
      customerId: input.customerId ?? null,
      customerEmail: input.customerEmail ?? null,
      customerPhone: input.customerPhone ?? null,
      notes: input.notes ?? null,
      marketingOptIn: input.marketingOptIn,
      source: input.source ?? null,
      loyaltyPointsAwarded: input.loyaltyPointsAwarded ?? null,
      idempotencyKey: input.idempotencyKey ?? null,
      authUserId: ctx.actorId ?? null,
      clientRequestId,
    };

    const commitResult = await this.commitBooking(commitPayload, outcome.response);
    return commitResult;
  }

  async updateWithEnforcement(
    existing: ExistingBookingRecord,
    input: BookingInput,
    ctx: ValidationContext,
  ): Promise<BookingCommitSuccess> {
    const outcome = await this.runValidation(
      {
        ...input,
        bookingId: existing.id,
        restaurantId: existing.restaurant_id,
      },
      ctx,
      {
        existingBooking: existing,
        checkCapacity: false,
      },
    );

    if (!outcome.ok) {
      throw new BookingValidationError(outcome.response);
    }

    const { metadata } = outcome;
    const { bookingType, bookingDate, startTime, endTime } = metadata;

    const legacyClientRequestId =
      typeof (existing as Record<string, unknown>).client_request_id === "string"
        ? ((existing as Record<string, unknown>).client_request_id as string)
        : null;
    const clientRequestId = this.extractClientRequestId(ctx, legacyClientRequestId);

    const commitPayload: CapacityCommitInput = {
      restaurantId: existing.restaurant_id,
      bookingDate,
      startTime,
      endTime,
      partySize: input.partySize,
      bookingType,
      seatingPreference: input.seatingPreference ?? existing.seating_preference ?? null,
      customerId: input.customerId ?? existing.customer_id ?? null,
      customerName: input.customerName ?? existing.customer_name ?? null,
      customerEmail: input.customerEmail ?? existing.customer_email ?? null,
      customerPhone: input.customerPhone ?? existing.customer_phone ?? null,
      notes: input.notes ?? existing.notes ?? null,
      marketingOptIn: input.marketingOptIn ?? existing.marketing_opt_in ?? undefined,
      source: input.source ?? existing.source ?? null,
      loyaltyPointsAwarded: input.loyaltyPointsAwarded ?? existing.loyalty_points_awarded ?? null,
      idempotencyKey: input.idempotencyKey ?? existing.idempotency_key ?? null,
      authUserId: ctx.actorId ?? null,
      clientRequestId,
    };

    const commitResult = await this.commitBooking(commitPayload, outcome.response, existing.id);
    return commitResult;
  }

  private async commitBooking(
    payload: CapacityCommitInput,
    validationResponse: BookingValidationResponse & { ok: true },
    bookingId?: string,
  ): Promise<BookingCommitSuccess> {
    const commitResult: CapacityCommitResult = bookingId
      ? await this.capacityService.updateBooking({ ...payload, bookingId })
      : await this.capacityService.createBooking(payload);

    if (!commitResult.success || !commitResult.booking) {
      const code = mapCapacityErrorCode(commitResult.originalResult?.error);
      const issue: BookingError = {
        code,
        message:
          code === "CAPACITY_EXCEEDED"
            ? "No capacity available for the requested time."
            : "Unable to complete booking due to capacity constraints.",
        detail: commitResult.details ?? commitResult.originalResult?.details ?? undefined,
        overridable: false,
      };
      throw new BookingValidationError({
        ok: false,
        issues: [issue],
      });
    }

    return {
      booking: commitResult.booking,
      response: validationResponse,
      duplicate: commitResult.duplicate ?? false,
    };
  }

  private async runValidation(
    input: BookingInput,
    ctx: ValidationContext,
    options: ValidationOptions,
  ): Promise<CoreValidationOutcome> {
    const issues: BookingError[] = [];
    let scheduleDate: string | null = null;
    let normalizedStartDateTime: DateTime | null = null;
    let normalizedEndDateTime: DateTime | null = null;
    let normalizedStartTime: string | null = null;
    let normalizedEndTime: string | null = null;
    let scheduleTimezone: string | null = null;
    let schedule;

    const startDateTime = DateTime.fromISO(input.start, { zone: ctx.tz });
    if (!startDateTime.isValid) {
      issues.push(this.createError("UNKNOWN", "Invalid start time provided.", { value: input.start }, false));
      return this.buildFailure(issues, input, ctx, options);
    }

    scheduleDate = startDateTime.toISODate();
    if (!scheduleDate) {
      issues.push(this.createError("UNKNOWN", "Unable to derive booking date from start time.", {}, false));
      return this.buildFailure(issues, input, ctx, options);
    }

    const startTime = startDateTime.toFormat("HH:mm");
    const bookingType = this.resolveBookingType(input, startTime);

    try {
      schedule = await this.scheduleRepo.getSchedule({
        restaurantId: input.restaurantId,
        date: scheduleDate,
      });
    } catch (error) {
      this.logger.error("Failed to load schedule for validation", {
        restaurantId: input.restaurantId,
        date: scheduleDate,
        error: error instanceof Error ? error.message : String(error),
      });
      issues.push(
        this.createError(
          "UNKNOWN",
          "Unable to load schedule for validation. Please try again later.",
          { restaurantId: input.restaurantId, date: scheduleDate },
          false,
        ),
      );
      return this.buildFailure(issues, input, ctx, options);
    }

    scheduleTimezone = schedule.timezone ?? ctx.tz;
    const evaluationNow = DateTime.fromJSDate(this.time.now(), { zone: scheduleTimezone });

    if (schedule.isClosed) {
      issues.push(
        this.createError(
          "CLOSED_DATE",
          "The restaurant is closed on the selected date.",
          { date: scheduleDate },
          true,
          "warning",
        ),
      );
    }

    try {
      const { time: normalizedTime } = assertBookingWithinOperatingWindow({
        schedule,
        requestedTime: startTime,
        bookingType,
      });

      normalizedStartTime = normalizedTime;
      normalizedStartDateTime = DateTime.fromISO(`${scheduleDate}T${normalizedTime}`, { zone: scheduleTimezone });
    } catch (error) {
        if (error instanceof OperatingHoursError) {
          const mapped = this.mapOperatingHoursError(error, scheduleDate, startTime);
          issues.push(mapped);
        } else {
          this.logger.error("Unexpected error during operating hours validation", {
          error: error instanceof Error ? error.message : String(error),
        });
        issues.push(this.createError("UNKNOWN", "Unable to validate operating hours.", undefined, false));
      }
    }

    if (!normalizedStartDateTime || !normalizedStartTime) {
      return this.buildFailure(issues, input, ctx, options);
    }

    const slot = schedule.slots.find((entry) => entry.value === normalizedStartTime);
    if (slot?.disabled) {
      issues.push(
        this.createError(
          "SERVICE_PERIOD",
          "Selected time is not available for reservations.",
          {
            slot: normalizedStartTime,
            reason: "disabled_slot",
          },
          true,
        ),
      );
    }

    if (input.serviceId && slot && slot.bookingOption && input.serviceId !== slot.bookingOption) {
      issues.push(
        this.createError(
          "SERVICE_PERIOD",
          "Selected time is not part of the requested service.",
          {
            requestedService: input.serviceId,
            slotService: slot.bookingOption,
          },
          true,
        ),
      );
    }

    if (input.durationMinutes <= 0) {
      issues.push(
        this.createError(
          "INVALID_DURATION",
          "Duration must be greater than zero.",
          { durationMinutes: input.durationMinutes },
          false,
        ),
      );
    }

    normalizedEndDateTime = normalizedStartDateTime.plus({ minutes: input.durationMinutes });
    normalizedEndTime = normalizedEndDateTime.toFormat("HH:mm");

    const windowClose = schedule.window?.closesAt;
    if (windowClose) {
      const closeMinutes = this.toMinutes(windowClose);
      const endMinutes = this.toMinutes(normalizedEndTime);
      if (endMinutes > closeMinutes) {
        issues.push(
          this.createError(
            "OUTSIDE_HOURS",
            "Selected duration extends beyond closing hours.",
            {
              closesAt: windowClose,
              endTime: normalizedEndTime,
            },
            true,
          ),
        );
      }
    }

    if (ctx.flags.bookingPastTimeBlocking) {
      try {
        assertBookingNotInPast(scheduleTimezone, scheduleDate, normalizedStartTime, {
          graceMinutes: ctx.flags.bookingPastTimeGraceMinutes,
          allowOverride: false,
          actorRole: null,
        });
      } catch (error) {
        if (error instanceof PastBookingError) {
          issues.push(
            this.createError(
              "PAST_TIME",
              error.message,
              error.details ?? {
                bookingTime: normalizedStartTime,
                timezone: scheduleTimezone,
              },
              true,
            ),
          );
        } else {
          this.logger.error("Unexpected error during past-time validation", {
            error: error instanceof Error ? error.message : String(error),
          });
          issues.push(this.createError("UNKNOWN", "Unable to validate booking time.", undefined, false));
        }
      }
    }

    if (options.checkCapacity && issues.length === 0) {
      const capacityResult = await this.capacityService.checkAvailability({
        restaurantId: input.restaurantId,
        bookingDate: scheduleDate,
        startTime: normalizedStartTime,
        endTime: normalizedEndTime,
        partySize: input.partySize,
        bookingId: options.existingBooking?.id ?? input.bookingId,
      });

      if (!capacityResult.ok) {
        issues.push(
          this.createError(
            capacityResult.errorCode ?? "CAPACITY_EXCEEDED",
            "No capacity available for the requested time.",
            capacityResult.detail,
            true,
          ),
        );
      }
    }

    const overrideResolution = this.resolveOverride(issues, input, ctx);
    if (!overrideResolution.ok) {
      return this.buildFailure(overrideResolution.updatedIssues, input, ctx, options);
    }

    const normalizedStartIso = normalizedStartDateTime.toISO();
    const normalizedEndIso = normalizedEndDateTime.toISO();

    if (!normalizedStartIso || !normalizedEndIso) {
      const response = this.createError("UNKNOWN", "Failed to normalize booking time.", undefined, false);
      issues.push(response);
      return this.buildFailure(issues, input, ctx, options);
    }

    if (!normalizedStartTime || !normalizedEndTime) {
      issues.push(this.createError("UNKNOWN", "Failed to normalize booking time.", undefined, false));
      return this.buildFailure(issues, input, ctx, options);
    }

    const evaluatedAtIso = evaluationNow.toISO() ?? new Date().toISOString();

    const metadata: ValidationSuccessMetadata = {
      schedule,
      normalizedStart: normalizedStartIso,
      normalizedEnd: normalizedEndIso,
      bookingDate: scheduleDate,
      startTime: normalizedStartTime,
      endTime: normalizedEndTime,
      bookingType,
      overrideApplied: overrideResolution.overridden,
      overrideCodes: overrideResolution.overrideCodes,
      evaluatedAt: evaluatedAtIso,
    };

    const response: BookingValidationResponse & { ok: true } = {
      ok: true,
      issues: overrideResolution.updatedIssues,
      overridden: overrideResolution.overridden || undefined,
      overrideCodes: overrideResolution.overrideCodes.length > 0 ? overrideResolution.overrideCodes : undefined,
      normalizedStart: metadata.normalizedStart,
      normalizedEnd: metadata.normalizedEnd,
    };

    return {
      ok: true,
      response,
      metadata,
    };
  }

  private resolveOverride(issues: BookingError[], input: BookingInput, ctx: ValidationContext): OverrideResolution {
    if (issues.length === 0) {
      return {
        ok: true,
        overridden: false,
        updatedIssues: issues,
        overrideCodes: [],
      };
    }

    const nonOverridable = issues.filter((issue) => issue.overridable === false);
    if (nonOverridable.length > 0) {
      return {
        ok: false,
        overridden: false,
        updatedIssues: issues,
        overrideCodes: [],
      };
    }

    const overrideRequest = input.override;
    const wantsOverride = overrideRequest?.apply === true;
    if (!wantsOverride) {
      return {
        ok: false,
        overridden: false,
        updatedIssues: issues,
        overrideCodes: [],
      };
    }

    const hasCapability = ctx.actorCapabilities?.includes(BOOKING_OVERRIDE_CAPABILITY) ?? false;
    if (!hasCapability) {
      const updated = [
        ...issues,
        this.createError(
          "MISSING_OVERRIDE",
          "Override capability is required to bypass booking validation rules.",
          { capability: BOOKING_OVERRIDE_CAPABILITY },
          false,
        ),
      ];
      return {
        ok: false,
        overridden: false,
        updatedIssues: updated,
        overrideCodes: [],
      };
    }

    const reason = overrideRequest?.reason?.trim();
    if (!reason) {
      const updated = [
        ...issues,
        this.createError("MISSING_OVERRIDE", "Override reason is required.", undefined, false),
      ];
      return {
        ok: false,
        overridden: false,
        updatedIssues: updated,
        overrideCodes: [],
      };
    }

    return {
      ok: true,
      overridden: true,
      updatedIssues: issues,
      overrideCodes: issues.map((issue) => issue.code),
    };
  }

  private buildFailure(
    issues: BookingError[],
    input: BookingInput,
    ctx: ValidationContext,
    _options: ValidationOptions,
  ): CoreValidationOutcome {
    const overrideAttempted = input.override?.apply === true;

    if (overrideAttempted) {
      this.logOverrideFailure(issues, input, ctx);
    }

    const response: BookingValidationResponse & { ok: false } = {
      ok: false,
      issues,
      overridden: undefined,
    };

    return {
      ok: false,
      response,
      metadata: {
        overrideAttempted,
      },
    };
  }

  private createError(
    code: BookingErrorCode,
    message: string,
    detail?: Record<string, unknown>,
    overridable: boolean = true,
    severity: BookingErrorSeverity = "error",
  ): BookingError {
    return {
      code,
      message,
      detail,
      overridable,
      severity,
    };
  }

  private mapOperatingHoursError(
    error: OperatingHoursError,
    bookingDate: string,
    requestedTime: string,
  ): BookingError {
    const detail = {
      bookingDate,
      requestedTime,
      reason: error.reason,
    };

    switch (error.reason) {
      case "CLOSED":
        return this.createError("CLOSED_DATE", error.message, detail, true, "warning");
      case "OUTSIDE_WINDOW":
      case "AFTER_CLOSE":
        return this.createError("OUTSIDE_HOURS", error.message, detail, true);
      case "INVALID_TIME":
      default:
        return this.createError("UNKNOWN", error.message, detail, false);
    }
  }

  private resolveBookingType(input: BookingInput, startTime: string): BookingType {
    if (input.bookingType && isBookingType(input.bookingType)) {
      return input.bookingType;
    }
    if (input.serviceId && isBookingType(input.serviceId as BookingType)) {
      return input.serviceId as BookingType;
    }
    return inferMealTypeFromTime(startTime);
  }

  private toMinutes(value: string | null | undefined): number {
    if (!value) {
      return 0;
    }
    const [hoursPart = "0", minutesPart = "0"] = value.split(":");
    const hours = Number.parseInt(hoursPart, 10) || 0;
    const minutes = Number.parseInt(minutesPart, 10) || 0;
    return hours * 60 + minutes;
  }

  private logOverrideFailure(issues: BookingError[], input: BookingInput, ctx: ValidationContext) {
    recordObservabilityEvent({
      source: "booking.validation",
      eventType: "booking.override.rejected",
      severity: "warning",
      context: {
        restaurantId: input.restaurantId,
        bookingId: input.bookingId ?? null,
        actorId: ctx.actorId,
        issues: issues.map((issue) => issue.code),
      },
    }).catch((error) => {
      this.logger.warn("Failed to record override rejection event", {
        error: error instanceof Error ? error.message : String(error),
      });
    });
  }

  private extractClientRequestId(ctx: ValidationContext, fallback?: unknown): string | null {
    const directValue =
      ctx.metadata && typeof (ctx.metadata as Record<string, unknown>)["clientRequestId"] === "string"
        ? ((ctx.metadata as Record<string, unknown>)["clientRequestId"] as string)
        : null;
    if (directValue && directValue.trim().length > 0) {
      return directValue.trim();
    }
    if (typeof fallback === "string" && fallback.trim().length > 0) {
      return fallback.trim();
    }
    return null;
  }
}
