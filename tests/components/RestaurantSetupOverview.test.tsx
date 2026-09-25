import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const overviewState = vi.hoisted(() => ({
  session: {
    memberships: [
      {
        restaurantId: 'rest-1',
        restaurantName: 'Old Crown Girton',
        restaurantSlug: 'old-crown-girton',
        role: 'owner',
        createdAt: null,
      },
    ],
    activeRestaurantId: 'rest-1',
  },
  activeMembership: {
    restaurantId: 'rest-1',
    restaurantName: 'Old Crown Girton',
    restaurantSlug: 'old-crown-girton',
    role: 'owner',
    createdAt: null,
  },
  tableService: {
    list: vi.fn(),
  },
  detailsQuery: {
    data: {
      id: 'rest-1',
      name: 'Old Crown Girton',
      slug: 'old-crown-girton',
      timezone: 'Europe/London',
      contactEmail: 'ops@oldcrowngirton.example',
      contactPhone: '+441223277217',
      address: '1 High Street',
    },
    isLoading: false,
    isError: false,
    isFetching: false,
    refetch: vi.fn(),
  },
  hoursQuery: {
    data: {
      weekly: [{ isClosed: false }],
    },
    isLoading: false,
    isError: false,
    isFetching: false,
    refetch: vi.fn(),
  },
  servicePeriodsQuery: {
    data: [{ id: 'lunch-1' }],
    isLoading: false,
    isError: false,
    isFetching: false,
    refetch: vi.fn(),
  },
  menuQuery: {
    data: { menus: [] },
    isError: false,
    refetch: vi.fn(),
  },
  teamQuery: {
    data: [],
    isError: false,
    refetch: vi.fn(),
  },
}));

vi.mock('@/contexts/ops-session', () => ({
  useOpsSession: () => overviewState.session,
  useOpsActiveMembership: () => overviewState.activeMembership,
}));

vi.mock('next/navigation', () => ({
  usePathname: () => '/app/settings/restaurant',
}));

vi.mock('@/contexts/ops-services', () => ({
  useTableInventoryService: () => overviewState.tableService,
}));

vi.mock('@/hooks/ops/useOpsRestaurantDetails', () => ({
  useOpsRestaurantDetails: () => overviewState.detailsQuery,
}));

vi.mock('@/hooks/ops/useOpsOperatingHours', () => ({
  useOpsOperatingHours: () => overviewState.hoursQuery,
}));

vi.mock('@/hooks/ops/useOpsServicePeriods', () => ({
  useOpsServicePeriods: () => overviewState.servicePeriodsQuery,
}));

vi.mock('@/hooks/ops/useOpsMenuHierarchy', () => ({
  useOpsMenuHierarchy: () => overviewState.menuQuery,
}));

vi.mock('@/hooks/ops/useOpsTeamInvitations', () => ({
  useOpsTeamInvitations: () => overviewState.teamQuery,
}));

import { RestaurantSetupOverview } from '@/components/features/restaurant-settings/RestaurantSetupOverview';

function renderOverview() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, refetchOnWindowFocus: false },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <RestaurantSetupOverview />
    </QueryClientProvider>,
  );
}

