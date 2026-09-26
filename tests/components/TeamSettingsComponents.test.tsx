import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const teamHooksState = vi.hoisted(() => ({
  createInvite: {
    error: null as Error | null,
    isPending: false,
    mutateAsync: vi.fn(),
  },
  invitations: {
    data: [] as TeamInvite[] | undefined,
    error: null as Error | null,
    isError: false,
    isFetching: false,
    isLoading: false,
    refetch: vi.fn(),
  },
  revokeInvite: {
    isPending: false,
    mutateAsync: vi.fn(),
  },
  resendInvite: {
    isPending: false,
    mutateAsync: vi.fn(),
  },
}));

const toastMocks = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));

vi.mock('sonner', () => ({ toast: toastMocks }));

vi.mock('@/hooks/ops/useOpsTeamInvitations', () => ({
  useOpsCreateTeamInvite: () => teamHooksState.createInvite,
  useOpsRevokeTeamInvite: () => teamHooksState.revokeInvite,
  useOpsResendTeamInvite: () => teamHooksState.resendInvite,
  useOpsTeamInvitations: vi.fn(() => teamHooksState.invitations),
}));

import { OpsTeamManagementClient } from '@/components/features/team/OpsTeamManagementClient';
import { TeamInviteForm } from '@/components/features/team/TeamInviteForm';
import {
  countTeamInvites,
  describeTeamInviteFailure,
  filterTeamInvites,
  formatTeamInviteDate,
  getTeamInviteDisplayStatus,
  hasWaitingTeamInvite,
} from '@/components/features/team/teamInviteModel';
import { TeamInvitesTable } from '@/components/features/team/TeamInvitesTable';
import { OpsSessionProvider } from '@/contexts/ops-session';
import { useOpsTeamInvitations } from '@/hooks/ops/useOpsTeamInvitations';
import { HttpError } from '@/lib/http/errors';

import type { TeamInvite } from '@/services/ops/team';
import type { OpsMembership, OpsUser } from '@/types/ops';

const user: OpsUser = {
  id: 'user-1',
  email: 'ops@example.com',
};

const FUTURE = '2099-05-01T12:00:00.000Z';
const PAST = '2020-05-01T12:00:00.000Z';

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
    expiresAt: FUTURE,
    acceptedAt: null,
    revokedAt: null,
    createdAt: '2026-04-30T12:00:00.000Z',
    updatedAt: '2026-04-30T12:00:00.000Z',
    invitedBy: null,
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

function renderTable(canManage = true) {
  const state = teamHooksState.invitations;
  return render(
    <TeamInvitesTable
      restaurantId="rest-1"
      canManage={canManage}
      invites={state.data}
      isLoading={state.isLoading}
      isFetching={state.isFetching}
      error={state.error}
      onRetry={state.refetch}
    />,
  );
}

function resetState() {
  teamHooksState.createInvite.error = null;
  teamHooksState.createInvite.isPending = false;
  teamHooksState.createInvite.mutateAsync.mockReset();
  teamHooksState.invitations.data = [];
  teamHooksState.invitations.error = null;
  teamHooksState.invitations.isError = false;
  teamHooksState.invitations.isFetching = false;
  teamHooksState.invitations.isLoading = false;
  teamHooksState.invitations.refetch.mockReset();
  teamHooksState.revokeInvite.isPending = false;
  teamHooksState.revokeInvite.mutateAsync.mockReset();
  teamHooksState.resendInvite.isPending = false;
  teamHooksState.resendInvite.mutateAsync.mockReset();
  toastMocks.success.mockReset();
  toastMocks.error.mockReset();
  vi.mocked(useOpsTeamInvitations).mockClear();
}

