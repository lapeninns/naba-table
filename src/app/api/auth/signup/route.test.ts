import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";

import { POST } from "./route";

const consumeRateLimitMock = vi.fn();
const signUpMock = vi.fn();
const signInWithOtpMock = vi.fn();

const originalEnv = process.env;

vi.mock("@/server/security/rate-limit", () => ({
  consumeRateLimit: (...args: unknown[]) => consumeRateLimitMock(...args),
}));

vi.mock("@/server/supabase", () => ({
  getRouteHandlerSupabaseClient: async () => ({
    auth: {
      signUp: (...args: unknown[]) => signUpMock(...args),
      signInWithOtp: (...args: unknown[]) => signInWithOtpMock(...args),
    },
  }),
  getServiceSupabaseClient: async () => ({
    auth: { admin: { generateLink: vi.fn() } },
  }),
}));

vi.mock("@/server/security/csrf", () => ({
  validateCsrfToken: (req: NextRequest) => req.headers.get("x-csrf-token") === "csrf-token",
}));

describe("POST /api/auth/signup", () => {
  afterEach(() => {
    consumeRateLimitMock.mockReset();
    signUpMock.mockReset();
    signInWithOtpMock.mockReset();
    process.env = { ...originalEnv };
  });

  it("rejects missing CSRF token", async () => {
    const request = new NextRequest("http://localhost/api/auth/signup", {
      method: "POST",
      body: JSON.stringify({ mode: "password", email: "user@example.com", password: "Password123!" }),
      headers: { "content-type": "application/json" },
    });

    const response = await POST(request);
    expect(response.status).toBe(403);
  });

  it("signs up with password and returns ok", async () => {
    consumeRateLimitMock.mockResolvedValue({ ok: true, limit: 5, remaining: 4, resetAt: Date.now() + 1000 });
    signUpMock.mockResolvedValue({ data: { user: { id: "user-123" } }, error: null });

    const request = new NextRequest("http://localhost:3000/api/auth/signup", {
      method: "POST",
      body: JSON.stringify({
        mode: "password",
        email: "User@example.com",
        password: "ValidPassword123!",
      }),
      headers: {
        "content-type": "application/json",
        "x-csrf-token": "csrf-token",
        cookie: `sr-csrf-token=csrf-token`,
      },
    });

    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.status).toBe("ok");
    expect(body.userId).toBe("user-123");
    expect(signUpMock).toHaveBeenCalledWith({
      email: "user@example.com",
      password: "ValidPassword123!",
      options: {
        emailRedirectTo: "http://localhost:3000/api/auth/callback?redirectedFrom=%2Fonboarding%2Fprofile",
      },
    });
  });

  it("sends magic link with shouldCreateUser true", async () => {
    consumeRateLimitMock.mockResolvedValue({ ok: true, limit: 5, remaining: 4, resetAt: Date.now() + 1000 });
    signInWithOtpMock.mockResolvedValue({ error: null });
    process.env = { ...originalEnv, NEXT_PUBLIC_ROOT_DOMAIN: "localhost" };

    const request = new NextRequest("http://localhost:3000/api/auth/signup", {
      method: "POST",
      body: JSON.stringify({ mode: "magic_link", email: "user@example.com" }),
      headers: {
        "content-type": "application/json",
        "x-csrf-token": "csrf-token",
        cookie: `sr-csrf-token=csrf-token`,
      },
    });

    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(202);
    expect(body.status).toBe("magic_link_sent");
    expect(signInWithOtpMock).toHaveBeenCalledWith({
      email: "user@example.com",
      options: {
        shouldCreateUser: true,
        emailRedirectTo: "http://localhost:3000/api/auth/callback?redirectedFrom=%2Fonboarding%2Fprofile",
      },
    });
  });
});
