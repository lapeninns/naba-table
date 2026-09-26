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
  const actual = await vi.importActual<Record<string, unknown>>('@/lib/security/csrf');
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
    const [url, init] = vi.mocked(fetch).mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('/api/team/invitations/invite-token-123/accept');
    expect(init.method).toBe('POST');
    expect(init.body).toBe(JSON.stringify({ name: 'Aarya Thapa' }));
    const headers = new Headers(init.headers);
    expect(headers.get('Content-Type')).toBe('application/json');
    expect(headers.get('x-csrf-token')).toBe('csrf-token');
    await waitFor(() => expect(refreshMock).toHaveBeenCalled());
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

  it('shows the specific copy for an expired invitation instead of a generic failure', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        Response.json(
          {
            error: 'This invitation has expired.',
            message: 'This invitation has expired.',
            code: 'INVITE_EXPIRED',
          },
          { status: 410 },
        ),
      ),
    );
    const user = userEvent.setup();
    render(<InviteAcceptanceClient token="invite-token-123" invite={invite} />);

    await user.type(screen.getByLabelText('Full name'), 'Aarya Thapa');
    await user.click(screen.getByRole('button', { name: 'Accept invite' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'This invitation has expired. Ask the restaurant to send a new one.',
    );
    expect(pushMock).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Accept invite' })).toBeEnabled();
  });

  it('never shows server text from a 5xx response', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        Response.json(
          { error: 'relation "restaurant_invites" leaked', code: 'INTERNAL_ERROR' },
          { status: 500 },
        ),
      ),
    );
    const user = userEvent.setup();
    render(<InviteAcceptanceClient token="invite-token-123" invite={invite} />);

    await user.type(screen.getByLabelText('Full name'), 'Aarya Thapa');
    await user.click(screen.getByRole('button', { name: 'Accept invite' }));

    const alert = await screen.findByRole('alert');
    expect(alert).not.toHaveTextContent('leaked');
    expect(alert).toHaveTextContent('Something went wrong on our side. Try again.');
  });

  it('puts a server name validation error on the name field', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        Response.json(
          {
            error: 'Some fields need attention.',
            message: 'Some fields need attention.',
            code: 'VALIDATION_FAILED',
            fields: { name: ['Name must be at least 2 characters'] },
          },
          { status: 400 },
        ),
      ),
    );
    const user = userEvent.setup();
    render(<InviteAcceptanceClient token="invite-token-123" invite={invite} />);

    await user.type(screen.getByLabelText('Full name'), 'Aarya Thapa');
    await user.click(screen.getByRole('button', { name: 'Accept invite' }));

    expect(await screen.findByText('Name must be at least 2 characters')).toBeInTheDocument();
  });
});
