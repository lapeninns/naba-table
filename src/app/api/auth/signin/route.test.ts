import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { POST } from "./route";

const consumeRateLimitMock = vi.fn();
const signInWithPasswordMock = vi.fn();
const signInWithOtpMock = vi.fn();

const originalEnv = process.env;

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
    process.env = { ...originalEnv };
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
        host: "localhost:3000",
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
    expect(body.redirectTo).toBe("/guest/dashboard");
    expect(signInWithPasswordMock).toHaveBeenCalledWith({ email: "user@example.com", password: "ValidPassword123!" });
  });

  it("sends a magic link without creating a new user", async () => {
    const token = "csrf-token";
    process.env = { ...originalEnv, NEXT_PUBLIC_ROOT_DOMAIN: "localhost" };

    const request = new NextRequest("http://localhost:3000/api/auth/signin", {
      method: "POST",
      body: JSON.stringify({
        mode: "magic_link",
        email: "NewUser@example.com",
        redirectedFrom: "/guest/bookings",
      }),
      headers: {
        "content-type": "application/json",
        "x-csrf-token": token,
        cookie: `sr-csrf-token=${token}`,
      },
    });

    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(202);
    expect(body.status).toBe("magic_link_sent");
    expect(signInWithOtpMock).toHaveBeenCalledTimes(1);
    expect(signInWithOtpMock).toHaveBeenCalledWith(
      expect.objectContaining({
        email: "newuser@example.com",
        options: expect.objectContaining({
          shouldCreateUser: false,
          emailRedirectTo: "http://localhost:3000/api/auth/callback?redirectedFrom=http%3A%2F%2Flocalhost%3A3000%2Fguest%2Fbookings",
        }),
      }),
    );
  });

  it("aligns callback host with redirect host in production (www vs app)", async () => {
    const token = "csrf-token";
    process.env = { ...originalEnv, NEXT_PUBLIC_ROOT_DOMAIN: "nabatable.com" };

    const request = new NextRequest("https://app.nabatable.com/api/auth/signin", {
      method: "POST",
      body: JSON.stringify({
        mode: "magic_link",
        email: "user@example.com",
        redirectedFrom: undefined,
      }),
      headers: {
        "content-type": "application/json",
        "x-csrf-token": token,
        cookie: `sr-csrf-token=${token}`,
        host: "app.nabatable.com",
      },
    });

    const response = await POST(request);
    expect(response.status).toBe(202);

    expect(signInWithOtpMock).toHaveBeenCalledWith(
      expect.objectContaining({
        email: "user@example.com",
        options: expect.objectContaining({
          emailRedirectTo: "https://www.nabatable.com/api/auth/callback?redirectedFrom=https%3A%2F%2Fwww.nabatable.com%2Fapp%2Fdashboard",
          shouldCreateUser: false,
        }),
      }),
    );
  });
});
