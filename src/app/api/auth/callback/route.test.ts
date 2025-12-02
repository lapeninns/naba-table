import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { GET } from "./route";

const verifyOtpMock = vi.fn();
const exchangeCodeForSessionMock = vi.fn();
const getUserMock = vi.fn();

let isStaffMember = false;

const makeQueryBuilder = (table: string) => {
  return {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    is: vi.fn().mockResolvedValue({ data: [], error: null }),
    limit: vi.fn().mockResolvedValue({ data: table === "restaurant_memberships" && isStaffMember ? [{ id: "rm-1" }] : [], error: null }),
    update: vi.fn().mockReturnThis(),
    in: vi.fn().mockResolvedValue({ error: null }),
  };
};

vi.mock("@/server/supabase", () => ({
  getRouteHandlerSupabaseClient: vi.fn(async () => ({
    auth: {
      verifyOtp: (...args: unknown[]) => verifyOtpMock(...args),
      exchangeCodeForSession: (...args: unknown[]) => exchangeCodeForSessionMock(...args),
      getUser: (...args: unknown[]) => getUserMock(...args),
    },
  })),
  getServiceSupabaseClient: vi.fn(() => ({
    from: (table: string) => makeQueryBuilder(table),
  })),
}));

describe("GET /api/auth/callback", () => {
  beforeEach(() => {
    process.env.NEXT_PUBLIC_ROOT_DOMAIN = "localhost";
    isStaffMember = false;
    exchangeCodeForSessionMock.mockResolvedValue({ data: { user: { id: "user-123", email: "user@example.com" } }, error: null });
    verifyOtpMock.mockResolvedValue({ data: { user: { id: "user-123", email: "user@example.com" } }, error: null });
    getUserMock.mockResolvedValue({ data: { user: { id: "user-123" } }, error: null });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    verifyOtpMock.mockReset();
    exchangeCodeForSessionMock.mockReset();
    getUserMock.mockReset();
  });

  it("redirects to a sanitized redirectedFrom when code is present", async () => {
    const request = new NextRequest("http://app.localhost/api/auth/callback?code=test-code&redirectedFrom=/app/reservations");

    const response = await GET(request);

    expect(exchangeCodeForSessionMock).toHaveBeenCalledWith("test-code");
    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("http://app.localhost/app/reservations");
  });

  it("rejects an invalid redirect and falls back to guest dashboard", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const request = new NextRequest(
      "http://app.localhost/api/auth/callback?code=test-code&redirectedFrom=https://malicious.test/foo",
    );

    const response = await GET(request);

    expect(exchangeCodeForSessionMock).toHaveBeenCalledWith("test-code");
    expect(warnSpy).toHaveBeenCalled();
    expect(response.headers.get("location")).toBe("http://app.localhost/guest/dashboard");
  });

  it("falls back to app dashboard for staff when no redirect provided", async () => {
    isStaffMember = true;
    const request = new NextRequest("http://app.localhost/api/auth/callback?code=test-code");

    const response = await GET(request);

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("http://app.localhost/app/dashboard");
  });

  it("falls back to config callback when no redirect and user is not staff", async () => {
    const request = new NextRequest("http://app.localhost/api/auth/callback?token_hash=abc&type=magiclink");

    const response = await GET(request);

    expect(verifyOtpMock).toHaveBeenCalled();
    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("http://app.localhost/guest/dashboard");
  });

  it("warns and redirects when neither code nor token_hash is provided", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const response = await GET(new NextRequest("http://app.localhost/api/auth/callback"));

    expect(exchangeCodeForSessionMock).not.toHaveBeenCalled();
    expect(verifyOtpMock).not.toHaveBeenCalled();
    expect(warnSpy).toHaveBeenCalled();
    expect(response.headers.get("location")).toBe("http://app.localhost/guest/dashboard");
  });
});
