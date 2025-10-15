import * as React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import userEvent from '@testing-library/user-event';
import { render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { OpsServicesProvider } from '@/contexts/ops-services';
import { OpsSessionProvider } from '@/contexts/ops-session';
import { OpsWalkInBookingClient, OpsTeamManagementClient, OpsBookingsClient, OpsCustomersClient, OpsDashboardClient } from '@/components/features';
import type { OpsMembership, OpsTodayBookingsSummary } from '@/types/ops';
import type { RestaurantService, OperatingHoursSnapshot, RestaurantProfile, ServicePeriodRow } from '@/services/ops/restaurants';
import type { TeamService } from '@/services/ops/team';
import type { BookingService } from '@/services/ops/bookings';
import type { CustomerService } from '@/services/ops/customers';

const replaceMock = vi.fn();
const refreshMock = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: replaceMock, push: vi.fn(), refresh: refreshMock }),
  usePathname: () => '/ops/bookings',
  useSearchParams: () => new URLSearchParams(),
}));

function createQueryClient() {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } });
}

function createRestaurantServiceStub(restaurants: Array<{ id: string; name: string; slug?: string | null; timezone?: string | null; address?: string | null; role: string }>): RestaurantService {
  const profile: RestaurantProfile = {
    id: restaurants[0]?.id ?? 'rest-1',
    name: restaurants[0]?.name ?? 'Restaurant',
    slug: restaurants[0]?.slug ?? null,
    timezone: restaurants[0]?.timezone ?? 'UTC',
    capacity: null,
    contactEmail: null,
    contactPhone: null,
    address: restaurants[0]?.address ?? null,
    bookingPolicy: null,
  };

  return {
    listRestaurants: vi.fn().mockResolvedValue(restaurants),
    getProfile: vi.fn().mockResolvedValue(profile),
    updateProfile: vi.fn().mockResolvedValue(profile),
    getOperatingHours: vi.fn().mockResolvedValue({ weekly: [], overrides: [] } as OperatingHoursSnapshot),
    updateOperatingHours: vi.fn().mockResolvedValue({ weekly: [], overrides: [] } as OperatingHoursSnapshot),
    getServicePeriods: vi.fn().mockResolvedValue([] as ServicePeriodRow[]),
    updateServicePeriods: vi.fn().mockResolvedValue([] as ServicePeriodRow[]),
  };
}

function createTeamServiceStub(): TeamService {
  return {
    listInvites: vi.fn().mockResolvedValue([]),
    createInvite: vi.fn(),
    revokeInvite: vi.fn(),
  };
}

function createBookingServiceStub(): BookingService {
  return {
    getTodaySummary: vi.fn(),
    getBookingHeatmap: vi.fn(),
    listBookings: vi.fn(),
    updateBooking: vi.fn(),
    updateBookingStatus: vi.fn(),
    cancelBooking: vi.fn(),
    createWalkInBooking: vi.fn(),
  } as unknown as BookingService;
}

function createCustomerServiceStub(): CustomerService {
  return {
    list: vi.fn().mockResolvedValue({
      items: [],
      pageInfo: {
        page: 1,
        pageSize: 10,
        total: 0,
        hasNext: false,
      },
    }),
  } as unknown as CustomerService;
}

function renderWithProviders(
  ui: React.ReactElement,
  options: {
    memberships: OpsMembership[];
    restaurantService?: RestaurantService;
    teamService?: TeamService;
    bookingService?: BookingService;
    customerService?: CustomerService;
  },
) {
  const queryClient = createQueryClient();
  const restaurantService = options.restaurantService ?? createRestaurantServiceStub([]);
  const teamService = options.teamService ?? createTeamServiceStub();
  const bookingService = options.bookingService ?? createBookingServiceStub();
  const customerService = options.customerService ?? createCustomerServiceStub();

  return render(
    <QueryClientProvider client={queryClient}>
      <OpsSessionProvider user={{ id: 'user-1', email: 'ops@example.com' }} memberships={options.memberships} initialRestaurantId={options.memberships[0]?.restaurantId ?? null}>
        <OpsServicesProvider
          factories={{
            restaurantService: () => restaurantService,
            teamService: () => teamService,
            bookingService: () => bookingService,
            customerService: () => customerService,
          }}
        >
          {ui}
        </OpsServicesProvider>
      </OpsSessionProvider>
    </QueryClientProvider>,
  );
}

