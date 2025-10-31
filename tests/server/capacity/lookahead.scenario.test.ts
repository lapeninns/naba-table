import { DateTime } from "luxon";
import { afterEach, describe, expect, it } from "vitest";

import { bandDuration, getBufferConfig, getSelectorScoringConfig, getVenuePolicy } from "@/server/capacity/policy";
import { buildScoredTablePlans } from "@/server/capacity/selector";
import { resetStrategicConfigTestOverrides } from "@/server/capacity/strategic-config";
import { evaluateLookahead, type BookingWindow, type Table } from "@/server/capacity/tables";
import { getSelectorPlannerLimits } from "@/server/feature-flags";

describe("lookahead future conflict penalty", () => {
  afterEach(() => {
    resetStrategicConfigTestOverrides();
  });

  it("penalizes plans that consume future-booked rare tables", () => {
    const policy = getVenuePolicy();
    const selectorLimits = getSelectorPlannerLimits();
    const scoringConfig = getSelectorScoringConfig();

    const dinnerStart = DateTime.fromISO("2025-11-01T19:45:00", { zone: policy.timezone });
    const durationMinutes = bandDuration("dinner", 6, policy);
    const buffer = getBufferConfig("dinner", policy);
    const diningEnd = dinnerStart.plus({ minutes: durationMinutes });
    const blockStart = dinnerStart.minus({ minutes: buffer.pre ?? 0 });
    const blockEnd = diningEnd.plus({ minutes: buffer.post ?? 0 });

    const bookingWindow: BookingWindow = {
      service: "dinner",
      durationMinutes,
      dining: {
        start: dinnerStart,
        end: diningEnd,
      },
      block: {
        start: blockStart,
        end: blockEnd,
      },
    };

    const sixTop: Table = {
      id: "table-6",
      tableNumber: "T6",
      capacity: 6,
      minPartySize: 2,
      maxPartySize: 6,
      section: "Main",
      category: "standard",
      seatingType: "standard",
      mobility: "fixed",
      zoneId: "zone-main",
      status: "available",
      active: true,
      position: null,
    };

    const eightTop: Table = {
      id: "table-8",
      tableNumber: "T8",
      capacity: 8,
      minPartySize: 4,
      maxPartySize: 8,
      section: "Window",
      category: "premium",
      seatingType: "standard",
      mobility: "fixed",
      zoneId: "zone-main",
      status: "available",
      active: true,
      position: null,
    };

    const tables: Table[] = [sixTop, eightTop];
    const adjacency = new Map<string, Set<string>>();
    const tableScarcityScores = new Map<string, number>([
      [sixTop.id, 0.2],
      [eightTop.id, 0.8],
    ]);

    const plansResult = buildScoredTablePlans({
      tables,
      partySize: 6,
      adjacency,
      config: scoringConfig,
      tableScarcityScores,
    });

    const futureBookingStart = dinnerStart.plus({ minutes: 15 });
    const futureDuration = bandDuration("dinner", 8, policy);
    const futureEnd = futureBookingStart.plus({ minutes: futureDuration });

    const contextBookings = [
      {
        id: "future-eight",
        party_size: 8,
        status: "confirmed",
        start_time: futureBookingStart.toFormat("HH:mm"),
        end_time: futureEnd.toFormat("HH:mm"),
        start_at: futureBookingStart.toUTC().toISO(),
        end_at: futureEnd.toUTC().toISO(),
        booking_date: futureBookingStart.toISODate(),
        seating_preference: null,
        booking_table_assignments: [],
      },
    ];

    const lookaheadDiagnostics = evaluateLookahead({
      lookahead: {
        enabled: true,
        windowMinutes: 120,
        penaltyWeight: 500,
      },
      bookingId: "booking-6",
      bookingWindow,
      plansResult,
      tables,
      adjacency,
      zoneId: null,
      policy,
      contextBookings,
      holds: [],
      combinationEnabled: false,
      combinationLimit: tables.length,
      selectorLimits,
      scoringConfig,
    });

    expect(lookaheadDiagnostics.penalizedPlans).toBeGreaterThan(0);
    const penalizedPlan = plansResult.plans.find((plan) => plan.tables.some((table) => table.id === eightTop.id));
    expect(penalizedPlan).toBeDefined();
    expect(penalizedPlan?.scoreBreakdown.futureConflictPenalty ?? 0).toBeGreaterThan(0);
    expect(lookaheadDiagnostics.conflicts.some((conflict) => conflict.bookingId === "future-eight")).toBe(true);
  });
});