describe('OpsTeamManagementClient', () => {
  beforeEach(resetState);

  it('shows a no-access state when the operator has no restaurant memberships', () => {
    renderTeamClient([]);

    expect(screen.getByText('No restaurant access')).toBeInTheDocument();
    expect(screen.queryByText('Invite someone')).not.toBeInTheDocument();
  });

  it('states the owner role, shows the invite form and loads every invitation once', () => {
    renderTeamClient([makeMembership({ role: 'owner' })]);

    expect(
      screen.getByText(
        'You’re signed in as an Owner, so you can invite people and revoke invitations.',
      ),
    ).toBeInTheDocument();
    expect(screen.getByRole('form', { name: 'Invite someone' })).toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'Filter invitations' })).toBeInTheDocument();
    expect(screen.queryByText('Team workflow')).not.toBeInTheDocument();
    expect(useOpsTeamInvitations).toHaveBeenCalledWith({ restaurantId: 'rest-1', status: 'all' });
  });

  it('shows a view-only state for hosts and a calm message when invitations cannot load', () => {
    teamHooksState.invitations.data = undefined;
    teamHooksState.invitations.error = new HttpError({ message: 'Forbidden', status: 403 });
    teamHooksState.invitations.isError = true;

    renderTeamClient([makeMembership({ role: 'host' })]);

    expect(
      screen.getByText(
        'You’re signed in as a Host. Only owners and managers can invite people or revoke invitations.',
      ),
    ).toBeInTheDocument();
    expect(screen.getByText('Only owners and managers can invite people.')).toBeInTheDocument();
    expect(screen.queryByRole('form', { name: 'Invite someone' })).not.toBeInTheDocument();
    expect(
      screen.getByText('Only owners and managers can see the invitations for this restaurant.'),
    ).toBeInTheDocument();
    expect(screen.queryByText('Invitations couldn’t be loaded')).not.toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});

