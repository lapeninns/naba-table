import { describe, expect, it } from "vitest";

import { toIsoDateParam } from "@/hooks/ops/utils/toIsoDateParam";

describe("toIsoDateParam", () => {
  it("returns null for nullish input", () => {
    expect(toIsoDateParam(null)).toBeNull();
    expect(toIsoDateParam(undefined)).toBeNull();
  });

  it("returns YYYY-MM-DD for Date input", () => {
    const date = new Date("2025-10-27T11:18:04.221Z");
    expect(toIsoDateParam(date)).toBe("2025-10-27");
  });

  it("passes through existing YYYY-MM-DD strings", () => {
    expect(toIsoDateParam("2025-10-27")).toBe("2025-10-27");
  });

  it("normalizes ISO strings with time component", () => {
    expect(toIsoDateParam("2025-10-27T11:18:04.221Z")).toBe("2025-10-27");
  });

  it("returns null for invalid inputs", () => {
    expect(toIsoDateParam("not-a-date")).toBeNull();
    expect(toIsoDateParam("2025-13-40")).toBeNull();
  });
});
