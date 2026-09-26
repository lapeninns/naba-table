import { afterEach, describe, expect, it, vi } from 'vitest';

import { createBrowserTeamService } from '@/services/ops/team';

const INVITE = {
  id: '657902e8-8e0d-49bc-9614-67bd6d7d8cbd',
  restaurantId: '6f4ddf92-6c8b-4ed2-a419-f8af95d7c111',
  email: 'pending@example.com',
  role: 'host',
  status: 'pending',
  expiresAt: '2026-05-01T12:00:00.000Z',
  invitedBy: '33eeab93-378a-41c0-bfaa-9e2e73b7920e',
  acceptedAt: null,
  revokedAt: null,
  createdAt: '2026-04-30T12:00:00.000Z',
  updatedAt: '2026-04-30T12:00:00.000Z',
} as const;

function jsonResponse(body: unknown) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('createBrowserTeamService', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('uses the ops invitation API for list, create, and revoke operations', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.startsWith('/api/ops/team/invitations?')) {
        return jsonResponse({ invites: [INVITE] });
      }
      if (url === '/api/ops/team/invitations') {
        return jsonResponse({ invite: INVITE });
      }
      if (url === '/api/ops/team/invitations/invite-1/resend') {
        return jsonResponse({ invite: INVITE, emailSent: false });
      }
      if (url.startsWith('/api/ops/team/invitations/invite-1?')) {
        return jsonResponse({ invite: INVITE });
      }
      return new Response(JSON.stringify({ error: 'unexpected url', url }), { status: 404 });
    });
    vi.stubGlobal('fetch', fetchMock);

    const service = createBrowserTeamService();
    await service.listInvites(INVITE.restaurantId, 'pending');
    // Responses without the flag come from servers that always sent the email.
    await expect(
      service.createInvite({
        restaurantId: INVITE.restaurantId,
        email: INVITE.email,
        role: INVITE.role,
      }),
    ).resolves.toEqual({ invite: INVITE, emailSent: true });
    await service.revokeInvite({ restaurantId: INVITE.restaurantId, inviteId: 'invite-1' });
    await expect(
      service.resendInvite({ restaurantId: INVITE.restaurantId, inviteId: 'invite-1' }),
    ).resolves.toEqual({ invite: INVITE, emailSent: false });

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      `/api/ops/team/invitations?restaurantId=${INVITE.restaurantId}&status=pending`,
      expect.any(Object),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      '/api/ops/team/invitations',
      expect.objectContaining({ method: 'POST' }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      3,
      `/api/ops/team/invitations/invite-1?restaurantId=${INVITE.restaurantId}`,
      expect.objectContaining({ method: 'DELETE' }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      4,
      '/api/ops/team/invitations/invite-1/resend',
      expect.objectContaining({ method: 'POST' }),
    );
  });
});