describe('TeamInviteForm', () => {
  beforeEach(resetState);

  it('sends an invitation and reports the recipient and expiry date', async () => {
    const actor = userEvent.setup();
    teamHooksState.createInvite.mutateAsync.mockResolvedValueOnce({
      invite: makeInvite({
        email: 'new-manager@example.com',
        role: 'manager',
        expiresAt: '2026-10-02T12:00:00.000Z',
      }),
      emailSent: true,
    });

    render(<TeamInviteForm restaurantId="rest-1" existingInvites={[]} />);

    await actor.type(screen.getByLabelText('Email'), 'new-manager@example.com');
    await actor.click(screen.getByRole('button', { name: 'Send invitation' }));

    await waitFor(() =>
      expect(teamHooksState.createInvite.mutateAsync).toHaveBeenCalledWith({
        restaurantId: 'rest-1',
        email: 'new-manager@example.com',
        role: 'host',
      }),
    );
    const result = await screen.findByRole('status');
    expect(result).toHaveTextContent('Invitation sent to new-manager@example.com');
    expect(result).toHaveTextContent('It expires on 2 Oct 2026.');
    expect(screen.getByLabelText('Email')).toHaveValue('');
    expect(screen.queryByRole('button', { name: /copy/i })).not.toBeInTheDocument();
  });

  it('says when the invitation was created but its email was not sent', async () => {
    const actor = userEvent.setup();
    teamHooksState.createInvite.mutateAsync.mockResolvedValueOnce({
      invite: makeInvite({ email: 'new-host@example.com' }),
      emailSent: false,
    });

    render(<TeamInviteForm restaurantId="rest-1" existingInvites={[]} />);

    await actor.type(screen.getByLabelText('Email'), 'new-host@example.com');
    await actor.click(screen.getByRole('button', { name: 'Send invitation' }));

    const result = await screen.findByRole('status');
    expect(result).toHaveTextContent(
      'Invitation created for new-host@example.com, but the email wasn’t sent',
    );
    expect(result).toHaveTextContent('Use Resend in the invitations list');
  });

  it('blocks an email that already has an invitation waiting', async () => {
    const actor = userEvent.setup();
    render(
      <TeamInviteForm
        restaurantId="rest-1"
        existingInvites={[makeInvite({ email: 'waiting@example.com' })]}
      />,
    );

    await actor.type(screen.getByLabelText('Email'), 'Waiting@Example.com');
    await actor.click(screen.getByRole('button', { name: 'Send invitation' }));

    expect(
      await screen.findByText('This person already has an invitation waiting'),
    ).toBeInTheDocument();
    expect(screen.getByLabelText('Email')).toHaveAttribute('aria-invalid', 'true');
    expect(teamHooksState.createInvite.mutateAsync).not.toHaveBeenCalled();
  });

  it('allows inviting someone whose earlier invitation expired', async () => {
    const actor = userEvent.setup();
    teamHooksState.createInvite.mutateAsync.mockResolvedValueOnce({
      invite: makeInvite({ email: 'again@example.com' }),
      emailSent: true,
    });
    render(
      <TeamInviteForm
        restaurantId="rest-1"
        existingInvites={[makeInvite({ email: 'again@example.com', expiresAt: PAST })]}
      />,
    );

    await actor.type(screen.getByLabelText('Email'), 'again@example.com');
    await actor.click(screen.getByRole('button', { name: 'Send invitation' }));

    await waitFor(() => expect(teamHooksState.createInvite.mutateAsync).toHaveBeenCalled());
  });

  it('shows the rate limit reason and code when the invitation was not sent', async () => {
    const actor = userEvent.setup();
    teamHooksState.createInvite.mutateAsync.mockRejectedValueOnce(
      new HttpError({ message: 'Too Many Requests', status: 429, code: 'RATE_LIMITED' }),
    );

    render(<TeamInviteForm restaurantId="rest-1" existingInvites={[]} />);

    await actor.type(screen.getByLabelText('Email'), 'busy@example.com');
    await actor.click(screen.getByRole('button', { name: 'Send invitation' }));

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Invitation wasn’t sent');
    expect(alert).toHaveTextContent(
      'Too many invitations sent recently. Try again in about 10 minutes.',
    );
    expect(within(alert).getByText('RATE_LIMITED')).toHaveClass('font-mono');
    expect(screen.getByLabelText('Email')).toHaveValue('busy@example.com');
  });

  it('shows a sending label while the request is in flight', () => {
    teamHooksState.createInvite.isPending = true;

    render(<TeamInviteForm restaurantId="rest-1" existingInvites={[]} />);

    expect(screen.getByRole('button', { name: 'Sending…' })).toBeDisabled();
  });

  it('describes the selected role and lists what each role can do', async () => {
    const actor = userEvent.setup();
    render(<TeamInviteForm restaurantId="rest-1" existingInvites={[]} />);

    expect(
      screen.getByText(
        'Manages bookings and guest communication. Can’t change settings or invite people.',
      ),
    ).toBeInTheDocument();

    await actor.click(screen.getByRole('button', { name: 'What each role can do' }));

    expect(
      screen.getByText('Full access, including settings and inviting any role.'),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        'Manages settings, bookings and the team. Can invite managers, hosts and servers.',
      ),
    ).toBeInTheDocument();
    expect(screen.getByText('Staff access for service.')).toBeInTheDocument();
  });
});

