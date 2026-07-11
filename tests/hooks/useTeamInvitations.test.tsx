import { renderHook, waitFor } from '@testing-library/react';
import { createQueryWrapper, createTestQueryClient } from '@tests/utils/reactQuery';
import { describe, expect, it, vi } from 'vitest';

import {
  useCreateTeamInvite,
  useRevokeTeamInvite,
  useTeamInvitations,
} from '@/hooks/owner/useTeamInvitations';
import { fetchJson } from '@/lib/http/fetchJson';
import { queryKeys } from '@/lib/query/keys';

vi.mock('@/lib/http/fetchJson', () => ({ fetchJson: vi.fn() }));

const restaurantId = '11111111-1111-4111-8111-111111111111';

const invite = {
  id: '22222222-2222-4222-8222-222222222222',
  restaurantId,
  email: 'teammate@example.com',
  role: 'manager',
  status: 'pending',
  expiresAt: '2026-08-01T00:00:00.000Z',
  invitedBy: null,
  acceptedAt: null,
  revokedAt: null,
  createdAt: '2026-07-01T00:00:00.000Z',
  updatedAt: '2026-07-01T00:00:00.000Z',
};

function setup<T>(hook: () => T) {
  const queryClient = createTestQueryClient();
  const wrapper = createQueryWrapper(queryClient);
  return { queryClient, ...renderHook(hook, { wrapper }) };
}

describe('useTeamInvitations', () => {
  it('@contract stays disabled until a restaurant is selected', () => {
    const { result } = setup(() => useTeamInvitations({}));

    expect(result.current.fetchStatus).toBe('idle');
    expect(fetchJson).not.toHaveBeenCalled();
  });

  it('@contract respects an explicit enabled=false even with a restaurant id', () => {
    const { result } = setup(() => useTeamInvitations({ restaurantId, enabled: false }));

    expect(result.current.fetchStatus).toBe('idle');
    expect(fetchJson).not.toHaveBeenCalled();
  });

  it('@contract fetches pending invites without a status param by default', async () => {
    vi.mocked(fetchJson).mockResolvedValue({ invites: [invite] } as never);

    const { result } = setup(() => useTeamInvitations({ restaurantId }));

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const url = vi.mocked(fetchJson).mock.calls[0]?.[0] as string;
    const params = new URLSearchParams(url.split('?')[1]);
    expect(params.get('restaurantId')).toBe(restaurantId);
    expect(params.has('status')).toBe(false);
    expect(result.current.data).toEqual([invite]);
  });

  it('@contract adds the status param for non-default filters', async () => {
    vi.mocked(fetchJson).mockResolvedValue({
      invites: [{ ...invite, status: 'revoked' }],
    } as never);

    const { result } = setup(() =>
      useTeamInvitations({ restaurantId, status: 'revoked' as never }),
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const url = vi.mocked(fetchJson).mock.calls[0]?.[0] as string;
    const params = new URLSearchParams(url.split('?')[1]);
    expect(params.get('status')).toBe('revoked');
  });

  it('@contract rejects payloads that fail schema validation', async () => {
    vi.mocked(fetchJson).mockResolvedValue({ invites: [{ id: 'nope' }] } as never);

    const { result } = setup(() => useTeamInvitations({ restaurantId }));

    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});

describe('useCreateTeamInvite', () => {
  it('@contract validates the payload before sending and invalidates pending invites on success', async () => {
    vi.mocked(fetchJson).mockResolvedValue({ invite } as never);

    const { result, queryClient } = setup(() => useCreateTeamInvite());
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    const payload = { restaurantId, email: 'teammate@example.com', role: 'manager' };
    await expect(result.current.mutateAsync(payload as never)).resolves.toEqual({ invite });

    expect(fetchJson).toHaveBeenCalledWith('/api/ops/team/invitations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: queryKeys.team.invitations(restaurantId, 'pending'),
    });
  });

  it('@contract rejects invalid payloads before any network call', async () => {
    const { result } = setup(() => useCreateTeamInvite());

    await expect(
      result.current.mutateAsync({
        restaurantId: 'not-a-uuid',
        email: 'nope',
        role: 'manager',
      } as never),
    ).rejects.toBeTruthy();
    expect(fetchJson).not.toHaveBeenCalled();
  });
});

describe('useRevokeTeamInvite', () => {
  it('@contract deletes the invite scoped to the restaurant and invalidates pending invites', async () => {
    const revoked = { ...invite, status: 'revoked', revokedAt: '2026-07-02T00:00:00.000Z' };
    vi.mocked(fetchJson).mockResolvedValue({ invite: revoked } as never);

    const { result, queryClient } = setup(() => useRevokeTeamInvite());
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    await expect(
      result.current.mutateAsync({ restaurantId, inviteId: invite.id }),
    ).resolves.toEqual(revoked);

    expect(fetchJson).toHaveBeenCalledWith(
      `/api/ops/team/invitations/${invite.id}?restaurantId=${restaurantId}`,
      { method: 'DELETE' },
    );
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: queryKeys.team.invitations(restaurantId, 'pending'),
    });
  });
});
