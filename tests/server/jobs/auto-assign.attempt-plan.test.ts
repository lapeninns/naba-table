import { describe, expect, it } from "vitest";

import { buildAttemptPlan, type InlineContext } from "@/server/jobs/auto-assign";

function buildInlineResult(
  overrides: Partial<NonNullable<InlineContext["inlineLastResult"]>> = {},
): NonNullable<InlineContext["inlineLastResult"]> {
  return {
    source: "inline",
    lastAttemptAt: new Date().toISOString(),
    success: false,
    reason: "no capacity",
    strategy: { requireAdjacency: null, maxTables: null },
    trigger: "creation",
    ...overrides,
  };
}

function baseContext(overrides: Partial<InlineContext> = {}): InlineContext {
  return {
    inlineLastResult: null,
    inlineSummaryContext: {},
    inlineEmailAlreadySent: false,
    inlineIsRecent: false,
    ...overrides,
  };
}

describe("buildAttemptPlan", () => {
  it("keeps defaults when no inline signals are present", () => {
    const plan = buildAttemptPlan({
      inlineContext: baseContext(),
      retryPolicyV2Enabled: true,
      maxRetries: 2,
      baseStrategy: { requireAdjacency: null, maxTables: null },
    });

    expect(plan.maxAttempts).toBe(3);
    expect(plan.inlineHardFailure).toBe(false);
    expect(plan.skippedInitialAttempt).toBe(false);
    expect(plan.inlineTimeoutAdjusted).toBe(false);
    expect(plan.plannerStrategy.requireAdjacency).toBe(null);
  });

  it("clamps attempts when inline result is a hard failure under retry policy v2", () => {
    const inlineHard = buildInlineResult({ reason: "no capacity" });
    const plan = buildAttemptPlan({
      inlineContext: baseContext({ inlineLastResult: inlineHard, inlineIsRecent: true }),
      retryPolicyV2Enabled: true,
      maxRetries: 5,
      baseStrategy: { requireAdjacency: null, maxTables: null },
    });

    expect(plan.inlineHardFailure).toBe(true);
    expect(plan.maxAttempts).toBeLessThanOrEqual(2);
  });

  it("keeps the first job attempt under policy v1 even after a recent inline hard failure", () => {
    const inlineHard = buildInlineResult({ reason: "no capacity" });
    const plan = buildAttemptPlan({
      inlineContext: baseContext({ inlineLastResult: inlineHard, inlineIsRecent: true }),
      retryPolicyV2Enabled: false,
      maxRetries: 4,
      baseStrategy: { requireAdjacency: null, maxTables: null },
    });

    expect(plan.skippedInitialAttempt).toBe(false);
    expect(plan.maxAttempts).toBe(2);
  });

  it("relaxes adjacency and caps attempts when inline timed out", () => {
    const inlineTimeout = buildInlineResult({ reason: "INLINE_TIMEOUT" });
    const plan = buildAttemptPlan({
      inlineContext: baseContext({ inlineLastResult: inlineTimeout }),
      retryPolicyV2Enabled: true,
      maxRetries: 6,
      baseStrategy: { requireAdjacency: true, maxTables: null },
    });

    expect(plan.inlineTimeoutAdjusted).toBe(true);
    expect(plan.plannerStrategy.requireAdjacency).toBe(false);
    expect(plan.plannerStrategy.maxTables).toBe(4);
    expect(plan.maxAttempts).toBeLessThanOrEqual(3);
  });
});
