import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  assertBookingNotInPast,
  canOverridePastBooking,
  getCurrentTimeInTimezone,
  PastBookingError,
} from "@/server/bookings/pastTimeValidation";

describe("pastTimeValidation", () => {
  describe("getCurrentTimeInTimezone", () => {
    it("should return current time in specified timezone", () => {
      const result = getCurrentTimeInTimezone("America/New_York");
      expect(result).toBeInstanceOf(Date);
      expect(result.getTime()).toBeLessThanOrEqual(Date.now());
    });

    it("should handle different timezones", () => {
      const nyTime = getCurrentTimeInTimezone("America/New_York");
      const laTime = getCurrentTimeInTimezone("America/Los_Angeles");
      const tokyoTime = getCurrentTimeInTimezone("Asia/Tokyo");

      // All should be valid dates
      expect(nyTime).toBeInstanceOf(Date);
      expect(laTime).toBeInstanceOf(Date);
      expect(tokyoTime).toBeInstanceOf(Date);
    });

    it("should throw on invalid timezone", () => {
      expect(() => getCurrentTimeInTimezone("Invalid/Timezone")).toThrow();
    });
  });

  describe("canOverridePastBooking", () => {
    it("should return true for owner role", () => {
      expect(canOverridePastBooking("owner")).toBe(true);
    });

    it("should return true for manager role", () => {
      expect(canOverridePastBooking("manager")).toBe(true);
    });

    it("should return false for host role", () => {
      expect(canOverridePastBooking("host")).toBe(false);
    });

    it("should return false for server role", () => {
      expect(canOverridePastBooking("server")).toBe(false);
    });

    it("should return false for null role", () => {
      expect(canOverridePastBooking(null)).toBe(false);
    });

    it("should return false for undefined role", () => {
      expect(canOverridePastBooking(undefined)).toBe(false);
    });
  });

  describe("assertBookingNotInPast", () => {
    beforeEach(() => {
      // Mock Date.now() to a fixed time for consistent tests
      vi.useFakeTimers();
      // Set to 2025-01-15 14:00:00 UTC
      vi.setSystemTime(new Date("2025-01-15T14:00:00Z"));
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    describe("future bookings", () => {
      it("should pass for booking 1 hour in future", () => {
        // Current time: 14:00 UTC = 09:00 EST
        // Booking time: 10:00 EST (1 hour in future)
        expect(() =>
          assertBookingNotInPast("America/New_York", "2025-01-15", "10:00")
        ).not.toThrow();
      });

      it("should pass for booking tomorrow", () => {
        expect(() =>
          assertBookingNotInPast("America/New_York", "2025-01-16", "09:00")
        ).not.toThrow();
      });

      it("should pass for booking 1 week in future", () => {
        expect(() =>
          assertBookingNotInPast("America/New_York", "2025-01-22", "14:00")
        ).not.toThrow();
      });
    });

    describe("grace period boundary", () => {
      it("should pass for booking exactly at grace boundary (5 min ago)", () => {
        // Current: 09:00 EST, Booking: 08:55 EST (5 min ago, exactly at boundary)
        expect(() =>
          assertBookingNotInPast("America/New_York", "2025-01-15", "08:55", { graceMinutes: 5 })
        ).not.toThrow();
      });

      it("should pass for booking 4 minutes ago (within grace)", () => {
        expect(() =>
          assertBookingNotInPast("America/New_York", "2025-01-15", "08:56", { graceMinutes: 5 })
        ).not.toThrow();
      });

      it("should fail for booking 6 minutes ago (past grace)", () => {
        expect(() =>
          assertBookingNotInPast("America/New_York", "2025-01-15", "08:54", { graceMinutes: 5 })
        ).toThrow(PastBookingError);
      });

      it("should pass with grace period = 0 for current time", () => {
        expect(() =>
          assertBookingNotInPast("America/New_York", "2025-01-15", "09:00", { graceMinutes: 0 })
        ).not.toThrow();
      });

      it("should fail with grace period = 0 for 1 minute ago", () => {
        expect(() =>
          assertBookingNotInPast("America/New_York", "2025-01-15", "08:59", { graceMinutes: 0 })
        ).toThrow(PastBookingError);
      });

      it("should pass with grace period = 60 for 59 minutes ago", () => {
        expect(() =>
          assertBookingNotInPast("America/New_York", "2025-01-15", "08:01", { graceMinutes: 60 })
        ).not.toThrow();
      });
    });

    describe("past bookings", () => {
      it("should throw for booking 1 hour ago", () => {
        expect(() =>
          assertBookingNotInPast("America/New_York", "2025-01-15", "08:00")
        ).toThrow(PastBookingError);
      });

      it("should throw for booking yesterday", () => {
        expect(() =>
          assertBookingNotInPast("America/New_York", "2025-01-14", "14:00")
        ).toThrow(PastBookingError);
      });

      it("should throw for booking 1 week ago", () => {
        expect(() =>
          assertBookingNotInPast("America/New_York", "2025-01-08", "14:00")
        ).toThrow(PastBookingError);
      });

      it("should include correct error details", () => {
        try {
          assertBookingNotInPast("America/New_York", "2025-01-15", "08:00");
          expect.fail("Should have thrown");
        } catch (error) {
          expect(error).toBeInstanceOf(PastBookingError);
          if (error instanceof PastBookingError) {
            expect(error.code).toBe("BOOKING_IN_PAST");
            expect(error.details.timezone).toBe("America/New_York");
            expect(error.details.gracePeriodMinutes).toBe(5);
            expect(error.details.timeDeltaMinutes).toBeLessThan(-5);
            expect(error.details.bookingTime).toContain("2025-01-15");
            expect(error.details.serverTime).toContain("2025-01-15");
          }
        }
      });
    });

    describe("admin override", () => {
      it("should allow past booking with owner role and allowOverride", () => {
        expect(() =>
          assertBookingNotInPast("America/New_York", "2025-01-14", "12:00", {
            allowOverride: true,
            actorRole: "owner",
          })
        ).not.toThrow();
      });

      it("should allow past booking with manager role and allowOverride", () => {
        expect(() =>
          assertBookingNotInPast("America/New_York", "2025-01-14", "12:00", {
            allowOverride: true,
            actorRole: "manager",
          })
        ).not.toThrow();
      });

      it("should deny past booking with host role even with allowOverride", () => {
        expect(() =>
          assertBookingNotInPast("America/New_York", "2025-01-14", "12:00", {
            allowOverride: true,
            actorRole: "host",
          })
        ).toThrow(PastBookingError);
      });

      it("should deny past booking with server role even with allowOverride", () => {
        expect(() =>
          assertBookingNotInPast("America/New_York", "2025-01-14", "12:00", {
            allowOverride: true,
            actorRole: "server",
          })
        ).toThrow(PastBookingError);
      });

      it("should deny past booking with null role even with allowOverride", () => {
        expect(() =>
          assertBookingNotInPast("America/New_York", "2025-01-14", "12:00", {
            allowOverride: true,
            actorRole: null,
          })
        ).toThrow(PastBookingError);
      });

      it("should deny past booking with allowOverride false even for admin", () => {
        expect(() =>
          assertBookingNotInPast("America/New_York", "2025-01-14", "12:00", {
            allowOverride: false,
            actorRole: "owner",
          })
        ).toThrow(PastBookingError);
      });
    });

    describe("multiple timezones", () => {
      it("should work correctly for America/Los_Angeles (PST/PDT)", () => {
        // 14:00 UTC = 06:00 PST
        expect(() =>
          assertBookingNotInPast("America/Los_Angeles", "2025-01-15", "07:00")
        ).not.toThrow();

        expect(() =>
          assertBookingNotInPast("America/Los_Angeles", "2025-01-15", "05:00")
        ).toThrow(PastBookingError);
      });

      it("should work correctly for Europe/London (GMT/BST)", () => {
        // 14:00 UTC = 14:00 GMT (winter)
        expect(() =>
          assertBookingNotInPast("Europe/London", "2025-01-15", "15:00")
        ).not.toThrow();

        expect(() =>
          assertBookingNotInPast("Europe/London", "2025-01-15", "13:00")
        ).toThrow(PastBookingError);
      });

      it("should work correctly for Asia/Tokyo (JST, no DST)", () => {
        // 14:00 UTC = 23:00 JST
        expect(() =>
          assertBookingNotInPast("Asia/Tokyo", "2025-01-16", "00:00")
        ).not.toThrow();

        expect(() =>
          assertBookingNotInPast("Asia/Tokyo", "2025-01-15", "22:00")
        ).toThrow(PastBookingError);
      });

      it("should work correctly for Australia/Sydney (AEDT, southern hemisphere)", () => {
        // 14:00 UTC = 01:00 next day AEDT (summer)
        expect(() =>
          assertBookingNotInPast("Australia/Sydney", "2025-01-16", "02:00")
        ).not.toThrow();

        expect(() =>
          assertBookingNotInPast("Australia/Sydney", "2025-01-16", "00:00")
        ).toThrow(PastBookingError);
      });
    });

    describe("input validation", () => {
      it("should throw on empty timezone", () => {
        expect(() =>
          assertBookingNotInPast("", "2025-01-15", "14:00")
        ).toThrow("Restaurant timezone is required");
      });

      it("should wrap invalid timezone errors with descriptive message", () => {
        expect(() =>
          assertBookingNotInPast("Invalid/Timezone", "2025-01-15", "14:00")
        ).toThrow(/Failed to validate booking time/);
      });

      it("should throw on invalid date format", () => {
        expect(() =>
          assertBookingNotInPast("America/New_York", "2025/01/15", "14:00")
        ).toThrow("Invalid booking date format");
      });

      it("should allow HH:MM:SS format", () => {
        expect(() =>
          assertBookingNotInPast("America/New_York", "2025-01-15", "14:00:00")
        ).not.toThrow();
      });

      it("should throw on invalid time format (single digit hour)", () => {
        expect(() =>
          assertBookingNotInPast("America/New_York", "2025-01-15", "9:00")
        ).toThrow("Invalid start time format");
      });

      it("should throw on invalid time format (extra segment)", () => {
        expect(() =>
          assertBookingNotInPast("America/New_York", "2025-01-15", "14:00:00:00")
        ).toThrow("Invalid start time format");
      });
    });

    describe("DST transitions (edge cases)", () => {
      it("should handle DST spring forward (2:30 AM doesn't exist)", () => {
        // Set time to during DST transition
        vi.setSystemTime(new Date("2025-03-09T06:00:00Z")); // 01:00 EST (before DST) / 02:00 EDT (after DST)

        // 2:30 AM EST doesn't exist on this day (clock jumps from 2:00 to 3:00)
        // Booking for 10:00 AM (well in future) should pass
        expect(() =>
          assertBookingNotInPast("America/New_York", "2025-03-09", "10:00")
        ).not.toThrow();
      });

      it("should handle DST fall back (1:30 AM occurs twice)", () => {
        // Set time to during DST transition
        vi.setSystemTime(new Date("2025-11-02T06:30:00Z")); // 01:30 EST (second occurrence)

        // 1:30 AM occurs twice - once in EDT, once in EST
        // System should handle this using first occurrence
        expect(() =>
          assertBookingNotInPast("America/New_York", "2025-11-02", "02:00")
        ).not.toThrow();
      });
    });
  });
});
