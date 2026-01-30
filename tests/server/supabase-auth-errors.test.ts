import { describe, expect, it } from "vitest";

import { isMissingSessionAuthError } from "@/lib/supabase/auth-errors";

describe("isMissingSessionAuthError", () => {
  it("detects missing-session messages", () => {
    expect(isMissingSessionAuthError({ message: "Auth session missing!" })).toBe(true);
    expect(isMissingSessionAuthError({ message: "session missing" })).toBe(true);
  });

  it("detects refresh-token missing codes/messages", () => {
    expect(isMissingSessionAuthError({ code: "refresh_token_not_found" })).toBe(true);
    expect(isMissingSessionAuthError({ message: "Invalid Refresh Token: Refresh Token Not Found" })).toBe(true);
  });

  it("returns false for other errors", () => {
    expect(isMissingSessionAuthError({ message: "network error" })).toBe(false);
    expect(isMissingSessionAuthError(null)).toBe(false);
    expect(isMissingSessionAuthError(undefined)).toBe(false);
  });
});

