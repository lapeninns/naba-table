import { act, renderHook } from '@testing-library/react';
import { createQueryWrapper, createTestQueryClient } from '@tests/utils/reactQuery';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  applyInviteToCachedLists,
  useOpsCreateTeamInvite,
  useOpsResendTeamInvite,
  useOpsRevokeTeamInvite,
} from '@/hooks/ops/useOpsTeamInvitations';
import { HttpError } from '@/lib/http/errors';
import { queryKeys } from '@/lib/query/keys';

import type { TeamInvite } from '@/services/ops/team';

const service = vi.hoisted(() => ({
  listInvites: vi.fn(),
  createInvite: vi.fn(),
  revokeInvite: vi.fn(),
  resendInvite: vi.fn(),
}));

vi.mock('@/contexts/ops-services', () => ({ useTeamService: () => service }));

const RESTAURANT_ID = '11111111-1111-4111-8111-111111111111';

function makeInvite(overrides: Partial<TeamInvite> = {}): TeamInvite {
  return {
    id: 'invite-1',
    restaurantId: RESTAURANT_ID,
    email: 'pending@example.com',
    role: 'host',
    status: 'pending',
    expiresAt: '2099-05-01T12:00:00.000Z',
    invitedBy: null,
    acceptedAt: null,
    revokedAt: null,
    createdAt: '2026-04-30T12:00:00.000Z',
    updatedAt: '2026-04-30T12:00:00.000Z',
    ...overrides,
  };
}

function setup<T>(hook: () => T) {
  const queryClient = createTestQueryClient();
  const rendered = renderHook(hook, { wrapper: createQueryWrapper(queryClient) });
  return { queryClient, ...rendered };
}

const allKey = queryKeys.team.invitations(RESTAURANT_ID, 'all');
const pendingKey = queryKeys.team.invitations(RESTAURANT_ID, 'pending');
const revokedKey = queryKeys.team.invitations(RESTAURANT_ID, 'revoked');

describe('applyInviteToCachedLists', () => {
  it('replaces, adds and removes the invite across the restaurant lists', () => {
    const queryClient = createTestQueryClient();
    const other = makeInvite({ id: 'other', email: 'other@example.com' });
    queryClient.setQueryData(allKey, [makeInvite(), other]);
    queryClient.setQueryData(pendingKey, [makeInvite(), other]);
    queryClient.setQueryData(revokedKey, []);

    const revoked = makeInvite({ status: 'revoked', revokedAt: '2026-05-01T00:00:00.000Z' });
    applyInviteToCachedLists(queryClient, revoked);

    expect(queryClient.getQueryData(allKey)).toEqual([revoked, other]);
    expect(queryClient.getQueryData(pendingKey)).toEqual([other]);
    expect(queryClient.getQueryData(revokedKey)).toEqual([revoked]);
  });
});

describe('team invitation mutations', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('create writes the new invite into cached lists without refetching', async () => {
    const created = makeInvite({ id: 'new', email: 'new@example.com' });
    service.createInvite.mockResolvedValue({ invite: created, emailSent: false });
    const { result, queryClient } = setup(() => useOpsCreateTeamInvite());
    queryClient.setQueryData(allKey, [makeInvite()]);
    const invalidate = vi.spyOn(queryClient, 'invalidateQueries');

    let data: unknown;
    await act(async () => {
      data = await result.current.mutateAsync({
        restaurantId: RESTAURANT_ID,
        email: 'new@example.com',
        role: 'host',
      });
    });

    expect(data).toEqual({ invite: created, emailSent: false });
    expect(queryClient.getQueryData<TeamInvite[]>(allKey)?.map((i) => i.id)).toEqual([
      'new',
      'invite-1',
    ]);
    expect(invalidate).not.toHaveBeenCalled();
    // The form reports create outcomes inline.
    expect(queryClient.getMutationCache().getAll()[0]?.options.meta?.feedback?.error).toBe(false);
  });

  it('resend calls the service and stores the canonical invite', async () => {
    const resent = makeInvite({ updatedAt: '2026-05-02T00:00:00.000Z' });
    service.resendInvite.mockResolvedValue({ invite: resent, emailSent: true });
    const { result, queryClient } = setup(() => useOpsResendTeamInvite());
    queryClient.setQueryData(allKey, [makeInvite()]);

    await act(async () => {
      await result.current.mutateAsync({ restaurantId: RESTAURANT_ID, inviteId: 'invite-1' });
    });

    expect(service.resendInvite).toHaveBeenCalledWith({
      restaurantId: RESTAURANT_ID,
      inviteId: 'invite-1',
    });
    expect(queryClient.getQueryData(allKey)).toEqual([resent]);
    const feedback = queryClient.getMutationCache().getAll()[0]?.options.meta?.feedback;
    expect(typeof feedback?.success).toBe('function');
    const success = feedback?.success as (data: unknown, variables: unknown) => string | null;
    expect(success({ invite: resent, emailSent: true }, {})).toBe(
      'Invitation sent again to pending@example.com.',
    );
    expect(feedback?.error).toMatchObject({
      copy: expect.objectContaining({ INVITE_EXPIRED: expect.any(String) }),
    });
  });

  it('resend reloads the lists when the invite turned out to be stale', async () => {
    service.resendInvite.mockRejectedValue(
      new HttpError({ message: 'Invite has expired', status: 409, code: 'INVITE_EXPIRED' }),
    );
    const { result, queryClient } = setup(() => useOpsResendTeamInvite());
    const invalidate = vi.spyOn(queryClient, 'invalidateQueries');

    await act(async () => {
      await result.current
        .mutateAsync({ restaurantId: RESTAURANT_ID, inviteId: 'invite-1' })
        .catch(() => {});
    });

    expect(invalidate).toHaveBeenCalledWith({
      queryKey: queryKeys.team.invitationsForRestaurant(RESTAURANT_ID),
    });
  });

  it('revoke stores the revoked invite and declares toast feedback', async () => {
    const revoked = makeInvite({ status: 'revoked' });
    service.revokeInvite.mockResolvedValue(revoked);
    const { result, queryClient } = setup(() => useOpsRevokeTeamInvite());
    queryClient.setQueryData(pendingKey, [makeInvite()]);

    await act(async () => {
      await result.current.mutateAsync({ restaurantId: RESTAURANT_ID, inviteId: 'invite-1' });
    });

    expect(queryClient.getQueryData(pendingKey)).toEqual([]);
    const success = queryClient.getMutationCache().getAll()[0]?.options.meta?.feedback
      ?.success as (data: unknown, variables: unknown) => string | null;
    expect(success(revoked, {})).toBe('Invitation for pending@example.com revoked.');
  });
});
