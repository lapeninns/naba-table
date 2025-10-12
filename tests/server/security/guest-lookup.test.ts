import { describe, expect, it } from "vitest";

import { computeGuestLookupHash } from "@/server/security/guest-lookup";

const baseInput = {
  restaurantId: "11111111-2222-3333-4444-555555555555",
  email: "Guest@example.com",
  phone: "+1 (415) 555-1212",
};

describe("computeGuestLookupHash", () => {
  it("returns a deterministic hash when pepper provided", () => {
    const hashA = computeGuestLookupHash({ ...baseInput, pepper: "secret-pepper" });
    const hashB = computeGuestLookupHash({ ...baseInput, pepper: "secret-pepper" });

    expect(hashA).toEqual(hashB);
    expect(hashA).toMatch(/^[0-9a-f]{64}$/);
  });

  it("produces distinct hashes for different contact info", () => {
    const reference = computeGuestLookupHash({ ...baseInput, pepper: "secret-pepper" });
    const differentEmail = computeGuestLookupHash({
      ...baseInput,
      email: "other@example.com",
      pepper: "secret-pepper",
    });
    const differentPhone = computeGuestLookupHash({
      ...baseInput,
      phone: "+1 212 555 1111",
      pepper: "secret-pepper",
    });

    expect(reference).not.toEqual(differentEmail);
    expect(reference).not.toEqual(differentPhone);
  });

  it("normalizes casing and formatting before hashing", () => {
    const original = computeGuestLookupHash({ ...baseInput, pepper: "secret-pepper" });
    const normalized = computeGuestLookupHash({
      restaurantId: baseInput.restaurantId,
      email: "guest@EXAMPLE.com",
      phone: "1-415-555-1212",
      pepper: "secret-pepper",
    });

    expect(original).toEqual(normalized);
  });

  it("returns null when pepper missing", () => {
    const result = computeGuestLookupHash({ ...baseInput, pepper: null });
    expect(result).toBeNull();
  });

  it("returns null when normalized phone is empty", () => {
    const result = computeGuestLookupHash({
      restaurantId: baseInput.restaurantId,
      email: baseInput.email,
      phone: "   ",
      pepper: "secret-pepper",
    });

    expect(result).toBeNull();
  });
});
