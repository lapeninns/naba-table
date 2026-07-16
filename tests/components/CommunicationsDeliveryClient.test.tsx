import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { CommunicationsDeliveryClient } from '@/components/features/communications-delivery';
import { OpsServicesProvider } from '@/contexts/ops-services';
import { OpsSessionProvider } from '@/contexts/ops-session';
import { OpsUnsavedChangesProvider } from '@/contexts/ops-unsaved-changes';

import type { BookingService } from '@/services/ops/bookings';
import type { RestaurantService } from '@/services/ops/restaurants';
import type { OpsMembership, OpsUser } from '@/types/ops';

const routerReplaceMock = vi.fn();
const pathnameMock = vi.fn();
const searchParamsMock = vi.fn();

vi.mock('next/navigation', async () => {
  const actual = await vi.importActual('next/navigation');
  return {
    ...actual,
    usePathname: () => pathnameMock(),
    useSearchParams: () => searchParamsMock(),
    useRouter: () => ({
      replace: routerReplaceMock,
    }),
  };
});

const user: OpsUser = {
  id: 'user-1',
  email: 'ops@example.com',
};

const memberships: OpsMembership[] = [
  {
    id: 'membership-1',
    restaurantId: 'rest-1',
    restaurantName: 'Test Restaurant',
    role: 'owner',
  },
];

describe('CommunicationsDeliveryClient', () => {
  beforeEach(() => {
    routerReplaceMock.mockReset();
    pathnameMock.mockReset();
    pathnameMock.mockReturnValue('/app/communications-delivery');
    searchParamsMock.mockReset();
    searchParamsMock.mockReturnValue(new URLSearchParams('restaurantId=rest-1'));
  });

  it('renders the unified overview and channel links', async () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false, refetchOnWindowFocus: false } },
    });

    const bookingService = {
      getRestaurantEmailDeliverySummary: vi.fn().mockResolvedValue({
        ok: true,
        restaurantId: 'rest-1',
        range: '7d',
        summary: {
          total: 10,
          sent: 0,
          delivered: 9,
          deliveryDelayed: 1,
          bounced: 0,
          complained: 0,
          failed: 1,
          deliveredRate: 0.9,
          failureRate: 0.1,
          uniqueRecipients: 8,
          uniqueBookings: 7,
          p50DeliverySeconds: 30,
          p95DeliverySeconds: 90,
          topFailedTemplates: [],
          topFailedEmailTypes: [],
          stuckInFlight: 1,
        },
      }),
      getRestaurantSmsDeliveryFeed: vi.fn().mockResolvedValue({
        ok: true,
        restaurantId: 'rest-1',
        range: '7d',
        pageInfo: { page: 1, pageSize: 1, hasNext: false },
        attempts: [],
        summary: {
          total: 12,
          queued: 1,
          sent: 2,
          delivered: 9,
          undelivered: 1,
          failed: 1,
          deliveredRate: 0.75,
          failureRate: 0.16,
          uniqueRecipients: 10,
          uniqueBookings: 9,
          stuckInFlight: 1,
          whatsappCount: 7,
          smsCount: 5,
          fallbackCount: 2,
        },
      }),
    } as unknown as BookingService;

    const restaurantService = {
      listRestaurants: vi.fn().mockResolvedValue([
        { id: 'rest-1', name: 'Test Restaurant', timezone: 'Europe/London' },
      ]),
      getProfile: vi.fn().mockResolvedValue({
        id: 'rest-1',
        name: 'Test Restaurant',
        timezone: 'Europe/London',
      }),
    } as unknown as RestaurantService;

    render(
      <QueryClientProvider client={queryClient}>
        <OpsServicesProvider
          factories={{
            bookingService: () => bookingService,
            restaurantService: () => restaurantService,
          }}
        >
          <OpsSessionProvider user={user} memberships={memberships} initialRestaurantId="rest-1">
            <OpsUnsavedChangesProvider>
              <CommunicationsDeliveryClient initialRestaurantId="rest-1" />
            </OpsUnsavedChangesProvider>
          </OpsSessionProvider>
        </OpsServicesProvider>
      </QueryClientProvider>,
    );

    expect(await screen.findByText('Communications Delivery')).toBeInTheDocument();
    expect(screen.getByText('Email delivered')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /open email delivery/i })).toHaveAttribute(
      'href',
      '/app/communications-delivery/email',
    );
    expect(screen.getByRole('link', { name: /open message delivery/i })).toHaveAttribute(
      'href',
      '/app/communications-delivery/messages',
    );
  });
});
