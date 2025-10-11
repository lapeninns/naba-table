import { describe, expect, it } from "vitest";

import { generateBookingReference } from "@/server/booking-reference";

const REFERENCE_REGEX = /^[A-Z0-9]{10}$/;

describe("generateBookingReference", () => {
  it("returns 10 character uppercase strings", () => {
    const reference = generateBookingReference();
    expect(reference).toHaveLength(10);
    expect(reference).toMatch(REFERENCE_REGEX);
  });

  it("produces diverse values across samples", () => {
    const samples = new Set<string>();
    for (let index = 0; index < 1000; index += 1) {
      const reference = generateBookingReference();
      expect(reference).toMatch(REFERENCE_REGEX);
      samples.add(reference);
    }

    expect(samples.size).toBeGreaterThan(990);
  });
});
