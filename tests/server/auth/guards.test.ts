import { describe, expect, it, vi } from "vitest";

import { requireSession, requireRestaurantMember } from "@/server/auth/guards";

const mockGetUser = vi.fn();
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockSupabase = { auth: { getUser: mockGetUser } } as any;

vi.mock("@/server/supabase", () => ({
  getRouteHandlerSupabaseClient: () => mockSupabase,
}));

vi.mock("@/server/team/access", () => ({
  requireMembershipForRestaurant: vi.fn(),
}));

describe("auth guards", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("throws 401 when no user", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null });
    await expect(requireSession()).rejects.toMatchObject({ status: 401 });
  });

  it("throws 500 when session resolution fails", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: new Error("boom") });
    await expect(requireSession()).rejects.toMatchObject({ status: 500, code: "SESSION_RESOLUTION_FAILED" });
  });

  it("returns supabase and user on success", async () => {
    const user = { id: "u1", email: "a@example.com" };
    mockGetUser.mockResolvedValue({ data: { user }, error: null });
    const result = await requireSession();
    expect(result.user).toEqual(user);
    expect(result.supabase).toBe(mockSupabase);
  });

  it("maps missing membership to FORBIDDEN", async () => {
    const { requireMembershipForRestaurant } = await import("@/server/team/access");
    (requireMembershipForRestaurant as vi.Mock).mockRejectedValue({ code: "MEMBERSHIP_NOT_FOUND", message: "nope" });

    await expect(
      requireRestaurantMember({
        supabase: mockSupabase,
        userId: "u1",
        restaurantId: "r1",
      }),
    ).rejects.toMatchObject({ status: 403, code: "FORBIDDEN" });
  });
});
