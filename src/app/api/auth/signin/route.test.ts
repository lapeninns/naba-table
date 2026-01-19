import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { defaultRedirectForHost, parseHostname, sanitizeRedirect, toAbsoluteRedirectTarget } from "@/lib/auth/redirects";

import { POST } from "./route";

const consumeRateLimitMock = vi.fn();
const signInWithPasswordMock = vi.fn();
const signInWithOtpMock = vi.fn();
const generateLinkMock = vi.fn();
const sendEmailMock = vi.fn();

const originalEnv = process.env;

function getRootDomain() {
  return process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? "localhost";
}

function buildExpectedCallbackUrl(request: NextRequest, redirectedFrom: string | undefined, rememberMe = true, pathname = "/api/auth/callback") {
  const hostname = parseHostname(request);
  const rootDomain = getRootDomain();
  const redirectTarget = sanitizeRedirect(redirectedFrom, rootDomain) ?? defaultRedirectForHost(hostname, rootDomain);
  const absoluteRedirect = toAbsoluteRedirectTarget(redirectTarget, rootDomain);

  const callbackUrl = new URL(pathname, request.url);
  if (absoluteRedirect) {
    callbackUrl.searchParams.set("redirectedFrom", absoluteRedirect);
  }
  callbackUrl.searchParams.set("rememberMe", rememberMe ? "1" : "0");

  return callbackUrl.toString();
}

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
  getServiceSupabaseClient: vi.fn(() => ({
    auth: {
      admin: {
        generateLink: (...args: unknown[]) => generateLinkMock(...args),
      },
    },
  })),
}));

vi.mock("@/libs/resend", () => ({
  sendEmail: (...args: unknown[]) => sendEmailMock(...args),
}));

describe("POST /api/auth/signin", () => {
  beforeEach(() => {
    const resetAt = Date.now() + 60_000;
    consumeRateLimitMock.mockResolvedValue({ ok: true, limit: 5, remaining: 5, resetAt, source: "memory" });
    signInWithPasswordMock.mockResolvedValue({ error: null });
    signInWithOtpMock.mockResolvedValue({ error: null });
    generateLinkMock.mockResolvedValue({ data: { properties: { action_link: "https://example.com/link" } }, error: null });
    sendEmailMock.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    consumeRateLimitMock.mockReset();
    signInWithPasswordMock.mockReset();
    signInWithOtpMock.mockReset();
    generateLinkMock.mockReset();
    sendEmailMock.mockReset();
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
    expect(body.redirectTo).toBe("/dashboard");
    expect(signInWithPasswordMock).toHaveBeenCalledWith({ email: "user@example.com", password: "ValidPassword123!" });
  });

  it("sends a magic link and allows creating a new user", async () => {
    const token = "csrf-token";

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

    const expectedCallbackUrl = buildExpectedCallbackUrl(request, "/guest/bookings");

    expect(signInWithOtpMock).toHaveBeenCalledWith({
      email: "newuser@example.com",
      options: {
        shouldCreateUser: true,
        emailRedirectTo: expectedCallbackUrl,
      },
    });
  });

  it("falls back to admin.generateLink + Resend when Supabase email send fails", async () => {
    const token = "csrf-token";
    signInWithOtpMock.mockResolvedValueOnce({
      error: { message: "Error sending confirmation email", status: 500, code: "unexpected_failure" },
    });

    const request = new NextRequest("http://localhost:3000/api/auth/signin", {
      method: "POST",
      body: JSON.stringify({
        mode: "magic_link",
        email: "fallback@example.com",
        redirectedFrom: "/guest/dashboard",
      }),
      headers: {
        "content-type": "application/json",
        "x-csrf-token": token,
        cookie: `sr-csrf-token=${token}`,
      },
    });

    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body.message).toBe("Error sending confirmation email");
    expect(generateLinkMock).toHaveBeenCalledTimes(0);
    expect(sendEmailMock).toHaveBeenCalledTimes(0);

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

    expect(signInWithOtpMock).toHaveBeenCalledWith({
      email: "user@example.com",
      options: {
        emailRedirectTo:
          "https://app.nabatable.com/api/auth/callback?redirectedFrom=https%3A%2F%2Fapp.nabatable.com%2Fdashboard&rememberMe=1",
        shouldCreateUser: true,
      },
    });
  });
});
