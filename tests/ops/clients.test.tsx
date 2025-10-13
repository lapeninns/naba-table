import * as React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { OpsServicesProvider } from '@/contexts/ops-services';
import { OpsSessionProvider } from '@/contexts/ops-session';
import { OpsWalkInBookingClient, OpsTeamManagementClient } from '@/components/features';
import type { OpsMembership } from '@/types/ops';
import type { RestaurantService, OperatingHoursSnapshot, RestaurantProfile, ServicePeriodRow } from '@/services/ops/restaurants';
import type { TeamService } from '@/services/ops/team';
import type { BookingService } from '@/services/ops/bookings';
import type { CustomerService } from '@/services/ops/customers';

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
    list: vi.fn(),
  };
}

function renderWithProviders(
  ui: React.ReactElement,
  options: {
    memberships: OpsMembership[];
    restaurantService?: RestaurantService;
    teamService?: TeamService;
  },
) {
  const queryClient = createQueryClient();
  const restaurantService = options.restaurantService ?? createRestaurantServiceStub([]);
  const teamService = options.teamService ?? createTeamServiceStub();
  const bookingService = createBookingServiceStub();
  const customerService = createCustomerServiceStub();

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
});
