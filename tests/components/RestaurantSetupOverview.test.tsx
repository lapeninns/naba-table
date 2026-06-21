import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
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
  },
  hoursQuery: {
    data: {
      weekly: [{ isClosed: false }],
    },
    isLoading: false,
  },
  servicePeriodsQuery: {
    data: [{ id: 'lunch-1' }],
    isLoading: false,
  },
  menuQuery: {
    data: { menus: [] },
  },
  teamQuery: {
    data: [],
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
  });

  it('renders required setup cards with links to profile, availability, and tables', async () => {
    renderOverview();

    expect(await screen.findByText('Restaurant setup')).toBeInTheDocument();
    await waitFor(() =>
      expect(overviewState.tableService.list).toHaveBeenCalledWith('rest-1', {
        includeSummary: true,
      }),
    );

    expect(screen.getByRole('link', { name: 'Open profile' })).toHaveAttribute(
      'href',
      '/app/settings/restaurant/profile',
    );
    expect(screen.getByRole('link', { name: 'Open availability' })).toHaveAttribute(
      'href',
      '/app/settings/restaurant/availability#booking-rules',
    );
    expect(screen.getByRole('link', { name: 'Open tables' })).toHaveAttribute(
      'href',
      '/app/settings/restaurant/tables#table-capacity-summary',
    );
  });

  it('marks profile as needs attention when name is missing', async () => {
    overviewState.detailsQuery.data = {
      ...overviewState.detailsQuery.data,
      name: '',
    };

    renderOverview();

    expect((await screen.findAllByText('Public profile')).length).toBeGreaterThan(0);
    expect(screen.getAllByText('Needs attention').length).toBeGreaterThan(0);
    expect(await screen.findByText('Add restaurant name before go-live.')).toBeInTheDocument();
  });

  it('marks profile as needs attention when the public phone is missing', async () => {
    overviewState.detailsQuery.data = {
      ...overviewState.detailsQuery.data,
      contactPhone: null,
    };

    renderOverview();

    expect((await screen.findAllByText('Public profile')).length).toBeGreaterThan(0);
    expect(screen.getAllByText('Needs attention').length).toBeGreaterThan(0);
    expect(await screen.findByText('Add public phone before go-live.')).toBeInTheDocument();
  });

  it('derives optional setup metric from menu and team state', async () => {
    overviewState.menuQuery.data = { menus: [{ id: 'menu-1' }] } as never;
    overviewState.teamQuery.data = [{ id: 'invite-1' }] as never;

    renderOverview();

    expect(await screen.findByText('Menu ready · Team ready')).toBeInTheDocument();
    expect(
      screen.getAllByText('Useful after the profile and availability basics are ready.').length,
    ).toBeGreaterThan(0);
  });

  it('shows skeletons while restaurant details are loading', () => {
    overviewState.detailsQuery.data = null;
    overviewState.detailsQuery.isLoading = true;

    const { container } = renderOverview();

    expect(screen.getByText('Loading')).toBeInTheDocument();
    expect(container.querySelectorAll('.h-48.rounded-lg')).toHaveLength(3);
  });
});