describe('TeamInvitesTable', () => {
  beforeEach(resetState);

  it('shows loading skeletons, then the waiting empty state', () => {
    teamHooksState.invitations.isLoading = true;
    const { unmount } = renderTable();

    expect(screen.getByRole('list', { name: 'Loading invitations' })).toBeInTheDocument();
    unmount();

    teamHooksState.invitations.isLoading = false;
    renderTable();

    expect(screen.getByText('No invitations waiting')).toBeInTheDocument();
    expect(
      screen.getByText('Invite managers and hosts so you aren’t the only person with access.'),
    ).toBeInTheDocument();
  });

  it('shows a load error with the reason code and a retry for managers', async () => {
    const actor = userEvent.setup();
    teamHooksState.invitations.data = undefined;
    teamHooksState.invitations.error = new HttpError({ message: 'Server error', status: 500 });
    teamHooksState.invitations.isError = true;

    renderTable();

    expect(screen.getByText('Invitations couldn’t be loaded')).toBeInTheDocument();
    expect(screen.getByText('HTTP_500')).toHaveClass('font-mono');
    expect(screen.queryByText('Server error')).not.toBeInTheDocument();
    await actor.click(screen.getByRole('button', { name: 'Try again' }));
    expect(teamHooksState.invitations.refetch).toHaveBeenCalled();
  });

  it('filters by one status per invitation with counts and shows sent and expiry dates', async () => {
    const actor = userEvent.setup();
    teamHooksState.invitations.data = [
      makeInvite({
        id: 'waiting',
        email: 'waiting@example.com',
        createdAt: '2026-09-23T12:00:00.000Z',
        expiresAt: '2099-09-30T12:00:00.000Z',
      }),
      makeInvite({
        id: 'overdue',
        email: 'overdue@example.com',
        createdAt: '2020-09-15T12:00:00.000Z',
        expiresAt: '2020-09-22T12:00:00.000Z',
      }),
      makeInvite({ id: 'accepted', email: 'accepted@example.com', status: 'accepted' }),
      makeInvite({ id: 'revoked', email: 'revoked@example.com', status: 'revoked' }),
    ];

    renderTable();

    const filters = screen.getByRole('group', { name: 'Filter invitations' });
    expect(within(filters).getByRole('button', { name: 'Waiting 1' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(within(filters).getByRole('button', { name: 'Expired 1' })).toBeInTheDocument();
    expect(within(filters).getByRole('button', { name: 'Accepted 1' })).toBeInTheDocument();
    expect(within(filters).getByRole('button', { name: 'Revoked 1' })).toBeInTheDocument();
    expect(within(filters).getByRole('button', { name: 'All 4' })).toBeInTheDocument();

    const waitingRow = screen.getByTestId('team-invite-waiting');
    expect(waitingRow).toHaveTextContent('Waiting to be accepted');
    expect(waitingRow).toHaveTextContent('Sent 23 Sep 2026 · Expires 30 Sep 2099');
    expect(screen.queryByTestId('team-invite-overdue')).not.toBeInTheDocument();

    await actor.click(within(filters).getByRole('button', { name: 'Expired 1' }));

    const overdueRow = screen.getByTestId('team-invite-overdue');
    expect(overdueRow).toHaveTextContent('Expired');
    expect(overdueRow).not.toHaveTextContent('Waiting to be accepted');
    expect(overdueRow).not.toHaveTextContent('Expired by date');
    expect(overdueRow).toHaveTextContent('Sent 15 Sep 2020 · Expired 22 Sep 2020');
    expect(within(overdueRow).queryByRole('button', { name: /Revoke/ })).not.toBeInTheDocument();

    await actor.click(within(filters).getByRole('button', { name: 'Revoked 1' }));
    expect(screen.getByTestId('team-invite-revoked')).toBeInTheDocument();

    await actor.click(within(filters).getByRole('button', { name: 'Accepted 1' }));
    expect(screen.getByTestId('team-invite-accepted')).toBeInTheDocument();
  });

  it('shows the no-match empty state for other filters', async () => {
    const actor = userEvent.setup();
    renderTable();

    await actor.click(screen.getByRole('button', { name: 'Revoked 0' }));

    expect(screen.getByText('Nothing here')).toBeInTheDocument();
    expect(screen.getByText('No invitations match this filter.')).toBeInTheDocument();
  });

  it('confirms a revoke naming the email and sends it through the hook', async () => {
    const actor = userEvent.setup();
    teamHooksState.invitations.data = [
      makeInvite({ id: 'pending-invite', email: 'pending@example.com' }),
    ];
    teamHooksState.revokeInvite.mutateAsync.mockResolvedValue(
      makeInvite({ id: 'pending-invite', status: 'revoked' }),
    );

    renderTable();

    await actor.click(
      screen.getByRole('button', { name: 'Revoke invitation for pending@example.com' }),
    );

    const dialog = await screen.findByRole('alertdialog');
    expect(dialog).toHaveTextContent(
      'The link sent to pending@example.com stops working straight away. You can invite them again later.',
    );
    await actor.click(within(dialog).getByRole('button', { name: 'Revoke invitation' }));

    expect(teamHooksState.revokeInvite.mutateAsync).toHaveBeenCalledWith({
      restaurantId: 'rest-1',
      inviteId: 'pending-invite',
    });
    // Feedback toasts come from the hook's mutation meta, not the table.
    expect(toastMocks.success).not.toHaveBeenCalled();
  });

  it('keeps the pending state per row while one invitation is being revoked', async () => {
    const actor = userEvent.setup();
    teamHooksState.invitations.data = [
      makeInvite({ id: 'first', email: 'first@example.com' }),
      makeInvite({ id: 'second', email: 'second@example.com' }),
    ];
    let settle: (value: unknown) => void = () => {};
    teamHooksState.revokeInvite.mutateAsync.mockImplementation(
      () => new Promise((resolve) => (settle = resolve)),
    );

    renderTable();

    await actor.click(screen.getByRole('button', { name: 'Revoke invitation for first@example.com' }));
    await actor.click(
      within(await screen.findByRole('alertdialog')).getByRole('button', {
        name: 'Revoke invitation',
      }),
    );

    const firstRow = screen.getByTestId('team-invite-first');
    const secondRow = screen.getByTestId('team-invite-second');
    await waitFor(() =>
      expect(
        within(firstRow).getByRole('button', { name: /Revoking… invitation for first/ }),
      ).toBeDisabled(),
    );
    expect(within(firstRow).getByRole('button', { name: /Resend invitation for first/ })).toBeDisabled();
    expect(
      within(secondRow).getByRole('button', { name: 'Revoke invitation for second@example.com' }),
    ).toBeEnabled();
    expect(
      within(secondRow).getByRole('button', { name: 'Resend invitation for second@example.com' }),
    ).toBeEnabled();

    settle(makeInvite({ id: 'first', status: 'revoked' }));
    await waitFor(() =>
      expect(
        within(firstRow).getByRole('button', { name: 'Revoke invitation for first@example.com' }),
      ).toBeEnabled(),
    );
  });

  it('resends a pending invitation from its row and shows progress on that row only', async () => {
    const actor = userEvent.setup();
    teamHooksState.invitations.data = [
      makeInvite({ id: 'first', email: 'first@example.com' }),
      makeInvite({ id: 'second', email: 'second@example.com' }),
    ];
    let settle: (value: unknown) => void = () => {};
    teamHooksState.resendInvite.mutateAsync.mockImplementation(
      () => new Promise((resolve) => (settle = resolve)),
    );

    renderTable();

    await actor.click(screen.getByRole('button', { name: 'Resend invitation for first@example.com' }));

    expect(teamHooksState.resendInvite.mutateAsync).toHaveBeenCalledWith({
      restaurantId: 'rest-1',
      inviteId: 'first',
    });
    const firstRow = screen.getByTestId('team-invite-first');
    expect(
      within(firstRow).getByRole('button', { name: /Resending… invitation for first/ }),
    ).toBeDisabled();
    expect(
      screen.getByRole('button', { name: 'Resend invitation for second@example.com' }),
    ).toBeEnabled();

    settle({ invite: makeInvite({ id: 'first' }), emailSent: true });
    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: 'Resend invitation for first@example.com' }),
      ).toBeEnabled(),
    );
  });

  it('keeps the row usable after a failed resend', async () => {
    const actor = userEvent.setup();
    teamHooksState.invitations.data = [makeInvite({ id: 'first', email: 'first@example.com' })];
    teamHooksState.resendInvite.mutateAsync.mockRejectedValue(
      new HttpError({ message: 'expired', status: 409, code: 'INVITE_EXPIRED' }),
    );

    renderTable();
    await actor.click(screen.getByRole('button', { name: 'Resend invitation for first@example.com' }));

    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: 'Resend invitation for first@example.com' }),
      ).toBeEnabled(),
    );
  });

  it('does not offer resend on invitations that are not waiting', () => {
    teamHooksState.invitations.data = [
      makeInvite({ id: 'expired', expiresAt: PAST }),
      makeInvite({ id: 'accepted', status: 'accepted' }),
    ];

    renderTable();

    expect(screen.queryByRole('button', { name: /^Resend/ })).not.toBeInTheDocument();
  });

  it('hides revoke for view-only roles', () => {
    teamHooksState.invitations.data = [makeInvite()];

    renderTable(false);

    expect(screen.queryByRole('button', { name: /^Revoke invitation/ })).not.toBeInTheDocument();
  });
});

