import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const signOutMock = vi.fn();
const createServerClientMock = vi.fn(() => ({
  auth: {
    signOut: signOutMock,
  },
}));

let cookieValues: Array<{ name: string; value: string }> = [];
const cookieSetMock = vi.fn();
const cookieDeleteMock = vi.fn();

const cookieStoreStub = {
  getAll: () => cookieValues,
  set: cookieSetMock,
  delete: cookieDeleteMock,
};

const cookiesMock = vi.fn(async () => cookieStoreStub);

vi.mock("@/lib/env", () => ({
  env: {
    supabase: {
      url: "http://supabase.test",
      anonKey: "anon-test-key",
    },
    node: {
      appEnv: "development",
    },
  },
}));

vi.mock("@supabase/ssr", () => ({
  createServerClient: (...args: unknown[]) => createServerClientMock(...args),
}));

vi.mock("next/headers", () => ({
  cookies: () => cookiesMock(),
}));

import { POST } from "./route";

describe("POST /api/auth/signout", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    cookieValues = [
      { name: "sb-access-token", value: "token-1" },
      { name: "sb-refresh-token", value: "token-2" },
      { name: "other-cookie", value: "other" },
    ];
    signOutMock.mockResolvedValue({ error: null });
  });

  it("expires auth cookies even when session is already missing", async () => {
    signOutMock.mockResolvedValue({
      error: { message: "Auth session missing!" },
    });

    const response = await POST(
      new NextRequest("http://localhost/api/auth/signout", { method: "POST" }),
    );
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.success).toBe(true);
    expect(json.alreadySignedOut).toBe(true);

    expect(cookieSetMock).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "sb-access-token",
        value: "",
        maxAge: 0,
      }),
    );
    expect(cookieSetMock).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "sb-refresh-token",
        value: "",
        maxAge: 0,
      }),
    );
    expect(cookieDeleteMock).toHaveBeenCalledWith("sb-access-token");
    expect(cookieDeleteMock).toHaveBeenCalledWith("sb-refresh-token");
  });

  it("expires auth cookies on successful sign-out", async () => {
    const response = await POST(
      new NextRequest("http://localhost/api/auth/signout", { method: "POST" }),
    );
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.success).toBe(true);
    expect(json.alreadySignedOut).toBe(false);
    expect(cookieSetMock).toHaveBeenCalled();
  });
});

