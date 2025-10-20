import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/env", () => ({
  env: {
    resend: {
      apiKey: "test-resend-key",
      from: "noreply@example.com",
    },
    node: {
      env: "test",
    },
  },
}));

process.env.NEXT_PUBLIC_SUPPORT_EMAIL = "support@example.com";

import { resolveReplyToAddress } from "@/libs/resend";

describe("resolveReplyToAddress", () => {
  it("prefers the explicitly requested reply-to when valid", () => {
    const result = resolveReplyToAddress({
      requested: "help@sajiloreservex.com",
      configured: "support@sajiloreservex.com",
      fallback: "noreply@sajiloreservex.com",
    });

    expect(result).toEqual({
      address: "help@sajiloreservex.com",
      usedFallback: false,
    });
  });

  it("falls back to configured support email when requested is invalid", () => {
    const result = resolveReplyToAddress({
      requested: "support@example.com",
      configured: "team@sajiloreservex.com",
      fallback: "noreply@sajiloreservex.com",
    });

    expect(result).toEqual({
      address: "team@sajiloreservex.com",
      usedFallback: false,
    });
  });

  it("uses fallback and surfaces reason when both are invalid", () => {
    const result = resolveReplyToAddress({
      requested: "support@example.com",
      configured: "ops@example.net",
      fallback: "noreply@sajiloreservex.com",
    });

    expect(result).toEqual({
      address: "noreply@sajiloreservex.com",
      usedFallback: true,
      reason: "requested_invalid",
    });
  });

  it("uses fallback with reason=missing when neither value provided", () => {
    const result = resolveReplyToAddress({
      fallback: "noreply@sajiloreservex.com",
    });

    expect(result).toEqual({
      address: "noreply@sajiloreservex.com",
      usedFallback: true,
      reason: "missing",
    });
  });
});
