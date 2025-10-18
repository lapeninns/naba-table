import { beforeAll, describe, expect, it, vi } from "vitest";

import { getVenuePolicy, ServiceOverrunError } from "@/server/capacity/policy";

let computeBookingWindow: any;
let windowsOverlap: any;

vi.stubEnv("BASE_URL", "http://localhost:3000");
vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "http://localhost:54321");
vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "test-anon-key");
vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "test-service-role-key");

beforeAll(async () => {
  const tablesModule = await import("@/server/capacity/tables");
  computeBookingWindow = tablesModule.__internal.computeBookingWindow;
  windowsOverlap = tablesModule.__internal.windowsOverlap;
});

describe("computeBookingWindow & overlap handling", () => {
  const policy = getVenuePolicy({ timezone: "Europe/London" });

  it("throws when dinner reservation for eight would exceed service close", () => {
    expect(() =>
      computeBookingWindow({
        startISO: "2025-05-10T21:00:00+01:00",
        partySize: 8,
        policy,
      }),
    ).toThrow(ServiceOverrunError);
  });

  it("flags overlap when 15 minute post-buffer is violated", () => {
    const first = computeBookingWindow({
      startISO: "2025-05-10T12:00:00+01:00",
      partySize: 2,
      policy,
    });
    const second = computeBookingWindow({
      startISO: "2025-05-10T13:04:00+01:00",
      partySize: 2,
      policy,
    });

    expect(first).not.toBeNull();
    expect(second).not.toBeNull();

    const firstInterval = {
      start: first!.block.start.toMillis(),
      end: first!.block.end.toMillis(),
    };
    const secondInterval = {
      start: second!.block.start.toMillis(),
      end: second!.block.end.toMillis(),
    };

    expect(windowsOverlap(firstInterval, secondInterval)).toBe(true);
  });

  it("allows bookings when buffer is respected", () => {
    const first = computeBookingWindow({
      startISO: "2025-05-10T12:00:00+01:00",
      partySize: 2,
      policy,
    });
    const second = computeBookingWindow({
      startISO: "2025-05-10T13:10:00+01:00",
      partySize: 2,
      policy,
    });

    expect(first).not.toBeNull();
    expect(second).not.toBeNull();

    const firstInterval = {
      start: first!.block.start.toMillis(),
      end: first!.block.end.toMillis(),
    };
    const secondInterval = {
      start: second!.block.start.toMillis(),
      end: second!.block.end.toMillis(),
    };

    expect(windowsOverlap(firstInterval, secondInterval)).toBe(false);
  });

  it("constructs window from booking_date + start_time when ISO is absent", () => {
    const window = computeBookingWindow({
      startISO: null,
      bookingDate: "2025-05-10",
      startTime: "12:30",
      partySize: 2,
      policy,
    });

    expect(window).not.toBeNull();
    expect(window!.dining.start.toFormat("HH:mm")).toBe("12:30");
    expect(window!.dining.end.toFormat("HH:mm")).toBe("13:30");
  });
});
