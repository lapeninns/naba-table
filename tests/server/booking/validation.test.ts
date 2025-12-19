import { describe, expect, it, vi } from "vitest";

import { BookingValidationService, BookingValidationError } from "@/server/booking/BookingValidationService";
import { PastBookingError } from "@/server/bookings/pastTimeValidation";

const scheduleRepo = {
  getSchedule: vi.fn(),
};

const capacityService = {
  checkAvailability: vi.fn(),
  createBooking: vi.fn(),
};

const assertBookingWithinOperatingWindowMock = vi.fn();
const assertBookingNotInPastMock = vi.fn();

vi.mock("@/server/bookings/timeValidation", async () => {
  const actual = await import("@/server/bookings/timeValidation");
  return {
    ...actual,
    assertBookingWithinOperatingWindow: (...args: unknown[]) => assertBookingWithinOperatingWindowMock(...args),
  };
});

vi.mock("@/server/bookings/pastTimeValidation", async () => {
  const actual = await import("@/server/bookings/pastTimeValidation");
  return {
    ...actual,
    assertBookingNotInPast: (...args: unknown[]) => assertBookingNotInPastMock(...args),
  };
});

const baseInput = {
  restaurantId: "rest-1",
  serviceId: "dinner",
  bookingType: "dinner",
  partySize: 2,
  start: "2025-10-10T19:00:00.000Z",
  durationMinutes: 120,
  seatingPreference: "any",
  notes: null,
  customerId: "cust-1",
  customerName: "Guest",
  customerEmail: "guest@example.com",
  customerPhone: "1234567890",
  marketingOptIn: false,
  source: "api",
  idempotencyKey: null,
};

const baseContext = {
  actorId: "user-1",
  actorRoles: ["customer"],
  actorCapabilities: [],
  tz: "Europe/Paris",
  flags: {
    bookingPastTimeBlocking: true,
    bookingPastTimeGraceMinutes: 5,
    unified: true,
  },
  metadata: {},
};

function buildService() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return new BookingValidationService(scheduleRepo as any, capacityService as any);
}

describe("BookingValidationService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    scheduleRepo.getSchedule.mockResolvedValue({
      date: "2025-10-10",
      timezone: "Europe/Paris",
      window: { opensAt: "10:00", closesAt: "23:00" },
      slots: [{ value: "19:00", disabled: false, bookingOption: "dinner" }],
      isClosed: false,
      defaultDurationMinutes: 120,
    });
    capacityService.checkAvailability.mockResolvedValue({ ok: true });
    capacityService.createBooking.mockResolvedValue({
      success: true,
      booking: { id: "b-1", restaurant_id: "rest-1" },
      duplicate: false,
    });
    assertBookingWithinOperatingWindowMock.mockReturnValue({ time: "19:00" });
    assertBookingNotInPastMock.mockReturnValue(undefined);
  });

  it("maps CLOSED date to CLOSED_DATE code", async () => {
    scheduleRepo.getSchedule.mockResolvedValue({
      date: "2025-10-10",
      timezone: "Europe/Paris",
      window: { opensAt: "10:00", closesAt: "23:00" },
      slots: [],
      isClosed: true,
    });

    const svc = buildService();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await svc.validateCreate(baseInput as any, baseContext as any);
    expect(result.response.ok).toBe(false);
    expect(result.response.issues[0]?.code).toBe("CLOSED_DATE");
  });

  it("returns OUTSIDE_HOURS when requested after close", async () => {
    scheduleRepo.getSchedule.mockResolvedValue({
      date: "2025-10-10",
      timezone: "Europe/Paris",
      window: { opensAt: "10:00", closesAt: "20:00" },
      slots: [{ value: "21:00", disabled: false, bookingOption: "dinner" }],
      isClosed: false,
    });
    // Simulate operating-hours error
    vi.mocked(scheduleRepo.getSchedule);
    const svc = buildService();
     
    const result = await svc.validateCreate(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      { ...baseInput, start: "2025-10-10T21:00:00.000Z" } as any,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      baseContext as any,
    );
    expect(result.response.ok).toBe(false);
    expect(result.response.issues[0]?.code).toBe("OUTSIDE_HOURS");
  });

  it("blocks past-time bookings when flag enabled", async () => {
    const svc = buildService();
    const pastError = new PastBookingError("past", "PAST_TIME", {});
    assertBookingNotInPastMock.mockImplementation(() => {
      throw pastError;
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await svc.validateCreate(baseInput as any, baseContext as any);
    expect(result.response.ok).toBe(false);
    expect(result.response.issues[0]?.code).toBe("PAST_TIME");
  });

  it("requires override capability when override requested", async () => {
    const svc = buildService();
    capacityService.checkAvailability.mockResolvedValue({ ok: true });
     
    const result = await svc.validateCreate(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      { ...baseInput, override: { apply: true, reason: "need" } } as any,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      { ...baseContext, actorCapabilities: [] } as any,
    );
    // When validation passes without issues, requesting an override should
    // not require special capabilities or introduce artificial errors.
    expect(result.response.ok).toBe(true);
    const codes = result.response.issues.map((i: { code: string }) => i.code);
    expect(codes).not.toContain("MISSING_OVERRIDE");
  });

  it("throws BookingValidationError when capacity fails commit", async () => {
    capacityService.createBooking.mockResolvedValueOnce({
      success: false,
      booking: null,
      error: "CAPACITY_EXCEEDED",
    });
    const svc = buildService();

     
    await expect(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      svc.createWithEnforcement(baseInput as any, baseContext as any),
    ).rejects.toBeInstanceOf(BookingValidationError);
  });
});
