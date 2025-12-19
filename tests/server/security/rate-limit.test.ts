import { describe, expect, it, vi } from "vitest";

const resetEnv = () => {
  delete process.env.UPSTASH_REDIS_REST_URL;
  delete process.env.UPSTASH_REDIS_REST_TOKEN;
  delete process.env.ALLOW_MEMORY_RATE_LIMIT_IN_PROD;
  delete process.env.ENABLE_RATE_LIMIT_IN_DEV;
};

describe("rate-limit configuration", () => {
  beforeEach(() => {
    vi.resetModules();
    resetEnv();
  });

  it("throws in production when Upstash credentials are missing", async () => {
    vi.doMock("@/lib/env", () => ({
      env: {
        node: { env: "production", appEnv: "production" },
        cache: { upstash: { restUrl: null, restToken: null } },
      },
    }));

    await expect(async () => {
      const mod = await import("@/server/security/rate-limit");
      await mod.consumeRateLimit({ identifier: "test", limit: 1, windowMs: 1000 });
    }).rejects.toThrow(/Upstash Redis credentials/i);
  });

  it("bypasses in development when enable dev bypass is default", async () => {
    vi.doMock("@/lib/env", () => ({
      env: {
        node: { env: "development", appEnv: "development" },
        cache: { upstash: { restUrl: null, restToken: null } },
      },
    }));

    const { consumeRateLimit } = await import("@/server/security/rate-limit");
    const result = await consumeRateLimit({ identifier: "dev-bypass", limit: 5, windowMs: 1000 });
    expect(result.ok).toBe(true);
    expect(result.source).toBe("none");
  });
});
