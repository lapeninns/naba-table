import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";

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

describe("GET /api/auth/callback", () => {
  afterEach(() => {
    exchangeCodeMock.mockReset();
    verifyOtpMock.mockReset();
    getRouteHandlerSupabaseClientMock.mockClear();
    vi.restoreAllMocks();
  });

  it("exchanges the code and redirects to the provided path when valid", async () => {
    exchangeCodeMock.mockResolvedValue({ data: { user: { id: "user-123", email: "user@example.com" } }, error: null });
    const request = new NextRequest(
      "http://localhost/api/auth/callback?code=abc123&redirectedFrom=%2Fapp",
    );

    const response = await GET(request);

    expect(exchangeCodeMock).toHaveBeenCalledWith("abc123");
    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("http://localhost/app");
  });

  it("falls back to default callback path when redirect is invalid", async () => {
    exchangeCodeMock.mockResolvedValue({ data: { user: { id: "user-123", email: "user@example.com" } }, error: null });
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const request = new NextRequest(
      "http://localhost/api/auth/callback?code=abc123&redirectedFrom=https://malicious.com",
    );

    const response = await GET(request);

    expect(exchangeCodeMock).toHaveBeenCalledWith("abc123");
    expect(warnSpy).toHaveBeenCalled();
    expect(response.headers.get("location")).toBe("http://localhost/guest/dashboard");
  });

  it("logs a warning and still redirects when no code or token_hash is present", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const request = new NextRequest("http://localhost/api/auth/callback");

    const response = await GET(request);

    expect(exchangeCodeMock).not.toHaveBeenCalled();
    expect(verifyOtpMock).not.toHaveBeenCalled();
    expect(warnSpy).toHaveBeenCalledWith("[auth/callback] No code or token_hash parameter in request - possible direct access or malformed link");
    expect(response.headers.get("location")).toBe("http://localhost/guest/dashboard");
  });

  it("verifies token_hash when present", async () => {
    verifyOtpMock.mockResolvedValue({ data: { session: { user: { id: "user-xyz", email: "user@example.com" } } }, error: null });
    const request = new NextRequest("http://localhost/api/auth/callback?token_hash=hash123&redirectedFrom=%2Fguest%2Fdashboard");

    const response = await GET(request);

    expect(exchangeCodeMock).not.toHaveBeenCalled();
    expect(verifyOtpMock).toHaveBeenCalledWith({ token_hash: "hash123", type: "magiclink" });
    expect(response.headers.get("location")).toBe("http://localhost/guest/dashboard");
  });
});
