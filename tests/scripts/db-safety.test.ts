import { describe, expect, it } from "vitest";

import { evaluateDbTargetSafety, normalizeTargetEnv } from "@/scripts/db/safety";

describe("normalizeTargetEnv", () => {
  it("defaults unknown to development", () => {
    expect(normalizeTargetEnv("unknown")).toBe("development");
  });

  it("normalizes aliases", () => {
    expect(normalizeTargetEnv("prod")).toBe("production");
    expect(normalizeTargetEnv("stage")).toBe("staging");
  });
});

describe("evaluateDbTargetSafety", () => {
  it("blocks production without override", () => {
    const result = evaluateDbTargetSafety({
      targetEnv: "production",
      supabaseDbUrl: "postgres://example",
      allowProdOverride: false,
    });
    expect(result.allowed).toBe(false);
    expect(result.reasons.some((r) => r.toLowerCase().includes("production"))).toBe(true);
  });

  it("blocks when non-prod target uses production URL without override", () => {
    const result = evaluateDbTargetSafety({
      targetEnv: "development",
      supabaseDbUrl: "postgres://prod-url",
      productionSupabaseUrl: "postgres://prod-url",
      allowProdOverride: false,
    });
    expect(result.allowed).toBe(false);
  });

  it("allows staging when URL is non-prod", () => {
    const result = evaluateDbTargetSafety({
      targetEnv: "staging",
      supabaseDbUrl: "postgres://staging-url",
      productionSupabaseUrl: "postgres://prod-url",
      allowProdOverride: false,
    });
    expect(result.allowed).toBe(true);
  });

  it("allows explicit override for production", () => {
    const result = evaluateDbTargetSafety({
      targetEnv: "production",
      supabaseDbUrl: "postgres://prod-url",
      allowProdOverride: true,
    });
    expect(result.allowed).toBe(true);
  });
});