describe('RestaurantSetupOverview', () => {
  beforeEach(() => {
    overviewState.session.activeRestaurantId = 'rest-1';
    overviewState.session.memberships = [
      {
        restaurantId: 'rest-1',
        restaurantName: 'Old Crown Girton',
        restaurantSlug: 'old-crown-girton',
        role: 'owner',
        createdAt: null,
      },
    ];
    overviewState.activeMembership = {
      restaurantId: 'rest-1',
      restaurantName: 'Old Crown Girton',
      restaurantSlug: 'old-crown-girton',
      role: 'owner',
      createdAt: null,
    };
    overviewState.tableService.list.mockReset();
    overviewState.tableService.list.mockResolvedValue({
      tables: [],
      summary: { totalTables: 4, availableTables: 4 },
    });
    overviewState.detailsQuery.data = {
      id: 'rest-1',
      name: 'Old Crown Girton',
      slug: 'old-crown-girton',
      timezone: 'Europe/London',
      contactEmail: 'ops@oldcrowngirton.example',
      contactPhone: '+441223277217',
      address: '1 High Street',
    };
    overviewState.detailsQuery.isLoading = false;
    overviewState.hoursQuery.data = {
      weekly: [{ isClosed: false }],
    };
    overviewState.hoursQuery.isLoading = false;
    overviewState.servicePeriodsQuery.data = [{ id: 'lunch-1' }];
    overviewState.servicePeriodsQuery.isLoading = false;
    overviewState.menuQuery.data = { menus: [] };
    overviewState.teamQuery.data = [];
    for (const query of [
      overviewState.detailsQuery,
      overviewState.hoursQuery,
      overviewState.servicePeriodsQuery,
      overviewState.menuQuery,
      overviewState.teamQuery,
    ]) {
      query.isError = false;
      query.refetch.mockReset();
    }
  });

  it('shows the readiness summary and links each required row to its settings page', async () => {
    renderOverview();

    await waitFor(() =>
      // Same request and cache entry as the Tables page: the list includes the summary by default.
      expect(overviewState.tableService.list).toHaveBeenCalledWith('rest-1'),
    );
    const summary = await screen.findByRole('region', { name: 'Ready to take bookings' });
    expect(
      within(summary).getByText(
        '3 of 3 required steps complete. Guests can request times on your booking page.',
      ),
    ).toBeInTheDocument();
    expect(
      within(summary).getByRole('img', { name: '3 of 3 required steps complete' }),
    ).toBeInTheDocument();
    expect(within(summary).getByRole('link', { name: 'Preview guest times' })).toHaveAttribute(
      'href',
      '/app/settings/restaurant/availability',
    );

    expect(screen.getByRole('link', { name: 'Open profile' })).toHaveAttribute(
      'href',
      '/app/settings/restaurant/profile',
    );
    expect(screen.getByRole('link', { name: 'Open availability' })).toHaveAttribute(
      'href',
      '/app/settings/restaurant/availability#weekly-hours',
    );
    expect(screen.getByRole('link', { name: 'Open tables' })).toHaveAttribute(
      'href',
      '/app/settings/restaurant/tables',
    );
    expect(screen.queryByText('Setup flow')).not.toBeInTheDocument();
  });

  it('lists what was checked for each required step', async () => {
    renderOverview();

    const required = await screen.findByRole('region', {
      name: 'Required before guests can book',
    });
    const tables = await within(required).findByRole('listitem', { name: /Seating capacity/ });
    await waitFor(() => expect(within(tables).getByText('4 tables added')).toBeInTheDocument());
    expect(within(tables).getByText('4 bookable now')).toBeInTheDocument();

    const availability = within(required).getByRole('listitem', { name: /Booking availability/ });
    expect(
      within(within(availability).getByRole('list', { name: 'What was checked' })).getAllByRole(
        'listitem',
      ),
    ).toHaveLength(2);
    expect(within(availability).getByText('1 day open each week')).toBeInTheDocument();
    expect(within(availability).getByText('1 meal time set')).toBeInTheDocument();
  });

  it('marks profile as needs attention and names it as the next step when the name is missing', async () => {
    overviewState.detailsQuery.data = {
      ...overviewState.detailsQuery.data,
      name: '',
    };

    renderOverview();

    const summary = await screen.findByRole('region', { name: 'Not ready for bookings yet' });
    expect(
      await within(summary).findByText('2 of 3 required steps complete. Next: public profile.'),
    ).toBeInTheDocument();
    expect(within(summary).queryByRole('link', { name: 'Preview guest times' })).toBeNull();

    const profile = screen.getByRole('listitem', { name: /Public profile/ });
    expect(within(profile).getByText('Needs attention')).toBeInTheDocument();
    expect(within(profile).getByText('Missing:', { exact: false })).toHaveTextContent('Missing:');
    expect(within(profile).getByText('Restaurant name')).toBeInTheDocument();
  });

  it('gives only the first incomplete required step the primary button', async () => {
    overviewState.detailsQuery.data = {
      ...overviewState.detailsQuery.data,
      contactPhone: null,
    };
    overviewState.servicePeriodsQuery.data = [];

    renderOverview();

    const profileLink = await screen.findByRole('link', { name: 'Open profile' });
    const primaryLinks = screen
      .getAllByRole('link')
      .filter((link) => link.classList.contains('bg-primary'));
    expect(primaryLinks).toEqual([profileLink]);
    expect(screen.getByRole('link', { name: 'Open availability' })).toHaveClass('bg-background');
  });

  it('keeps the current optional rules and wording', async () => {
    overviewState.menuQuery.data = { menus: [{ id: 'menu-1' }] } as never;
    // The overview reads the Team page's 'all' list and counts only pending invitations.
    overviewState.teamQuery.data = [
      { id: 'invite-1', status: 'pending' },
      { id: 'invite-2', status: 'accepted' },
    ] as never;

    renderOverview();

    const optional = await screen.findByRole('region', { name: 'Optional' });
    const google = within(optional).getByRole('listitem', { name: /Google Business Profile/ });
    expect(within(google).getByText('Optional')).toBeInTheDocument();
    expect(
      within(google).getByText('Useful after the profile and availability basics are ready.'),
    ).toBeInTheDocument();
    expect(within(optional).getByText('1 menu catalogue entry found.')).toBeInTheDocument();
    expect(within(optional).getByText('1 pending invite.')).toBeInTheDocument();
    expect(within(optional).queryByText(/Proposed/)).toBeNull();
  });

  it('shows "Couldn’t check" on the failed row and refetches only that row’s failed checks', async () => {
    const user = userEvent.setup();
    overviewState.servicePeriodsQuery.isError = true;

    renderOverview();

    expect(await screen.findByText('Some setup checks could not load')).toBeInTheDocument();
    const availability = await screen.findByRole('listitem', { name: /Booking availability/ });
    expect(within(availability).getByText('Couldn’t check')).toBeInTheDocument();
    expect(
      within(availability).getByText(
        'The availability check didn’t respond, so this status may be out of date. Saved settings are unchanged.',
      ),
    ).toBeInTheDocument();
    expect(within(availability).queryByRole('list', { name: 'What was checked' })).toBeNull();
    expect(screen.getByRole('region', { name: 'Some checks couldn’t run' })).toBeInTheDocument();

    await user.click(within(availability).getByRole('button', { name: 'Check again' }));

    expect(overviewState.servicePeriodsQuery.refetch).toHaveBeenCalledTimes(1);
    expect(overviewState.hoursQuery.refetch).not.toHaveBeenCalled();
    expect(overviewState.detailsQuery.refetch).not.toHaveBeenCalled();
  });

  it('marks the tables row as failed when the tables request errors and checks it again', async () => {
    const user = userEvent.setup();
    overviewState.tableService.list.mockRejectedValue(new Error('network'));

    renderOverview();

    const tables = await screen.findByRole('listitem', { name: /Seating capacity/ });
    await waitFor(() => expect(within(tables).getByText('Couldn’t check')).toBeInTheDocument());

    overviewState.tableService.list.mockResolvedValue({
      tables: [],
      summary: { totalTables: 2, availableTables: 2 },
    });
    await user.click(within(tables).getByRole('button', { name: 'Check again' }));

    await waitFor(() => expect(within(tables).getByText('Complete')).toBeInTheDocument());
    expect(within(tables).getByText('2 tables added')).toBeInTheDocument();
  });

  it('shows skeletons while restaurant details are loading', () => {
    overviewState.detailsQuery.data = null;
    overviewState.detailsQuery.isLoading = true;

    renderOverview();

    expect(screen.getByRole('status')).toHaveTextContent('Loading setup status…');
    expect(screen.getByTestId('setup-steps-skeleton').children).toHaveLength(3);
    expect(screen.queryByRole('region', { name: 'Required before guests can book' })).toBeNull();
  });
});
