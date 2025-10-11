import { describe, expect, it, vi } from "vitest";

vi.mock("@/server/supabase", () => ({
  getServiceSupabaseClient: () => ({
    from() {
      throw new Error("Unexpected call in membership tests");
    },
  }),
}));

import { fetchUserMemberships, requireMembershipForRestaurant } from "@/server/team/access";
import { makeRestaurantMembership } from "@/tests/helpers/opsFactories";

describe("team access", () => {
  it("fetchUserMemberships normalizes restaurant relation arrays", async () => {
    const membership = makeRestaurantMembership({ restaurants: [{ id: "rest-1", name: "Demo", slug: "demo" }] as any });

    const eqMock = vi.fn().mockResolvedValue({ data: [membership], error: null });
    const selectMock = vi.fn(() => ({ eq: eqMock }));
    const fromMock = vi.fn(() => ({ select: selectMock }));

    const client = { from: fromMock } as unknown as Parameters<typeof fetchUserMemberships>[1];

    const result = await fetchUserMemberships("user-1", client);

    expect(fromMock).toHaveBeenCalledWith("restaurant_memberships");
    expect(result).toHaveLength(1);
    expect(result[0].restaurants).toMatchObject({ id: "rest-1", name: "Demo", slug: "demo" });
  });

  it("requireMembershipForRestaurant returns membership when role allowed", async () => {
    const membership = makeRestaurantMembership({ restaurant_id: "rest-1", user_id: "user-1", role: "manager" });

    const maybeSingle = vi.fn().mockResolvedValue({ data: membership, error: null });
    const eqSecond = vi.fn(() => ({ maybeSingle }));
    const eqFirst = vi.fn(() => ({ eq: eqSecond }));
    const selectMock = vi.fn(() => ({ eq: eqFirst }));
    const fromMock = vi.fn(() => ({ select: selectMock }));

    const client = { from: fromMock } as unknown as Parameters<typeof requireMembershipForRestaurant>[0]["client"];

    const result = await requireMembershipForRestaurant({ userId: "user-1", restaurantId: "rest-1", client });

    expect(result.role).toBe("manager");
    expect(result.restaurants?.id).toBe(membership.restaurants?.id);
    expect(eqFirst).toHaveBeenCalledWith("user_id", "user-1");
    expect(eqSecond).toHaveBeenCalledWith("restaurant_id", "rest-1");
  });

  it("requireMembershipForRestaurant throws when membership missing", async () => {
    const maybeSingle = vi.fn().mockResolvedValue({ data: null, error: null });
    const eqSecond = vi.fn(() => ({ maybeSingle }));
    const eqFirst = vi.fn(() => ({ eq: eqSecond }));
    const selectMock = vi.fn(() => ({ eq: eqFirst }));
    const fromMock = vi.fn(() => ({ select: selectMock }));

    const client = { from: fromMock } as unknown as Parameters<typeof requireMembershipForRestaurant>[0]["client"];

    await expect(
      requireMembershipForRestaurant({ userId: "user-404", restaurantId: "rest-404", client }),
    ).rejects.toMatchObject({ code: "MEMBERSHIP_NOT_FOUND" });
  });

  it("requireMembershipForRestaurant throws when role not permitted", async () => {
    const membership = makeRestaurantMembership({ role: "server" });

    const maybeSingle = vi.fn().mockResolvedValue({ data: membership, error: null });
    const eqSecond = vi.fn(() => ({ maybeSingle }));
    const eqFirst = vi.fn(() => ({ eq: eqSecond }));
    const selectMock = vi.fn(() => ({ eq: eqFirst }));
    const fromMock = vi.fn(() => ({ select: selectMock }));

    const client = { from: fromMock } as unknown as Parameters<typeof requireMembershipForRestaurant>[0]["client"];

    await expect(
      requireMembershipForRestaurant({
        userId: "user-1",
        restaurantId: membership.restaurant_id,
        allowedRoles: ["owner"],
        client,
      }),
    ).rejects.toMatchObject({ code: "MEMBERSHIP_ROLE_DENIED", role: "server" });
  });
});
