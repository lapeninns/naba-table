import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  GuardError,
  listUserRestaurantMemberships,
  requireRestaurantMember,
  requireSession,
} from "@/server/auth/guards";
import { getRouteHandlerSupabaseClient } from "@/server/supabase";
import { fetchUserMemberships, requireMembershipForRestaurant } from "@/server/team/access";

import type { Database } from "@/types/supabase";
import type { SupabaseClient, User } from "@supabase/supabase-js";

vi.mock("@/server/supabase", () => ({
  getRouteHandlerSupabaseClient: vi.fn(),
}));

vi.mock("@/server/team/access", () => ({
  requireMembershipForRestaurant: vi.fn(),
  fetchUserMemberships: vi.fn(),
}));

type MockTenantClient = SupabaseClient<Database, "public", any>;

function createAuthClient(user: User | null, error?: unknown): MockTenantClient {
  return {
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user },
        error: error ?? null,
      }),
    },
  } as unknown as MockTenantClient;
}

const mockedGetRouteClient = vi.mocked(getRouteHandlerSupabaseClient);
const mockedRequireMembership = vi.mocked(requireMembershipForRestaurant);
const mockedFetchMemberships = vi.mocked(fetchUserMemberships);

describe("requireSession", () => {
  const user: User = { id: "user-123" } as User;

  beforeEach(() => {
    vi.restoreAllMocks();
    mockedGetRouteClient.mockReset();
  });

  it("returns provided client and user when supplied", async () => {
    const client = createAuthClient(user);
    const result = await requireSession(client);
    expect(result.user).toEqual(user);
    expect(result.supabase).toBe(client);
    expect(mockedGetRouteClient).not.toHaveBeenCalled();
  });

  it("fetches client via getRouteHandlerSupabaseClient when none provided", async () => {
    const client = createAuthClient(user);
    mockedGetRouteClient.mockResolvedValue(client);

    const result = await requireSession();
    expect(mockedGetRouteClient).toHaveBeenCalledTimes(1);
    expect(result.user).toEqual(user);
    expect(result.supabase).toBe(client);
  });

  it("throws GuardError when Supabase returns error", async () => {
    const supabaseError = { message: "token expired" };
    const client = createAuthClient(null, supabaseError);

    await expect(requireSession(client)).rejects.toMatchObject({
      status: 500,
      code: "SESSION_RESOLUTION_FAILED",
    });
  });

  it("throws GuardError when no authenticated user", async () => {
    const client = createAuthClient(null);

    await expect(requireSession(client)).rejects.toMatchObject({
      status: 401,
      code: "UNAUTHENTICATED",
    });
  });
});

describe("requireRestaurantMember", () => {
  const baseClient = createAuthClient({ id: "user-123" } as User);

  beforeEach(() => {
    vi.restoreAllMocks();
    mockedRequireMembership.mockReset();
  });

  it("throws when restaurantId is missing", async () => {
    await expect(
      requireRestaurantMember({
        supabase: baseClient,
        userId: "user-123",
        restaurantId: null,
      }),
    ).rejects.toMatchObject({
      status: 404,
      code: "BOOKING_NOT_FOUND",
    });
    expect(mockedRequireMembership).not.toHaveBeenCalled();
  });

  it("returns membership when underlying check succeeds", async () => {
    const membership = { restaurant_id: "rest-1", role: "manager" };
    mockedRequireMembership.mockResolvedValue(membership as any);

    const result = await requireRestaurantMember({
      supabase: baseClient,
      userId: "user-123",
      restaurantId: "rest-1",
      allowedRoles: ["manager", "owner"],
    });

    expect(result).toBe(membership);
    expect(mockedRequireMembership).toHaveBeenCalledWith({
      userId: "user-123",
      restaurantId: "rest-1",
      allowedRoles: ["manager", "owner"],
      client: baseClient,
    });
  });

  it("maps MEMBERSHIP_NOT_FOUND to GuardError 403", async () => {
    mockedRequireMembership.mockRejectedValue({
      code: "MEMBERSHIP_NOT_FOUND",
      message: "not found",
    });

    await expect(
      requireRestaurantMember({
        supabase: baseClient,
        userId: "user-123",
        restaurantId: "rest-1",
      }),
    ).rejects.toMatchObject({
      status: 403,
      code: "FORBIDDEN",
    });
  });

  it("maps MEMBERSHIP_ROLE_DENIED to GuardError 403", async () => {
    mockedRequireMembership.mockRejectedValue({
      code: "MEMBERSHIP_ROLE_DENIED",
      message: "denied",
    });

    await expect(
      requireRestaurantMember({
        supabase: baseClient,
        userId: "user-123",
        restaurantId: "rest-1",
      }),
    ).rejects.toMatchObject({
      status: 403,
      code: "FORBIDDEN",
    });
  });

  it("wraps unexpected errors in GuardError 500", async () => {
    const underlyingError = new Error("boom");
    mockedRequireMembership.mockRejectedValue(underlyingError);

    await expect(
      requireRestaurantMember({
        supabase: baseClient,
        userId: "user-123",
        restaurantId: "rest-1",
      }),
    ).rejects.toMatchObject({
      status: 500,
      code: "MEMBERSHIP_VALIDATION_FAILED",
      cause: underlyingError,
    });
  });
});

describe("listUserRestaurantMemberships", () => {
  const supabase = createAuthClient({ id: "user-123" } as User);

  beforeEach(() => {
    vi.restoreAllMocks();
    mockedFetchMemberships.mockReset();
  });

  it("returns memberships when fetch succeeds", async () => {
    mockedFetchMemberships.mockResolvedValue([{ restaurant_id: "rest-1" }] as any);

    const memberships = await listUserRestaurantMemberships(supabase, "user-123");
    expect(memberships).toHaveLength(1);
    expect(mockedFetchMemberships).toHaveBeenCalledWith("user-123", supabase);
  });

  it("throws GuardError when fetch fails", async () => {
    const error = new Error("query failed");
    mockedFetchMemberships.mockRejectedValue(error);

    await expect(listUserRestaurantMemberships(supabase, "user-123")).rejects.toMatchObject({
      status: 500,
      code: "MEMBERSHIP_QUERY_FAILED",
    });
  });
});
