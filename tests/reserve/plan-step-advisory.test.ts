import { describe, expect, it } from "vitest";

import {
  derivePlanDateAdvisory,
  PLAN_DATE_ADVISORY_COPY,
} from "@features/reservations/wizard/hooks/usePlanStepForm";

describe("derivePlanDateAdvisory", () => {
  it("prefers the operating-hours note when one is available", () => {
    expect(
      derivePlanDateAdvisory("2026-04-18", [], " Last orders at 8:30 PM on bank holidays. "),
    ).toBe("Last orders at 8:30 PM on bank holidays.");
  });

  it("shows the operating-hours note on weekdays when one exists", () => {
    expect(
      derivePlanDateAdvisory("2026-04-14", [], "Kitchen closes early for a private event."),
    ).toBe("Kitchen closes early for a private event.");
  });

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
