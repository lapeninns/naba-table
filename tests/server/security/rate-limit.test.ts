import { beforeEach, describe, expect, it, vi } from "vitest";

const ORIGINAL_ENV = { ...process.env };

function mockEnv(upstash?: { restUrl?: string | null; restToken?: string | null }) {
  vi.doMock("@/lib/env", () => ({
    env: {
      cache: {
        enableAvailabilityCache: false,
        availabilityTtlSeconds: 300,
        upstash: {
          restUrl: upstash?.restUrl ?? null,
          restToken: upstash?.restToken ?? null,
        },
      },
    },
  }));
}

describe("rate limiter", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.restoreAllMocks();
    Object.assign(process.env, ORIGINAL_ENV);
  });

  it("falls back to memory store with single warning and resets after window", async () => {
    mockEnv();
    const redisCtor = vi.fn();
    vi.doMock("@upstash/redis", () => ({ Redis: redisCtor }));

    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const nowSpy = vi.spyOn(Date, "now");
    nowSpy.mockReturnValueOnce(0); // first call
    nowSpy.mockReturnValueOnce(100); // second call within window
    nowSpy.mockReturnValueOnce(1500); // third call after reset window

    const { consumeRateLimit } = await import("@/server/security/rate-limit");

    const first = await consumeRateLimit({ identifier: "ip:1", limit: 2, windowMs: 1000 });
    const second = await consumeRateLimit({ identifier: "ip:1", limit: 2, windowMs: 1000 });
    const third = await consumeRateLimit({ identifier: "ip:1", limit: 2, windowMs: 1000 });

    expect(redisCtor).not.toHaveBeenCalled();
    expect(first).toMatchObject({ ok: true, remaining: 1, source: "memory" });
    expect(second).toMatchObject({ ok: true, remaining: 0, source: "memory" });
    expect(third).toMatchObject({ ok: true, remaining: 1, source: "memory" });
    expect(warnSpy).toHaveBeenCalledTimes(2); // missing Upstash + memory fallback
  });

  it("uses Redis when credentials present and computes remaining quota", async () => {
    mockEnv({ restUrl: "https://upstash.example", restToken: "token-123" });

    const incr = vi
      .fn()
      .mockResolvedValueOnce(1)
      .mockResolvedValueOnce(2)
      .mockResolvedValueOnce(3);
    const pexpire = vi.fn().mockResolvedValue(undefined);

    class RedisMock {
      incr = incr;
      pexpire = pexpire;
      constructor(_config: { url: string; token: string }) {}
    }

    vi.doMock("@upstash/redis", () => ({ Redis: RedisMock }));

    const nowSpy = vi.spyOn(Date, "now").mockReturnValue(5_000);
    const { consumeRateLimit } = await import("@/server/security/rate-limit");

    const first = await consumeRateLimit({ identifier: "acct:42", limit: 2, windowMs: 1000 });
    const second = await consumeRateLimit({ identifier: "acct:42", limit: 2, windowMs: 1000 });
    const third = await consumeRateLimit({ identifier: "acct:42", limit: 2, windowMs: 1000 });

    expect(first).toMatchObject({ ok: true, remaining: 1, source: "redis" });
    expect(second).toMatchObject({ ok: true, remaining: 0, source: "redis" });
    expect(third).toMatchObject({ ok: false, remaining: 0, source: "redis" });
    expect(pexpire).toHaveBeenCalledWith("rl:acct:42:5000", 1000);
    expect(incr).toHaveBeenCalledTimes(3);
  });

  it("falls back to memory store when Redis incr throws", async () => {
    mockEnv({ restUrl: "https://upstash.example", restToken: "token-123" });

    const incr = vi.fn().mockRejectedValue(new Error("redis down"));
    const pexpire = vi.fn();
    class RedisMock {
      incr = incr;
      pexpire = pexpire;
      constructor(_config: { url: string; token: string }) {}
    }
    vi.doMock("@upstash/redis", () => ({ Redis: RedisMock }));

    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const nowSpy = vi.spyOn(Date, "now").mockReturnValue(10_000);

    const { consumeRateLimit } = await import("@/server/security/rate-limit");

    const result = await consumeRateLimit({ identifier: "acct:99", limit: 1, windowMs: 1000 });

    expect(result.source).toBe("memory");
    expect(result.ok).toBe(true);
    expect(incr).toHaveBeenCalled();
    expect(errorSpy).toHaveBeenCalledWith(
      "[rate-limit] redis pipeline failed",
      expect.any(Error),
    );
    expect(warnSpy).toHaveBeenCalledWith(
      "[rate-limit] Falling back to in-memory rate limiter. Configure Upstash Redis for multi-instance safety.",
    );
  });
});
