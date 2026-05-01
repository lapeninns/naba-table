import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const teamHooksState = vi.hoisted(() => ({
  createInvite: {
    error: null as Error | null,
    isPending: false,
    mutateAsync: vi.fn(),
  },
  invitations: {
    data: [] as TeamInvite[],
    error: null as Error | null,
    isError: false,
    isFetching: false,
    isLoading: false,
  },
  revokeInvite: {
    isPending: false,
    mutate: vi.fn(),
  },
}));

vi.mock('@/hooks/ops/useOpsTeamInvitations', () => ({
  useOpsCreateTeamInvite: () => teamHooksState.createInvite,
  useOpsRevokeTeamInvite: () => teamHooksState.revokeInvite,
  useOpsTeamInvitations: vi.fn(() => teamHooksState.invitations),
}));

import { OpsTeamManagementClient } from '@/components/features/team/OpsTeamManagementClient';
import { TeamInviteForm } from '@/components/features/team/TeamInviteForm';
import {
  buildTeamInviteRows,
  formatTeamInviteTimestamp,
  getTeamInviteStatusBadgeVariant,
  getTeamInviteStatusLabel,
} from '@/components/features/team/teamInviteModel';
import { TeamInvitesTable } from '@/components/features/team/TeamInvitesTable';
import { OpsSessionProvider } from '@/contexts/ops-session';

import type { TeamInvite } from '@/services/ops/team';
import type { OpsMembership, OpsUser } from '@/types/ops';

const user: OpsUser = {
  id: 'user-1',
  email: 'ops@example.com',
};

function makeMembership(overrides: Partial<OpsMembership> = {}): OpsMembership {
  return {
    restaurantId: 'rest-1',
    restaurantName: 'Test Restaurant',
    restaurantSlug: 'test-restaurant',
    role: 'owner',
    createdAt: null,
    ...overrides,
  };
}

function makeInvite(overrides: Partial<TeamInvite> = {}): TeamInvite {
  return {
    id: 'invite-1',
    restaurantId: 'rest-1',
    email: 'pending@example.com',
    role: 'host',
    status: 'pending',
    tokenHash: 'token-hash',
    expiresAt: '2026-05-01T12:00:00.000Z',
    acceptedAt: null,
    revokedAt: null,
    createdAt: '2026-04-30T12:00:00.000Z',
    updatedAt: '2026-04-30T12:00:00.000Z',
    invitedBy: 'user-1',
    acceptedBy: null,
    revokedBy: null,
    ...overrides,
  };
}

function renderTeamClient(memberships: OpsMembership[]) {
  return render(
    <OpsSessionProvider
      user={user}
      memberships={memberships}
      initialRestaurantId={memberships[0]?.restaurantId ?? null}
    >
      <OpsTeamManagementClient />
    </OpsSessionProvider>,
  );
}

describe('OpsTeamManagementClient', () => {
  beforeEach(() => {
    teamHooksState.createInvite.error = null;
    teamHooksState.createInvite.isPending = false;
    teamHooksState.createInvite.mutateAsync.mockReset();
    teamHooksState.invitations.data = [];
    teamHooksState.invitations.error = null;
    teamHooksState.invitations.isError = false;
    teamHooksState.invitations.isFetching = false;
    teamHooksState.invitations.isLoading = false;
    teamHooksState.revokeInvite.isPending = false;
    teamHooksState.revokeInvite.mutate.mockReset();
  });

  it('shows a no-access state when the operator has no restaurant memberships', () => {
    renderTeamClient([]);

    expect(screen.getByText('No restaurant access')).toBeInTheDocument();
    expect(screen.queryByText('Invite a team member')).not.toBeInTheDocument();
  });

  it('shows limited permissions and hides the invite form for non-manager roles', () => {
    renderTeamClient([makeMembership({ role: 'host' })]);

    expect(screen.getByText('Limited permissions')).toBeInTheDocument();
    expect(screen.queryByText('Invite a team member')).not.toBeInTheDocument();
    expect(screen.getByText('Team invitations')).toBeInTheDocument();
  });
});

