import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";

import { GET } from "./route";

const exchangeCodeMock = vi.fn();
const getRouteHandlerSupabaseClientMock = vi.fn(async () => ({
  auth: {
    exchangeCodeForSession: exchangeCodeMock,
    getUser: vi.fn(async () => ({ data: { user: { id: "user-123" } }, error: null })),
  },
}));

vi.mock("@/server/supabase", () => ({
  getRouteHandlerSupabaseClient: () => getRouteHandlerSupabaseClientMock(),
}));

describe("GET /api/auth/callback", () => {
  afterEach(() => {
    exchangeCodeMock.mockReset();
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

  it("logs a warning and still redirects when code is missing", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const request = new NextRequest("http://localhost/api/auth/callback");

    const response = await GET(request);

    expect(exchangeCodeMock).not.toHaveBeenCalled();
    expect(warnSpy).toHaveBeenCalledWith("[auth/callback] No code parameter in request - possible direct access or malformed link");
    expect(response.headers.get("location")).toBe("http://localhost/guest/dashboard");
  });
});
