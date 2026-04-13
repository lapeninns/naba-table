import { describe, expect, it } from "vitest";

import {
  derivePlanDateAdvisory,
  PLAN_DATE_ADVISORY_COPY,
} from "@features/reservations/wizard/hooks/usePlanStepForm";

describe("derivePlanDateAdvisory", () => {
  it("shows the advisory for weekend dates", () => {
    expect(derivePlanDateAdvisory("2026-04-18", [])).toBe(PLAN_DATE_ADVISORY_COPY);
  });

  it("shows the advisory for override dates even on weekdays", () => {
    expect(derivePlanDateAdvisory("2026-04-15", ["2026-04-15"])).toBe(
      PLAN_DATE_ADVISORY_COPY,
    );
  });

  it("stays quiet for ordinary weekday dates", () => {
    expect(derivePlanDateAdvisory("2026-04-14", [])).toBeNull();
  });
});
