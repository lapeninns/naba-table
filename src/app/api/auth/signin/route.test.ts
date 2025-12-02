import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { POST } from "./route";

const consumeRateLimitMock = vi.fn();
const signInWithPasswordMock = vi.fn();
const createUserMock = vi.fn();
const generateLinkMock = vi.fn();
const sendEmailMock = vi.fn();

vi.mock("@/server/security/rate-limit", () => ({
  consumeRateLimit: (...args: unknown[]) => consumeRateLimitMock(...args),
}));

vi.mock("@/libs/resend", () => ({
  sendEmail: (...args: unknown[]) => sendEmailMock(...args),
}));

vi.mock("@/server/supabase", () => ({
  getRouteHandlerSupabaseClient: vi.fn(async () => ({
    auth: {
      signInWithPassword: (...args: unknown[]) => signInWithPasswordMock(...args),
    },
  })),
  getServiceSupabaseClient: vi.fn(() => ({
    auth: {
      admin: {
        createUser: (...args: unknown[]) => createUserMock(...args),
        generateLink: (...args: unknown[]) => generateLinkMock(...args),
      },
    },
  })),
}));

describe("POST /api/auth/signin", () => {
  beforeEach(() => {
    const resetAt = Date.now() + 60_000;
    consumeRateLimitMock.mockResolvedValue({ ok: true, limit: 5, remaining: 5, resetAt, source: "memory" });
    signInWithPasswordMock.mockResolvedValue({ error: null });
    createUserMock.mockResolvedValue({ error: null });
    generateLinkMock.mockResolvedValue({
      data: { properties: { hashed_token: "hashed-token", action_link: "https://example.com" } },
      error: null,
    });
    sendEmailMock.mockResolvedValue({});
  });

  afterEach(() => {
    vi.restoreAllMocks();
    consumeRateLimitMock.mockReset();
    signInWithPasswordMock.mockReset();
    createUserMock.mockReset();
    generateLinkMock.mockReset();
    sendEmailMock.mockReset();
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
    expect(body.redirectTo).toBe("/guest/dashboard");
    expect(signInWithPasswordMock).toHaveBeenCalledWith({ email: "user@example.com", password: "ValidPassword123!" });
  });

  it("sends a magic link without creating a new user", async () => {
    const token = "csrf-token";
    const request = new NextRequest("http://localhost/api/auth/signin", {
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
    expect(createUserMock).toHaveBeenCalledWith({ email: "newuser@example.com", email_confirm: false });
    expect(generateLinkMock).toHaveBeenCalled();
    const emailArgs = sendEmailMock.mock.calls[0]?.[0];
    expect(emailArgs?.html).toContain("token_hash=hashed-token");
    expect(emailArgs?.html).toContain("/api/auth/callback");
  });
});
