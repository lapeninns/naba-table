import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";

import { POST } from "./route";

const findInviteByTokenMock = vi.hoisted(() => vi.fn());
const inviteHasExpiredMock = vi.hoisted(() => vi.fn());
const markInviteAcceptedMock = vi.hoisted(() => vi.fn());
const markInviteExpiredMock = vi.hoisted(() => vi.fn());
const ensureProfileRowMock = vi.hoisted(() => vi.fn());
const getServiceSupabaseClientMock = vi.hoisted(() => vi.fn());

vi.mock("@/server/team/invitations", () => ({
  findInviteByToken: (...args: unknown[]) => findInviteByTokenMock(...args),
  inviteHasExpired: (...args: unknown[]) => inviteHasExpiredMock(...args),
  markInviteAccepted: (...args: unknown[]) => markInviteAcceptedMock(...args),
  markInviteExpired: (...args: unknown[]) => markInviteExpiredMock(...args),
}));

vi.mock("@/lib/profile/server", () => ({
  ensureProfileRow: (...args: unknown[]) => ensureProfileRowMock(...args),
}));

vi.mock("@/server/supabase", () => ({
  getServiceSupabaseClient: (...args: unknown[]) => getServiceSupabaseClientMock(...args),
}));

function createRequest(body: unknown) {
  return new NextRequest("http://localhost/api/team/invitations/token/accept", {
    method: "POST",
    body: JSON.stringify(body),
    headers: {
      "Content-Type": "application/json",
    },
    // @ts-expect-error Node fetch requires duplex when a body is provided
    duplex: "half",
  });
}

function createServiceClient(options: {
  usersByPage: Array<{ users: Array<{ id: string; email: string; user_metadata?: Record<string, unknown> }> | undefined; nextPage?: string | null }>;
  updateResponse?: { user: { id: string; email: string } };
  createResponse?: { user: { id: string; email: string } };
}) {
  let callCount = 0;
  const listUsers = vi
    .fn()
    .mockImplementation((_params: { perPage: number; page?: string | null }) => {
      const pageIndex = callCount++;
      const pageData = options.usersByPage[pageIndex] ?? { users: [], nextPage: null };
      return Promise.resolve({
        data: {
          users: pageData.users ?? [],
          nextPage: pageData.nextPage ?? null,
        },
        error: null,
      });
    });

  const createUser = vi.fn().mockResolvedValue({
    data: { user: options.createResponse?.user ?? null },
    error: null,
  });

  const updateUserById = vi.fn().mockResolvedValue({
    data: { user: options.updateResponse?.user ?? null },
    error: null,
  });

  const upsert = vi.fn().mockResolvedValue({ data: null, error: null });

  return {
    auth: {
      admin: {
        listUsers,
        createUser,
        updateUserById,
      },
    },
    from: vi.fn().mockReturnValue({ upsert }),
    __mocks: {
      listUsers,
      createUser,
      updateUserById,
      upsert,
    },
  };
}

describe("POST /api/team/invitations/[token]/accept", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("paginates auth user lookup and reuses an existing account", async () => {
    findInviteByTokenMock.mockResolvedValue({
      id: "invite-1",
      email: "Ops@example.com",
      restaurant_id: "rest-1",
      role: "manager",
      status: "pending",
      expires_at: null,
    });
    inviteHasExpiredMock.mockReturnValue(false);
    markInviteAcceptedMock.mockResolvedValue(undefined);
    markInviteExpiredMock.mockResolvedValue(undefined);
    ensureProfileRowMock.mockResolvedValue(undefined);

    const serviceClient = createServiceClient({
      usersByPage: [
        {
          users: Array.from({ length: 100 }, (_, index) => ({
            id: `user-${index}`,
            email: `person${index}@example.com`,
          })),
          nextPage: "2",
        },
        {
          users: [
            {
              id: "existing-user",
              email: "ops@example.com",
              user_metadata: { name: "Existing Ops" },
            },
          ],
          nextPage: null,
        },
      ],
      updateResponse: {
        user: { id: "existing-user", email: "ops@example.com" },
      },
    });

    getServiceSupabaseClientMock.mockReturnValue(serviceClient);

    const request = createRequest({
      name: "Ops Person",
      password: "averysecurepassword",
    });

    const response = await POST(request, { params: Promise.resolve({ token: "invite-token" }) });

    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json.success).toBe(true);
    expect(json.email).toBe("ops@example.com");
    expect(serviceClient.__mocks.listUsers).toHaveBeenCalledTimes(2);
    expect(serviceClient.__mocks.listUsers).toHaveBeenNthCalledWith(1, { perPage: 100, page: undefined });
    expect(serviceClient.__mocks.listUsers).toHaveBeenNthCalledWith(2, { perPage: 100, page: 2 });
    expect(serviceClient.__mocks.createUser).not.toHaveBeenCalled();
    expect(serviceClient.__mocks.updateUserById).toHaveBeenCalledWith("existing-user", expect.objectContaining({
      email_confirm: true,
    }));
    expect(serviceClient.__mocks.upsert).toHaveBeenCalledWith(
      {
        user_id: "existing-user",
        restaurant_id: "rest-1",
        role: "manager",
      },
      { onConflict: "user_id,restaurant_id" },
    );
    expect(markInviteAcceptedMock).toHaveBeenCalledWith("invite-1");
  });

  it("creates a new auth user when none exists and still upserts membership idempotently", async () => {
    findInviteByTokenMock.mockResolvedValue({
      id: "invite-2",
      email: "newstaff@example.com",
      restaurant_id: "rest-2",
      role: "staff",
      status: "pending",
      expires_at: null,
    });
    inviteHasExpiredMock.mockReturnValue(false);
    markInviteAcceptedMock.mockResolvedValue(undefined);
    markInviteExpiredMock.mockResolvedValue(undefined);
    ensureProfileRowMock.mockResolvedValue(undefined);

    const serviceClient = createServiceClient({
      usersByPage: [
        {
          users: [],
          nextPage: null,
        },
      ],
      createResponse: {
        user: { id: "created-user", email: "newstaff@example.com" },
      },
    });

    getServiceSupabaseClientMock.mockReturnValue(serviceClient);

    const request = createRequest({
      name: "New Staff",
      password: "averysecurepassword",
    });

    const response = await POST(request, { params: Promise.resolve({ token: "invite-2-token" }) });

    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json.success).toBe(true);
    expect(json.email).toBe("newstaff@example.com");
    expect(serviceClient.__mocks.listUsers).toHaveBeenCalledTimes(1);
    expect(serviceClient.__mocks.createUser).toHaveBeenCalledWith({
      email: "newstaff@example.com",
      password: "averysecurepassword",
      email_confirm: true,
      user_metadata: expect.objectContaining({ full_name: "New Staff" }),
    });
    expect(serviceClient.__mocks.updateUserById).not.toHaveBeenCalled();
    expect(serviceClient.__mocks.upsert).toHaveBeenCalledWith(
      {
        user_id: "created-user",
        restaurant_id: "rest-2",
        role: "staff",
      },
      { onConflict: "user_id,restaurant_id" },
    );
    expect(markInviteAcceptedMock).toHaveBeenCalledWith("invite-2");
  });
});