describe('TeamInviteForm', () => {
  beforeEach(() => {
    teamHooksState.createInvite.error = null;
    teamHooksState.createInvite.isPending = false;
    teamHooksState.createInvite.mutateAsync.mockReset();
  });

  it('submits a valid invitation and shows the generated invite link', async () => {
    const user = userEvent.setup();
    teamHooksState.createInvite.mutateAsync.mockResolvedValueOnce({
      invite: makeInvite({ email: 'new-manager@example.com', role: 'manager' }),
      inviteUrl: 'https://app.example/invite/token',
    });

    render(<TeamInviteForm restaurantId="rest-1" />);

    await user.type(screen.getByLabelText('Email'), 'new-manager@example.com');
    await user.click(screen.getByRole('button', { name: 'Send invite' }));

    await waitFor(() =>
      expect(teamHooksState.createInvite.mutateAsync).toHaveBeenCalledWith({
        restaurantId: 'rest-1',
        email: 'new-manager@example.com',
        role: 'host',
      }),
    );
    expect(await screen.findByText('Invitation link ready')).toBeInTheDocument();
    expect(screen.getByText('https://app.example/invite/token')).toBeInTheDocument();
  });

  it('renders mutation errors inline', () => {
    teamHooksState.createInvite.error = new Error('Invite already exists.');

    render(<TeamInviteForm restaurantId="rest-1" />);

    expect(screen.getByText('Invitation was not sent')).toBeInTheDocument();
    expect(screen.getByText('Invite already exists.')).toBeInTheDocument();
  });
});

describe('TeamInvitesTable', () => {
  beforeEach(() => {
    teamHooksState.invitations.data = [];
    teamHooksState.invitations.error = null;
    teamHooksState.invitations.isError = false;
    teamHooksState.invitations.isFetching = false;
    teamHooksState.invitations.isLoading = false;
    teamHooksState.revokeInvite.isPending = false;
    teamHooksState.revokeInvite.mutate.mockReset();
  });

  it('shows loading and empty data states', () => {
    teamHooksState.invitations.isLoading = true;
    const { rerender } = render(<TeamInvitesTable restaurantId="rest-1" canManage />);

    expect(screen.getAllByRole('row')).toHaveLength(4);

    teamHooksState.invitations.isLoading = false;
    rerender(<TeamInvitesTable restaurantId="rest-1" canManage />);

    expect(
      screen.getByText('No pending invitations. Invite teammates to collaborate on reservations.'),
    ).toBeInTheDocument();
  });

  it('shows query errors without hiding the table scaffold', () => {
    teamHooksState.invitations.error = new Error('Invitation list failed.');
    teamHooksState.invitations.isError = true;

    render(<TeamInvitesTable restaurantId="rest-1" canManage />);

    expect(screen.getByText('Invitations could not be loaded')).toBeInTheDocument();
    expect(screen.getByText('Invitation list failed.')).toBeInTheDocument();
    expect(screen.getByText('Restaurant team invitations')).toBeInTheDocument();
  });

  it('renders invite status badges and revokes pending invitations for managers', async () => {
    const user = userEvent.setup();
    teamHooksState.invitations.data = [
      makeInvite({ id: 'pending-invite', email: 'pending@example.com', status: 'pending' }),
      makeInvite({
        id: 'accepted-invite',
        email: 'accepted@example.com',
        status: 'accepted',
        acceptedAt: '2026-04-30T13:00:00.000Z',
      }),
    ];

    render(<TeamInvitesTable restaurantId="rest-1" canManage />);

    expect(screen.getByText('pending@example.com')).toBeInTheDocument();
    expect(screen.getByText('accepted@example.com')).toBeInTheDocument();
    expect(screen.getAllByText('Pending').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Accepted')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Revoke' }));

    expect(teamHooksState.revokeInvite.mutate).toHaveBeenCalledWith({
      restaurantId: 'rest-1',
      inviteId: 'pending-invite',
    });
  });
});

describe('team invite model', () => {
  it('formats invite labels, badge variants, and nullable timestamps', () => {
    expect(getTeamInviteStatusLabel('pending')).toBe('Pending');
    expect(getTeamInviteStatusLabel('accepted')).toBe('Accepted');
    expect(getTeamInviteStatusBadgeVariant('pending')).toBe('secondary');
    expect(getTeamInviteStatusBadgeVariant('accepted')).toBe('default');
    expect(getTeamInviteStatusBadgeVariant('revoked')).toBe('outline');
    expect(formatTeamInviteTimestamp(null)).toBe('—');
  });

  it('marks only pending invites past their expiry as expired by date', () => {
    const pendingExpired = makeInvite({
      id: 'pending-expired',
      status: 'pending',
      expiresAt: '2026-04-29T12:00:00.000Z',
    });
    const acceptedExpired = makeInvite({
      id: 'accepted-expired',
      status: 'accepted',
      expiresAt: '2026-04-29T12:00:00.000Z',
    });

    expect(
      buildTeamInviteRows([pendingExpired, acceptedExpired], Date.parse('2026-04-30')),
    ).toEqual([
      expect.objectContaining({ invite: pendingExpired, isExpiredPending: true }),
      expect.objectContaining({ invite: acceptedExpired, isExpiredPending: false }),
    ]);
  });
});
