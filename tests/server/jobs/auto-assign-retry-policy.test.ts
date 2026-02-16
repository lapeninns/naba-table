import { describe, expect, it } from "vitest";

import { ensureMinimumAttemptsForDeferredHardStop, shouldDeferHardStop } from "@/server/jobs/auto-assign-retry-policy";

describe("auto-assign hard-stop retry policy", () => {
  it("defers first hard stop for no_tables", () => {
    expect(
      shouldDeferHardStop(
        {
          category: "hard",
          code: "hard.no_tables",
        },
        0,
      ),
    ).toBe(true);
  });

  it("defers first hard stop for no_suitable_tables", () => {
    expect(
      shouldDeferHardStop(
        {
          category: "hard",
          code: "hard.no_suitable_tables",
        },
        0,
      ),
    ).toBe(true);
  });

  it("does not defer after the first attempt", () => {
    expect(
      shouldDeferHardStop(
        {
          category: "hard",
          code: "hard.no_tables",
        },
        1,
      ),
    ).toBe(false);
  });

  it("does not defer other hard failures", () => {
    expect(
      shouldDeferHardStop(
        {
          category: "hard",
          code: "hard.insufficient_capacity",
        },
        0,
      ),
    ).toBe(false);
  });

  it("does not defer non-hard failures", () => {
    expect(
      shouldDeferHardStop(
        {
          category: "transient",
          code: "transient.timeout",
        },
        0,
      ),
    ).toBe(false);
  });

  it("enforces at least two attempts when deferred", () => {
    expect(ensureMinimumAttemptsForDeferredHardStop(1)).toBe(2);
    expect(ensureMinimumAttemptsForDeferredHardStop(2)).toBe(2);
    expect(ensureMinimumAttemptsForDeferredHardStop(5)).toBe(5);
  });
});
