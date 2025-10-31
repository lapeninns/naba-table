import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/server/observability", () => ({
  recordObservabilityEvent: vi.fn().mockResolvedValue(undefined),
}));

describe("telemetry sanitization", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("redacts emails and name fields in selector telemetry", async () => {
    const telemetry = await import("@/server/capacity/telemetry");
    const observability = await import("@/server/observability");
    const recordObservabilityEvent = vi.mocked(observability.recordObservabilityEvent);

    await telemetry.emitSelectorDecision({
      restaurantId: "rest-telemetry",
      bookingId: "booking-telemetry",
      partySize: 4,
      window: { start: "2025-11-01T19:00:00Z", end: "2025-11-01T21:00:00Z" },
      candidates: [
        {
          tableIds: ["table-1"],
          tableNumbers: ["T1"],
          totalCapacity: 4,
          tableCount: 1,
          slack: 0,
          adjacencyStatus: "single",
        },
      ],
      selected: null,
      skipReason: "Contact john.doe@example.com for details",
      durationMs: 128.75,
      featureFlags: {
        selectorScoring: true,
        opsMetrics: false,
        plannerTimePruning: false,
        adjacencyUndirected: true,
        holdsStrictConflicts: false,
        allocatorFailHard: false,
        selectorLookahead: true,
      },
      timing: {
        totalMs: 128.75,
        plannerMs: 32.12,
      },
      plannerConfig: {
        combinationEnabled: true,
        requireAdjacency: false,
        adjacencyRequiredGlobally: false,
        adjacencyMinPartySize: null,
        kMax: 2,
        bucketLimit: 50,
        evaluationLimit: 500,
        maxOverage: 2,
        maxTables: 3,
        weights: {
          overage: 5,
          tableCount: 3,
          fragmentation: 2,
          zoneBalance: 4,
          adjacencyCost: 1,
          scarcity: 22,
        },
        featureFlags: {
          selectorScoring: true,
          opsMetrics: false,
          plannerTimePruning: false,
          adjacencyUndirected: true,
          holdsStrictConflicts: false,
          allocatorFailHard: false,
          selectorLookahead: true,
        },
        serviceFallback: {
          used: false,
          service: null,
        },
        demandMultiplier: 1,
        demandRule: null,
        lookahead: {
          enabled: true,
          windowMinutes: 120,
          penaltyWeight: 500,
        },
      },
      diagnostics: {
        singlesConsidered: 1,
        combinationsEnumerated: 0,
        combinationsAccepted: 0,
        skipped: {
          capacity: 0,
          overage: 0,
          adjacency: 0,
          kmax: 0,
          zone: 0,
          limit: 0,
          bucket: 0,
        },
        limits: {
          kMax: 2,
          maxPlansPerSlack: 50,
          maxCombinationEvaluations: 500,
        },
        totals: {
          enumerated: 1,
          accepted: 1,
        },
      },
    });

    expect(recordObservabilityEvent).toHaveBeenCalledTimes(1);
    const recordedPayload = recordObservabilityEvent.mock.calls[0]?.[0];
    expect(recordedPayload).toBeDefined();
    const recordedContext = recordedPayload?.context as Record<string, unknown> | undefined;
    expect(recordedContext).toBeDefined();
    expect(recordedContext?.skipReason).toContain("[redacted-email]");
    expect(recordedContext?.skipReason).not.toMatch(/john\.doe@example\.com/);
  });

  it("scrubs hold telemetry metadata with name and email fields", async () => {
    const telemetry = await import("@/server/capacity/telemetry");
    const observability = await import("@/server/observability");
    const recordObservabilityEvent = vi.mocked(observability.recordObservabilityEvent);

    await telemetry.emitHoldConfirmed({
      holdId: "hold-san",
      bookingId: "booking-san",
      restaurantId: "rest-san",
      zoneId: "zone-a",
      tableIds: ["table-1"],
      startAt: "2025-11-01T19:00:00Z",
      endAt: "2025-11-01T21:00:00Z",
      metadata: {
        createdByName: "Alice Example",
        note: "Reach out via alice@example.com",
      },
    });

    const recordedPayload = recordObservabilityEvent.mock.calls.at(-1)?.[0];
    expect(recordedPayload).toBeDefined();
    const recordedContext = recordedPayload?.context as Record<string, unknown> | undefined;
    const metadata = recordedContext?.metadata as Record<string, unknown> | undefined;
    expect(metadata?.createdByName).toBe("[redacted]");
    expect(metadata?.note).toContain("[redacted-email]");
  });
});
