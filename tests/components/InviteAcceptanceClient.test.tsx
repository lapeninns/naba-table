import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { InviteAcceptanceClient } from '@/components/invite/InviteAcceptanceClient';

const pushMock = vi.hoisted(() => vi.fn());
const refreshMock = vi.hoisted(() => vi.fn());
const getBrowserCsrfTokenMock = vi.hoisted(() => vi.fn());

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: pushMock,
    refresh: refreshMock,
  }),
}));

vi.mock('@/lib/security/csrf', async () => {
  const actual = await vi.importActual<typeof import('@/lib/security/csrf')>('@/lib/security/csrf');
  return {
    ...actual,
    getBrowserCsrfToken: getBrowserCsrfTokenMock,
  };
});

const invite = {
  email: 'chef@example.com',
  role: 'host',
  restaurantId: 'rest-1',
  restaurantName: 'Old Crown',
  inviterName: 'Aman',
  expiresAt: '2026-06-01T12:00:00.000Z',
};

describe('InviteAcceptanceClient', () => {
  beforeEach(() => {
    pushMock.mockReset();
    refreshMock.mockReset();
    getBrowserCsrfTokenMock.mockReset();
    getBrowserCsrfTokenMock.mockReturnValue('csrf-token');
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        Response.json({
          success: true,
          email: 'chef@example.com',
          restaurantId: '11111111-1111-4111-8111-111111111111',
          role: 'host',
        }),
      ),
    );
  });

  it('accepts invites through the authenticated API without collecting a password', async () => {
    const user = userEvent.setup();
    render(<InviteAcceptanceClient token="invite-token-123" invite={invite} />);

    expect(screen.queryByLabelText('Create password')).not.toBeInTheDocument();

    await user.type(screen.getByLabelText('Full name'), 'Aarya Thapa');
    await user.click(screen.getByRole('button', { name: 'Accept invite' }));

    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));
    expect(fetch).toHaveBeenCalledWith('/api/team/invitations/invite-token-123/accept', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-csrf-token': 'csrf-token',
      },
      body: JSON.stringify({ name: 'Aarya Thapa' }),
    });
    expect(refreshMock).toHaveBeenCalled();
    expect(pushMock).toHaveBeenCalledWith('/app');
  });

  it('redirects unauthenticated invitees to sign in with the invite return path', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        Response.json(
          { error: 'Sign in as the invited email before accepting this invitation' },
          { status: 401 },
        ),
      ),
    );
    const user = userEvent.setup();
    render(<InviteAcceptanceClient token="invite-token-123" invite={invite} />);

    await user.type(screen.getByLabelText('Full name'), 'Aarya Thapa');
    await user.click(screen.getByRole('button', { name: 'Accept invite' }));

    await waitFor(() =>
      expect(pushMock).toHaveBeenCalledWith('/auth/signin?redirectedFrom=/invite/invite-token-123'),
    );
    expect(refreshMock).not.toHaveBeenCalled();
  });
});
