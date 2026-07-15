import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import InvitePage from '@src/app/(public)/invite/[token]/page';

const findInviteByTokenMock = vi.hoisted(() => vi.fn());
const inviteHasExpiredMock = vi.hoisted(() => vi.fn());
const markInviteExpiredMock = vi.hoisted(() => vi.fn());
const resolveInviteContextMock = vi.hoisted(() => vi.fn());
const inviteAcceptanceClientMock = vi.hoisted(() => vi.fn());
const notFoundMock = vi.hoisted(() =>
  vi.fn(() => {
    throw new Error('NEXT_NOT_FOUND');
  }),
);

vi.mock('next/navigation', () => ({
  notFound: notFoundMock,
}));

vi.mock('@/server/team/invitations', () => ({
  findInviteByToken: findInviteByTokenMock,
  inviteHasExpired: inviteHasExpiredMock,
  markInviteExpired: markInviteExpiredMock,
}));

vi.mock('@/server/team/invite-context', () => ({
  resolveInviteContext: resolveInviteContextMock,
}));

vi.mock('@/components/invite/InviteAcceptanceClient', () => ({
  InviteAcceptanceClient: (props: Record<string, unknown>) => {
    inviteAcceptanceClientMock(props);
    return <div data-testid="invite-acceptance-client" />;
  },
}));

const makeInvite = (overrides: Record<string, unknown> = {}) => ({
  id: 'invite-1',
  restaurant_id: 'rest-1',
  email: 'chef@example.com',
  role: 'host',
  status: 'pending',
  expires_at: '2026-06-01T12:00:00.000Z',
  ...overrides,
});

describe('invite page', () => {
  beforeEach(() => {
    findInviteByTokenMock.mockReset();
    inviteHasExpiredMock.mockReset();
    markInviteExpiredMock.mockReset();
    resolveInviteContextMock.mockReset();
    inviteAcceptanceClientMock.mockReset();
    notFoundMock.mockClear();

    inviteHasExpiredMock.mockReturnValue(false);
    resolveInviteContextMock.mockResolvedValue({
      restaurantName: 'Old Crown',
      inviterName: 'Aman',
    });
  });

  it('renders the acceptance client for a pending invite token', async () => {
    findInviteByTokenMock.mockResolvedValue(makeInvite());

    render(await InvitePage({ params: Promise.resolve({ token: 'invite-token-123' }) }));

    expect(findInviteByTokenMock).toHaveBeenCalledWith('invite-token-123');
    expect(inviteAcceptanceClientMock).toHaveBeenCalledWith({
      token: 'invite-token-123',
      invite: {
        email: 'chef@example.com',
        role: 'host',
        restaurantId: 'rest-1',
        restaurantName: 'Old Crown',
        inviterName: 'Aman',
        expiresAt: '2026-06-01T12:00:00.000Z',
      },
    });
    expect(screen.getByTestId('invite-acceptance-client')).toBeInTheDocument();
  });

  it('expires pending invites before rendering the expired status', async () => {
    findInviteByTokenMock.mockResolvedValue(makeInvite());
    inviteHasExpiredMock.mockReturnValue(true);

    render(await InvitePage({ params: Promise.resolve({ token: 'invite-token-123' }) }));

    expect(markInviteExpiredMock).toHaveBeenCalledWith('invite-1');
    expect(screen.getByRole('heading', { name: 'Invitation expired' })).toBeInTheDocument();
    expect(inviteAcceptanceClientMock).not.toHaveBeenCalled();
  });
});