describe('team invite model', () => {
  const now = Date.parse('2026-09-25T12:00:00.000Z');

  it('gives each invitation a single status, expiring overdue pending invites', () => {
    expect(getTeamInviteDisplayStatus(makeInvite({ expiresAt: PAST }), now)).toBe('expired');
    expect(getTeamInviteDisplayStatus(makeInvite({ expiresAt: FUTURE }), now)).toBe('pending');
    expect(
      getTeamInviteDisplayStatus(makeInvite({ status: 'accepted', expiresAt: PAST }), now),
    ).toBe('accepted');
    expect(getTeamInviteDisplayStatus(makeInvite({ status: 'expired' }), now)).toBe('expired');
  });

  it('counts and filters invitations newest first', () => {
    const invites = [
      makeInvite({ id: 'old', createdAt: '2026-09-01T12:00:00.000Z' }),
      makeInvite({ id: 'new', createdAt: '2026-09-20T12:00:00.000Z' }),
      makeInvite({ id: 'gone', expiresAt: PAST }),
    ];

    expect(countTeamInvites(invites, now)).toEqual({
      pending: 2,
      expired: 1,
      accepted: 0,
      revoked: 0,
      all: 3,
    });
    expect(filterTeamInvites(invites, 'pending', now).map((row) => row.invite.id)).toEqual([
      'new',
      'old',
    ]);
  });

  it('detects a waiting invitation case-insensitively', () => {
    const invites = [makeInvite({ email: 'host@example.com' })];

    expect(hasWaitingTeamInvite(invites, ' HOST@example.com ', now)).toBe(true);
    expect(hasWaitingTeamInvite(invites, 'other@example.com', now)).toBe(false);
    expect(
      hasWaitingTeamInvite(
        [makeInvite({ email: 'host@example.com', expiresAt: PAST })],
        'host@example.com',
        now,
      ),
    ).toBe(false);
  });

  it('maps invitation failures to safe copy and the real reason code', () => {
    expect(
      describeTeamInviteFailure(
        new HttpError({ message: 'Too Many Requests', status: 429, code: 'RATE_LIMITED' }),
      ),
    ).toEqual({
      message: 'Too many invitations sent recently. Try again in about 10 minutes.',
      code: 'RATE_LIMITED',
    });
    expect(describeTeamInviteFailure(new HttpError({ message: 'Conflict', status: 409 }))).toEqual({
      message: 'This person already has an invitation waiting.',
      code: 'HTTP_409',
    });
    expect(describeTeamInviteFailure(new Error('boom')).code).toBe('unknown_error');
  });

  it('formats dates in British style and tolerates missing values', () => {
    expect(formatTeamInviteDate('2026-09-30T12:00:00.000Z')).toBe('30 Sep 2026');
    expect(formatTeamInviteDate(null)).toBe('—');
  });
});
