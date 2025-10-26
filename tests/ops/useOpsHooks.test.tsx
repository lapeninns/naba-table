import '@testing-library/jest-dom/vitest';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import * as React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { OpsServicesProvider } from '@/contexts/ops-services';
import { OpsSessionProvider } from '@/contexts/ops-session';
import {
  useOpsCreateTeamInvite,
  useOpsRestaurantsList,
  useOpsTeamInvitations,
} from '@/hooks';


import type { BookingService } from '@/services/ops/bookings';
import type { CustomerService } from '@/services/ops/customers';
import type {
  OperatingHoursSnapshot,
  RestaurantProfile,
  RestaurantService,
  ServicePeriodRow,
} from '@/services/ops/restaurants';
import type { TeamInvite, TeamService, TeamInviteStatus } from '@/services/ops/team';
import type { OpsMembership } from '@/types/ops';

type ServiceOverrides = {
  restaurantService?: RestaurantService;
  teamService?: TeamService;
  bookingService?: BookingService;
  customerService?: CustomerService;
};

function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });
}

function createRestaurantServiceStub(): RestaurantService {
  const profile: RestaurantProfile = {
    id: 'rest-1',
    name: 'Alinea',
    slug: 'alinea',
    timezone: 'America/Chicago',
    capacity: 80,
    contactEmail: 'hello@example.com',
    contactPhone: '+1-555-1111',
    address: 'Chicago',
    bookingPolicy: null,
  };

  return {
    listRestaurants: vi.fn().mockResolvedValue([
      { id: 'rest-1', name: 'Alinea', slug: 'alinea', timezone: 'America/Chicago', address: 'Chicago', role: 'owner' },
    ]),
    getProfile: vi.fn<[], Promise<RestaurantProfile>>().mockResolvedValue(profile),
    updateProfile: vi.fn<[], Promise<RestaurantProfile>>().mockResolvedValue(profile),
    getOperatingHours: vi.fn<[], Promise<OperatingHoursSnapshot>>().mockResolvedValue({ weekly: [], overrides: [] }),
    updateOperatingHours: vi.fn<[], Promise<OperatingHoursSnapshot>>().mockResolvedValue({ weekly: [], overrides: [] }),
    getServicePeriods: vi.fn<[], Promise<ServicePeriodRow[]>>().mockResolvedValue([]),
    updateServicePeriods: vi.fn<[], Promise<ServicePeriodRow[]>>().mockResolvedValue([]),
  };
}

function createTeamServiceStub(): TeamService {
  const baseInvite: TeamInvite = {
    id: 'invite-1',
    restaurantId: 'rest-1',
    email: 'pending@ops.test',
    role: 'host',
    status: 'pending',
    expiresAt: new Date().toISOString(),
    invitedBy: 'user-1',
    acceptedAt: null,
    revokedAt: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  return {
    listInvites: vi.fn<[_restaurantId: string, status?: TeamInviteStatus], Promise<TeamInvite[]>>().mockResolvedValue([
      baseInvite,
    ]),
    createInvite: vi.fn().mockResolvedValue({
      invite: {
        ...baseInvite,
        id: 'invite-2',
        email: 'new-invite@example.com',
        role: 'manager',
      },
      inviteUrl: 'https://example.test/invite/invite-2',
    }),
    revokeInvite: vi.fn().mockResolvedValue({
      ...baseInvite,
      status: 'revoked',
      revokedAt: new Date().toISOString(),
    }),
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
  overrides: ServiceOverrides = {},
) {
  const queryClient = createQueryClient();

  const membership: OpsMembership = {
    restaurantId: 'rest-1',
    restaurantName: 'Alinea',
    restaurantSlug: 'alinea',
    role: 'owner',
    createdAt: null,
  };

  const restaurantService = overrides.restaurantService ?? createRestaurantServiceStub();
  const teamService = overrides.teamService ?? createTeamServiceStub();
  const bookingService = overrides.bookingService ?? createBookingServiceStub();
  const customerService = overrides.customerService ?? createCustomerServiceStub();

  const result = render(
    <QueryClientProvider client={queryClient}>
      <OpsSessionProvider
        user={{ id: 'user-1', email: 'ops@example.com' }}
        memberships={[membership]}
        initialRestaurantId={membership.restaurantId}
      >
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

  return { ...result, restaurantService, teamService };
}

afterEach(() => {
  vi.clearAllMocks();
});

function RestaurantsListProbe() {
  const { data, isSuccess } = useOpsRestaurantsList();
  if (!isSuccess) {
    return <span>Loading…</span>;
  }
  return <p>{data[0]?.name}</p>;
}

function TeamInvitesProbe() {
  const { data, isSuccess } = useOpsTeamInvitations({ restaurantId: 'rest-1', status: 'pending' });
  if (!isSuccess) {
    return <span>Loading…</span>;
  }
  return <span>{data[0]?.email}</span>;
}

function CreateInviteProbe() {
  const createInvite = useOpsCreateTeamInvite();
  const [lastEmail, setLastEmail] = React.useState<string | null>(null);

  return (
    <div>
      <button
        type="button"
        onClick={async () => {
          const result = await createInvite.mutateAsync({
            restaurantId: 'rest-1',
            email: 'new-invite@example.com',
            role: 'manager',
          });
          setLastEmail(result.invite.email);
        }}
      >
        Send invite
      </button>
      {lastEmail ? <span>{lastEmail}</span> : null}
    </div>
  );
}

describe('Ops hooks integration', () => {
  it('returns restaurant list data from service', async () => {
    const { restaurantService } = renderWithProviders(<RestaurantsListProbe />);

    await waitFor(() => expect(screen.getByText('Alinea')).toBeVisible());
    expect(restaurantService.listRestaurants).toHaveBeenCalledTimes(1);
  });

  it('fetches team invitations for the active restaurant', async () => {
    const { teamService } = renderWithProviders(<TeamInvitesProbe />);

    await waitFor(() => expect(screen.getByText('pending@ops.test')).toBeVisible());
    expect(teamService.listInvites).toHaveBeenCalledWith('rest-1', 'pending');
  });

  it('creates a team invite via mutation', async () => {
    const { teamService } = renderWithProviders(<CreateInviteProbe />);

    await userEvent.click(screen.getByRole('button', { name: /send invite/i }));
    await waitFor(() => expect(screen.getByText('new-invite@example.com')).toBeVisible());
    expect(teamService.createInvite).toHaveBeenCalledWith({
      restaurantId: 'rest-1',
      email: 'new-invite@example.com',
      role: 'manager',
    });
  });
});
