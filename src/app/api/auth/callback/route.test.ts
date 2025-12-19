import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";

import config from "@/config";
import { defaultRedirectForHost, parseHostname, sanitizeRedirect, toAbsoluteRedirectTarget } from "@/lib/auth/redirects";

import { GET } from "./route";

const exchangeCodeMock = vi.fn();
const verifyOtpMock = vi.fn();
const getRouteHandlerSupabaseClientMock = vi.fn(async () => ({
  auth: {
    exchangeCodeForSession: exchangeCodeMock,
    getUser: vi.fn(async () => ({ data: { user: { id: "user-123" } }, error: null })),
    getSession: vi.fn(async () => ({ data: { session: { user: { id: "user-123" } } }, error: null })),
    verifyOtp: verifyOtpMock,
  },
}));

vi.mock("@/server/supabase", () => ({
  getRouteHandlerSupabaseClient: () => getRouteHandlerSupabaseClientMock(),
  getServiceSupabaseClient: () => ({
    from: () => ({
      select: () => ({ eq: () => ({ is: () => ({ data: [], error: null }) }) }),
      update: () => ({ in: () => ({ error: null }) }),
    }),
  }),
}));

const cookieStoreMock = {
  getAll: vi.fn(() => [] as { name: string; value: string }[]),
  set: vi.fn(),
};

vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => cookieStoreMock),
}));

function expectedRedirectLocation(request: NextRequest, redirectedFrom?: string | null) {
  const rootDomain = process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? "localhost";
  const hostname = parseHostname(request);
  const destinationTarget = sanitizeRedirect(redirectedFrom ?? undefined, rootDomain)
    ?? config.auth.callbackUrl
    ?? defaultRedirectForHost(hostname, rootDomain);

  const destination = toAbsoluteRedirectTarget(destinationTarget, rootDomain);
  return new URL(destination, request.url).toString();
}

describe("GET /api/auth/callback", () => {
  afterEach(() => {
    exchangeCodeMock.mockReset();
    verifyOtpMock.mockReset();
    getRouteHandlerSupabaseClientMock.mockClear();
    vi.restoreAllMocks();
  });

  it("exchanges the code and redirects to the provided path when valid", async () => {
    exchangeCodeMock.mockResolvedValue({ data: { user: { id: "user-123", email: "user@example.com" } }, error: null });
    const request = new NextRequest("http://localhost/api/auth/callback?code=abc123&redirectedFrom=%2Fapp");

    const response = await GET(request);
    const expectedLocation = expectedRedirectLocation(request, "/app");

    expect(exchangeCodeMock).toHaveBeenCalledWith("abc123");
    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe(expectedLocation);
  });

  it("falls back to default callback path when redirect is invalid", async () => {
    exchangeCodeMock.mockResolvedValue({ data: { user: { id: "user-123", email: "user@example.com" } }, error: null });
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const request = new NextRequest("http://localhost/api/auth/callback?code=abc123&redirectedFrom=https://malicious.com");

    const response = await GET(request);
    const expectedLocation = expectedRedirectLocation(request, "https://malicious.com");

    expect(exchangeCodeMock).toHaveBeenCalledWith("abc123");
    expect(warnSpy).toHaveBeenCalled();
    expect(response.headers.get("location")).toBe(expectedLocation);
  });

  it("logs a warning and still redirects when no code or token_hash is present", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const request = new NextRequest("http://localhost/api/auth/callback");

    const response = await GET(request);
    const expectedLocation = expectedRedirectLocation(request);

    expect(exchangeCodeMock).not.toHaveBeenCalled();
    expect(verifyOtpMock).not.toHaveBeenCalled();
    expect(warnSpy).toHaveBeenCalledWith("[auth/callback] No code or token_hash parameter in request - possible direct access or malformed link");
    expect(response.headers.get("location")).toBe(expectedLocation);
  });

  it("verifies token_hash when present", async () => {
    verifyOtpMock.mockResolvedValue({ data: { session: { user: { id: "user-xyz", email: "user@example.com" } } }, error: null });
    const request = new NextRequest("http://localhost/api/auth/callback?token_hash=hash123&redirectedFrom=%2Fguest%2Fdashboard");

    const response = await GET(request);
    const expectedLocation = expectedRedirectLocation(request, "/guest/dashboard");

    expect(exchangeCodeMock).not.toHaveBeenCalled();
    expect(verifyOtpMock).toHaveBeenCalledWith({ token_hash: "hash123", type: "magiclink" });
    expect(response.headers.get("location")).toBe(expectedLocation);
  });
});
