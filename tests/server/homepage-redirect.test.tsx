import React from "react";
import { describe, expect, it, beforeEach, vi } from "vitest";

const redirectMock = vi.fn(() => {
  throw new Error("NEXT_REDIRECT");
});

const getUserMock = vi.fn();
const renderFactoryHome = vi.fn(({ isAuthenticated }: { isAuthenticated: boolean }) => (
  <div data-testid="factory-home" data-authenticated={isAuthenticated} />
));
const renderMarketingLayout = vi.fn(({ children }: { children: React.ReactNode }) => (
  <div data-testid="marketing-layout">{children}</div>
));

vi.mock("next/navigation", () => ({
  redirect: redirectMock,
}));

vi.mock("@/components/landing/FactoryHomeClient", () => ({
  FactoryHomeClient: renderFactoryHome,
}));

vi.mock("@/components/layouts/MarketingLayout", () => ({
  MarketingLayout: renderMarketingLayout,
}));

vi.mock("@/server/supabase", async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    getServerComponentSupabaseClient: vi.fn(async () => ({
      auth: {
        getUser: getUserMock,
      },
    })),
  };
});

describe("home page redirect", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    redirectMock.mockImplementation(() => {
      throw new Error("NEXT_REDIRECT");
    });
  });

  it("redirects authenticated users to /guest/dashboard", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: "user-123" } }, error: null });
    const { default: Home } = await import("@/app/(public)/page");
    await expect(Home()).rejects.toThrowError("NEXT_REDIRECT");
    expect(redirectMock).toHaveBeenCalledWith("/guest/dashboard");
  });

  it("renders marketing page for unauthenticated users", async () => {
    getUserMock.mockResolvedValue({ data: { user: null }, error: null });
    const { default: Home } = await import("@/app/(public)/page");
    const result = await Home();
    expect(redirectMock).not.toHaveBeenCalled();
    expect(result).toBeTruthy();
    expect(result.type).toBe(renderMarketingLayout);
    const child = Array.isArray(result.props.children) ? result.props.children[0] : result.props.children;
    expect(child.type).toBe(renderFactoryHome);
    expect(child.props.isAuthenticated).toBe(false);
  });
});
