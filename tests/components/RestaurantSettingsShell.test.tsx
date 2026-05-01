import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const navigationState = vi.hoisted(() => ({
  pathname: '/app/settings/restaurant/profile',
}));

const dynamicState = vi.hoisted(() => ({
  names: [
    'profile',
    'google-business-profile',
    'availability',
    'menu',
    'tables',
    'team',
    'dual-sync',
  ],
  index: 0,
}));

const prefetchState = vi.hoisted(() => ({
  prefetchIfStale: vi.fn(({ queryFn }: { queryFn: () => unknown }) => queryFn()),
}));

vi.mock('next/navigation', () => ({
  usePathname: () => navigationState.pathname,
}));

vi.mock('next/dynamic', () => ({
  default: () => {
    const name = dynamicState.names[dynamicState.index++] ?? 'unknown';

    return function MockDynamicSettingsSection(props: { restaurantId?: string | null }) {
      return (
        <div data-testid={`settings-view-${name}`} data-restaurant-id={props.restaurantId ?? ''} />
      );
    };
  },
}));

vi.mock('@/lib/feature-flags/dual-sync', () => ({
  isDualSyncUiEnabled: () => false,
}));

vi.mock('@/lib/prefetchers', () => ({
  prefetchIfStale: prefetchState.prefetchIfStale,
}));

import { OpsRestaurantSettingsClient } from '@/components/features/restaurant-settings/OpsRestaurantSettingsClient';
import { RestaurantSettingsPageShell } from '@/components/features/restaurant-settings/RestaurantSettingsPageShell';
import { RestaurantSettingsSubnav } from '@/components/features/restaurant-settings/RestaurantSettingsSubnav';
import {
  RESTAURANT_SETTINGS_NAV_ITEMS,
  RESTAURANT_SETTINGS_ROUTES,
} from '@/components/features/restaurant-settings/routes';
import { OpsServicesProvider } from '@/contexts/ops-services';
import { OpsSessionProvider } from '@/contexts/ops-session';

import type { RestaurantSettingsView } from '@/components/features/restaurant-settings/types';
import type { OpsMembership, OpsUser } from '@/types/ops';
import type { ReactElement } from 'react';

const user: OpsUser = {
  id: 'user-1',
  email: 'ops@example.com',
};

const membership: OpsMembership = {
  restaurantId: 'rest-1',
  restaurantName: 'Test Restaurant',
  restaurantSlug: 'test-restaurant',
  role: 'owner',
  createdAt: null,
};

const expectedViews: RestaurantSettingsView[] = [
  'profile',
  'google-business-profile',
  'availability',
  'menu',
  'tables',
  'team',
];

function renderWithOpsSession(ui: ReactElement, memberships: OpsMembership[] = [membership]) {
  return render(
    <OpsSessionProvider
      user={memberships.length > 0 ? user : null}
      memberships={memberships}
      initialRestaurantId={memberships[0]?.restaurantId ?? null}
    >
      {ui}
    </OpsSessionProvider>,
  );
}

function makePrefetchServiceCalls() {
  return {
    getGoogleBusinessProfileConnection: vi.fn().mockResolvedValue({}),
    getOperatingHours: vi.fn().mockResolvedValue({}),
    getProfile: vi.fn().mockResolvedValue({}),
    getServicePeriods: vi.fn().mockResolvedValue([]),
    getTurnBands: vi.fn().mockResolvedValue([]),
    listInvites: vi.fn().mockResolvedValue([]),
    listItems: vi.fn().mockResolvedValue({ items: [] }),
    listOccasions: vi.fn().mockResolvedValue([]),
    listTables: vi.fn().mockResolvedValue({ tables: [] }),
  };
}

function renderSubnav(pathname: string, serviceCalls = makePrefetchServiceCalls()) {
  navigationState.pathname = pathname;
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, refetchOnWindowFocus: false },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <OpsServicesProvider
        factories={
          {
            menuService: () => ({ listItems: serviceCalls.listItems }),
            occasionService: () => ({ listOccasions: serviceCalls.listOccasions }),
            restaurantService: () => ({
              getGoogleBusinessProfileConnection: serviceCalls.getGoogleBusinessProfileConnection,
              getOperatingHours: serviceCalls.getOperatingHours,
              getProfile: serviceCalls.getProfile,
              getServicePeriods: serviceCalls.getServicePeriods,
              getTurnBands: serviceCalls.getTurnBands,
            }),
            tableInventoryService: () => ({ list: serviceCalls.listTables }),
            teamService: () => ({ listInvites: serviceCalls.listInvites }),
          } as never
        }
      >
        <OpsSessionProvider user={user} memberships={[membership]} initialRestaurantId="rest-1">
          <RestaurantSettingsSubnav />
        </OpsSessionProvider>
      </OpsServicesProvider>
    </QueryClientProvider>,
  );
}

