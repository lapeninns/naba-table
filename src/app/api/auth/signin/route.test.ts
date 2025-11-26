import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { POST } from "./route";

const consumeRateLimitMock = vi.fn();
const signInWithPasswordMock = vi.fn();
const signInWithOtpMock = vi.fn();

vi.mock("@/server/security/rate-limit", () => ({
  consumeRateLimit: (...args: unknown[]) => consumeRateLimitMock(...args),
}));

vi.mock("@/server/supabase", () => ({
  getRouteHandlerSupabaseClient: vi.fn(async () => ({
    auth: {
      signInWithPassword: (...args: unknown[]) => signInWithPasswordMock(...args),
      signInWithOtp: (...args: unknown[]) => signInWithOtpMock(...args),
    },
  })),
}));

describe("POST /api/auth/signin", () => {
  beforeEach(() => {
    const resetAt = Date.now() + 60_000;
    consumeRateLimitMock.mockResolvedValue({ ok: true, limit: 5, remaining: 5, resetAt, source: "memory" });
    signInWithPasswordMock.mockResolvedValue({ error: null });
    signInWithOtpMock.mockResolvedValue({ error: null });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    consumeRateLimitMock.mockReset();
    signInWithPasswordMock.mockReset();
    signInWithOtpMock.mockReset();
  });

  it("rejects missing CSRF token", async () => {
    const request = new NextRequest("http://localhost/api/auth/signin", {
      method: "POST",
      body: JSON.stringify({ mode: "password", email: "user@example.com", password: "ValidPassword123!" }),
      headers: {
        "content-type": "application/json",
      },
    });

    const response = await POST(request);

    expect(response.status).toBe(403);
  });

  it("returns 429 when rate limit exceeded", async () => {
    const token = "csrf-token";
    consumeRateLimitMock.mockResolvedValueOnce({ ok: false, limit: 5, remaining: 0, resetAt: Date.now() + 30_000, source: "memory" });

    const request = new NextRequest("http://localhost/api/auth/signin", {
      method: "POST",
      body: JSON.stringify({ mode: "password", email: "user@example.com", password: "ValidPassword123!" }),
      headers: {
        "content-type": "application/json",
        "x-csrf-token": token,
        cookie: `sr-csrf-token=${token}`,
      },
    });

    const response = await POST(request);

    expect(response.status).toBe(429);
    expect(response.headers.get("X-RateLimit-Limit")).toBe("5");
    expect(consumeRateLimitMock).toHaveBeenCalled();
  });

  it("signs in with password when valid", async () => {
    const token = "csrf-token";
    const request = new NextRequest("http://localhost/api/auth/signin", {
      method: "POST",
      body: JSON.stringify({
        mode: "password",
        email: "USER@example.com",
        password: "ValidPassword123!",
        redirectedFrom: "/dashboard",
      }),
      headers: {
        "content-type": "application/json",
        "x-csrf-token": token,
        cookie: `sr-csrf-token=${token}`,
      },
    });

    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.redirectTo).toBe("/dashboard");
    expect(signInWithPasswordMock).toHaveBeenCalledWith({ email: "user@example.com", password: "ValidPassword123!" });
  });
});