describe('Ops feature clients', () => {
  afterEach(() => {
    replaceMock.mockReset();
    refreshMock.mockReset();
  });
  it('renders walk-in fallback when user has no restaurant access', () => {
    renderWithProviders(<OpsWalkInBookingClient />, {
      memberships: [],
      restaurantService: createRestaurantServiceStub([]),
    });

    expect(screen.getByText(/no restaurant access/i)).toBeVisible();
  });

  it('renders walk-in booking flow when restaurant data available', async () => {
    const memberships: OpsMembership[] = [
      {
        restaurantId: 'rest-1',
        restaurantName: 'Alinea',
        restaurantSlug: 'alinea',
        role: 'owner',
        createdAt: null,
      },
    ];

    renderWithProviders(<OpsWalkInBookingClient />, {
      memberships,
      restaurantService: createRestaurantServiceStub([
        { id: 'rest-1', name: 'Alinea', slug: 'alinea', timezone: 'America/Chicago', address: 'Chicago', role: 'owner' },
      ]),
    });

    await waitFor(() => expect(screen.getByRole('heading', { name: /create walk-in booking/i })).toBeVisible());
  });

  it('shows limited permissions notice for non-admin team members', async () => {
    const memberships: OpsMembership[] = [
      {
        restaurantId: 'rest-1',
        restaurantName: 'Alinea',
        restaurantSlug: 'alinea',
        role: 'host',
        createdAt: null,
      },
    ];

    renderWithProviders(<OpsTeamManagementClient />, {
      memberships,
      teamService: createTeamServiceStub(),
      restaurantService: createRestaurantServiceStub([
        { id: 'rest-1', name: 'Alinea', slug: 'alinea', timezone: 'America/Chicago', address: 'Chicago', role: 'host' },
      ]),
    });

    await waitFor(() => expect(screen.getByText(/limited permissions/i)).toBeVisible());
  });

  it('renders dashboard summary data for the active restaurant', async () => {
    const memberships: OpsMembership[] = [
      {
        restaurantId: 'rest-1',
        restaurantName: 'Alinea',
        restaurantSlug: 'alinea',
        role: 'owner',
        createdAt: null,
      },
    ];

    const summary: OpsTodayBookingsSummary = {
      date: '2025-05-01',
      timezone: 'UTC',
      restaurantId: 'rest-1',
      totals: {
        total: 0,
        confirmed: 0,
        completed: 0,
        pending: 0,
        cancelled: 0,
        noShow: 0,
        upcoming: 0,
        covers: 0,
      },
      bookings: [],
    };

    const bookingService = {
      getTodaySummary: vi.fn().mockResolvedValue(summary),
      getBookingHeatmap: vi.fn().mockResolvedValue({}),
      listBookings: vi.fn(),
      updateBooking: vi.fn(),
      updateBookingStatus: vi.fn(),
      cancelBooking: vi.fn(),
      createWalkInBooking: vi.fn(),
    } as unknown as BookingService;

    renderWithProviders(<OpsDashboardClient initialDate={null} />, {
      memberships,
      bookingService,
    });

    await waitFor(() => expect(screen.getByText(/Service snapshot/i)).toBeVisible());
    expect(bookingService.getTodaySummary).toHaveBeenCalledWith({ restaurantId: 'rest-1', date: undefined });
  });

  it('requests filtered results when searching bookings', async () => {
    const memberships: OpsMembership[] = [
      {
        restaurantId: 'rest-1',
        restaurantName: 'Alinea',
        restaurantSlug: 'alinea',
        role: 'owner',
        createdAt: null,
      },
    ];

    const listBookingsMock = vi.fn().mockResolvedValue({
      items: [
        {
          id: 'booking-1',
          restaurantId: 'rest-1',
          restaurantName: 'Alinea',
          partySize: 2,
          startIso: new Date().toISOString(),
          endIso: new Date().toISOString(),
          status: 'confirmed',
          notes: null,
          customerPhone: null,
        },
      ],
      pageInfo: { page: 1, pageSize: 10, total: 1, hasNext: false },
    });

    const bookingService = {
      getTodaySummary: vi.fn(),
      getBookingHeatmap: vi.fn(),
      listBookings: listBookingsMock,
      updateBooking: vi.fn(),
      updateBookingStatus: vi.fn(),
      cancelBooking: vi.fn(),
      createWalkInBooking: vi.fn(),
    } as unknown as BookingService;

    const user = userEvent.setup();

    renderWithProviders(<OpsBookingsClient initialRestaurantId="rest-1" />, {
      memberships,
      bookingService,
    });

    await waitFor(() => expect(listBookingsMock).toHaveBeenCalled());

    const searchInput = screen.getByLabelText(/search bookings/i);
    await user.type(searchInput, 'Alex');

    await waitFor(() => {
      expect(listBookingsMock.mock.calls.some((call) => call[0]?.query === 'Alex')).toBe(true);
    });

    const callCountAfterSearch = listBookingsMock.mock.calls.length;
    const clearButton = screen.getByRole('button', { name: /clear search/i });
    await user.click(clearButton);

    await waitFor(() => {
      expect(listBookingsMock.mock.calls.length).toBeGreaterThan(callCountAfterSearch);
      const lastCall = listBookingsMock.mock.calls.at(-1);
      expect(lastCall?.[0]?.query).toBeUndefined();
    });
  });

  it('loads customers using the active restaurant context', async () => {
    const memberships: OpsMembership[] = [
      {
        restaurantId: 'rest-1',
        restaurantName: 'Alinea',
        restaurantSlug: 'alinea',
        role: 'owner',
        createdAt: null,
      },
    ];

    const listCustomersMock = vi.fn().mockResolvedValue({
      items: [
        {
          id: 'customer-1',
          restaurantId: 'rest-1',
          name: 'Ada Lovelace',
          email: 'ada@example.com',
          phone: '+1 555 1111',
          marketingOptIn: true,
          createdAt: new Date().toISOString(),
          firstBookingAt: new Date().toISOString(),
          lastBookingAt: new Date().toISOString(),
          totalBookings: 3,
          totalCovers: 6,
          totalCancellations: 0,
        },
      ],
      pageInfo: { page: 1, pageSize: 10, total: 1, hasNext: false },
    });

    const customerService = {
      list: listCustomersMock,
    } as unknown as CustomerService;

    renderWithProviders(<OpsCustomersClient defaultRestaurantId="rest-1" />, {
      memberships,
      customerService,
    });

    await waitFor(() => expect(listCustomersMock).toHaveBeenCalled());
    expect(listCustomersMock.mock.calls[0]?.[0]).toMatchObject({ restaurantId: 'rest-1' });
    expect(screen.getByText(/Ada Lovelace/i)).toBeVisible();
  });
});