function renderPageShell(pathname: string, serviceCalls = makePrefetchServiceCalls()) {
  navigationState.pathname = pathname;
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, refetchOnWindowFocus: false },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <OpsServicesProvider
        factories={
          {
            menuService: () => ({ listItems: serviceCalls.listItems }),
            occasionService: () => ({ listOccasions: serviceCalls.listOccasions }),
            restaurantService: () => ({
              getGoogleBusinessProfileConnection: serviceCalls.getGoogleBusinessProfileConnection,
              getOperatingHours: serviceCalls.getOperatingHours,
              getProfile: serviceCalls.getProfile,
              getServicePeriods: serviceCalls.getServicePeriods,
              getTurnBands: serviceCalls.getTurnBands,
            }),
            tableInventoryService: () => ({ list: serviceCalls.listTables }),
            teamService: () => ({ listInvites: serviceCalls.listInvites }),
          } as never
        }
      >
        <OpsSessionProvider user={user} memberships={[membership]} initialRestaurantId="rest-1">
          <RestaurantSettingsPageShell>
            <div>Route content</div>
          </RestaurantSettingsPageShell>
        </OpsSessionProvider>
      </OpsServicesProvider>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  navigationState.pathname = '/app/settings/restaurant/profile';
  prefetchState.prefetchIfStale.mockClear();
});

describe('restaurant settings route contract', () => {
  it('keeps route metadata and nav items in sync for every shipped settings view', () => {
    expect(RESTAURANT_SETTINGS_ROUTES.map((route) => route.view)).toEqual(expectedViews);
    expect(RESTAURANT_SETTINGS_NAV_ITEMS.map((item) => item.href)).toEqual([
      '/app/settings/restaurant/profile',
      '/app/settings/restaurant/google-business-profile',
      '/app/settings/restaurant/availability',
      '/app/settings/restaurant/menu',
      '/app/settings/restaurant/tables',
      '/app/settings/restaurant/team',
    ]);
    expect(RESTAURANT_SETTINGS_NAV_ITEMS).toHaveLength(RESTAURANT_SETTINGS_ROUTES.length);
  });
});

describe('OpsRestaurantSettingsClient', () => {
  it.each(expectedViews)('routes the %s view through the shared settings client', (view) => {
    renderWithOpsSession(<OpsRestaurantSettingsClient view={view} />);

    expect(screen.getByTestId(`settings-view-${view}`)).toBeInTheDocument();
  });

  it('shows the shared no-access state before rendering a route view', () => {
    renderWithOpsSession(<OpsRestaurantSettingsClient view="profile" />, []);

    expect(screen.getByText('No restaurant access')).toBeInTheDocument();
    expect(screen.queryByTestId('settings-view-profile')).not.toBeInTheDocument();
  });

  it('passes the selected restaurant id to restaurant-scoped settings sections', () => {
    renderWithOpsSession(<OpsRestaurantSettingsClient view="availability" />);

    expect(screen.getByTestId('settings-view-availability')).toHaveAttribute(
      'data-restaurant-id',
      'rest-1',
    );
  });

  it('wraps routed settings views in the dense settings class convention', () => {
    renderWithOpsSession(<OpsRestaurantSettingsClient view="profile" />);

    expect(screen.getByTestId('settings-view-profile').parentElement).toHaveClass(
      'restaurant-settings-dense',
      'gap-4',
    );
  });
});

describe('RestaurantSettingsSubnav', () => {
  it('uses the compact page and navigation baseline across settings routes', () => {
    renderPageShell('/app/settings/restaurant/profile');

    expect(screen.getByRole('main')).toHaveClass('gap-4', 'px-3', 'py-4');
    expect(screen.getByRole('heading', { level: 1, name: 'Restaurant profile' })).toHaveClass(
      'text-2xl',
    );
    expect(screen.getByRole('link', { name: 'Restaurant profile' })).toHaveClass(
      'min-w-[176px]',
      'py-1.5',
    );
    expect(screen.getByText('Change restaurant from the sidebar.')).toBeInTheDocument();
  });

  it('renders every shipped settings route from the shared nav contract', () => {
    renderSubnav('/app/settings/restaurant/tables');

    for (const item of RESTAURANT_SETTINGS_NAV_ITEMS) {
      expect(screen.getByRole('link', { name: item.title })).toHaveAttribute('href', item.href);
    }
    expect(screen.getByRole('link', { name: 'Tables' })).toHaveAttribute('aria-current', 'page');
  });

  it('prefetches each settings route with the active restaurant service contract', async () => {
    const user = userEvent.setup();
    const serviceCalls = makePrefetchServiceCalls();
    renderSubnav('/app/settings/restaurant/profile', serviceCalls);

    await user.hover(screen.getByRole('link', { name: 'Restaurant profile' }));
    await user.hover(screen.getByRole('link', { name: 'Google Business Profile' }));
    await user.hover(screen.getByRole('link', { name: 'Availability & Occasions' }));
    await user.hover(screen.getByRole('link', { name: 'Menu' }));
    await user.hover(screen.getByRole('link', { name: 'Tables' }));
    await user.hover(screen.getByRole('link', { name: 'Team' }));

    await waitFor(() => {
      expect(serviceCalls.getProfile).toHaveBeenCalledWith('rest-1');
      expect(serviceCalls.getGoogleBusinessProfileConnection).toHaveBeenCalledWith('rest-1');
      expect(serviceCalls.getOperatingHours).toHaveBeenCalledWith('rest-1');
      expect(serviceCalls.getServicePeriods).toHaveBeenCalledWith('rest-1');
      expect(serviceCalls.listOccasions).toHaveBeenCalledWith();
      expect(serviceCalls.getTurnBands).toHaveBeenCalledWith('rest-1');
      expect(serviceCalls.listItems).toHaveBeenCalledWith('rest-1', {});
      expect(serviceCalls.listTables).toHaveBeenCalledWith('rest-1');
      expect(serviceCalls.listInvites).toHaveBeenCalledWith('rest-1', 'pending');
    });
  });
});
