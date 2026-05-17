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
  useRouter: () => ({
    push: vi.fn(),
  }),
}));

vi.mock('next/dynamic', () => ({
  default: () => {
    const name = dynamicState.names[dynamicState.index++] ?? 'unknown';

    return function MockDynamicSettingsSection(props: {
      restaurantId?: string | null;
      hasSyncWorkspace?: boolean;
    }) {
      return (
        <div
          data-testid={`settings-view-${name}`}
          data-has-sync-workspace={String(props.hasSyncWorkspace)}
          data-restaurant-id={props.restaurantId ?? ''}
        />
      );
    };
  },
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
import { SettingsSectionNav } from '@/components/features/restaurant-settings/shared';
import { OpsServicesProvider } from '@/contexts/ops-services';
import { OpsSessionProvider } from '@/contexts/ops-session';
import { OpsUnsavedChangesProvider } from '@/contexts/ops-unsaved-changes';

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
    listMenus: vi.fn().mockResolvedValue({ menus: [] }),
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
            menuHierarchyService: () => ({ listMenus: serviceCalls.listMenus }),
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
          <OpsUnsavedChangesProvider>
            <RestaurantSettingsSubnav />
          </OpsUnsavedChangesProvider>
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
            menuHierarchyService: () => ({ listMenus: serviceCalls.listMenus }),
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
          <OpsUnsavedChangesProvider>
            <RestaurantSettingsPageShell>
              <div>Route content</div>
            </RestaurantSettingsPageShell>
          </OpsUnsavedChangesProvider>
        </OpsSessionProvider>
      </OpsServicesProvider>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  navigationState.pathname = '/app/settings/restaurant/profile';
  prefetchState.prefetchIfStale.mockClear();
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
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
    expect(
      RESTAURANT_SETTINGS_NAV_ITEMS.find(
        (item) => item.href === '/app/settings/restaurant/availability',
      )?.aliases,
    ).toEqual([
      '/app/settings/restaurant/service-periods#service-periods',
      '/app/settings/restaurant/operating-hours#availability-hours',
      '/app/settings/restaurant/turn-durations#booking-occasions',
      '/app/settings/restaurant/occasions#booking-occasions',
    ]);
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

  it('passes sync workspace availability and anchors the real dual-sync boundary', () => {
    renderWithOpsSession(<OpsRestaurantSettingsClient view="google-business-profile" />);

    expect(screen.getByTestId('settings-view-google-business-profile')).toHaveAttribute(
      'data-has-sync-workspace',
      'true',
    );
    expect(screen.getByTestId('settings-view-dual-sync').parentElement).toHaveAttribute(
      'id',
      'gbp-sync-review',
    );
  });
});

describe('RestaurantSettingsSubnav', () => {
  it('uses the focused settings shell and navigation baseline across settings routes', () => {
    renderPageShell('/app/settings/restaurant/profile');

    expect(screen.getByRole('link', { name: 'Close restaurant settings' })).toHaveAttribute(
      'href',
      '/app/dashboard',
    );
    const profileHeading = screen.getByRole('heading', {
      level: 1,
      name: 'Restaurant profile',
    });
    expect(profileHeading).toHaveClass('text-sm');
    expect(
      screen.queryByText(/Public details, booking page URL, manager alerts/i),
    ).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Restaurant profile' })).toHaveAttribute(
      'href',
      '/app/settings/restaurant/profile',
    );
    expect(screen.getByRole('navigation', { name: 'Restaurant settings' })).toBeInTheDocument();
  });

  it('renders every shipped settings route from the shared nav contract', () => {
    renderSubnav('/app/settings/restaurant/tables');

    for (const item of RESTAURANT_SETTINGS_NAV_ITEMS) {
      expect(screen.getByRole('link', { name: item.title })).toHaveAttribute('href', item.href);
    }
    expect(screen.getByRole('link', { name: 'Tables' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', { name: 'Restaurant profile' })).not.toHaveAttribute(
      'aria-current',
    );
  });

  it('maps availability aliases to the focused alias page heading and active nav item', () => {
    renderPageShell('/app/settings/restaurant/service-periods');

    expect(screen.getByRole('heading', { level: 1, name: /Service periods/i })).toBeInTheDocument();
    const availabilityLinks = screen.getAllByRole('link', { name: 'Availability & Booking types' });
    expect(
      availabilityLinks.some(
        (link) => link.getAttribute('href') === '/app/settings/restaurant/availability',
      ),
    ).toBe(true);
    expect(
      screen.queryByText(/Define lunch, dinner, and other booking windows/i),
    ).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { level: 1, name: 'Restaurant' })).not.toBeInTheDocument();
    expect(
      availabilityLinks.some((link) => link.getAttribute('aria-current') === 'page'),
    ).toBe(true);
  });

  it('keeps the active mobile nav item visually anchored', () => {
    renderSubnav('/app/settings/restaurant/google-business-profile');

    const gbpLink = screen.getByRole('link', { name: 'Google Business Profile' });
    expect(gbpLink).toHaveAttribute('aria-current', 'page');
    expect(gbpLink.closest('[data-sidebar="menu-button"]')).toHaveAttribute('data-active', 'true');
  });

  it('supports arrow-key focus movement inside settings workflow rails', async () => {
    const user = userEvent.setup();
    const firstSelect = vi.fn();
    const secondSelect = vi.fn();
    const thirdSelect = vi.fn();

    render(
      <SettingsSectionNav
        title="Workflow"
        items={[
          { label: 'First', onSelect: firstSelect },
          { label: 'Second', onSelect: secondSelect },
          { label: 'Third', onSelect: thirdSelect },
        ]}
      />,
    );

    const first = screen.getByRole('button', { name: /first/i });
    const second = screen.getByRole('button', { name: /second/i });
    const third = screen.getByRole('button', { name: /third/i });

    first.focus();
    await user.keyboard('{ArrowRight}');
    expect(second).toHaveFocus();

    await user.keyboard('{End}');
    expect(third).toHaveFocus();

    await user.keyboard('{ArrowDown}');
    expect(first).toHaveFocus();

    await user.keyboard('{ArrowLeft}');
    expect(third).toHaveFocus();
  });

  it('prefetches each settings route with the active restaurant service contract', async () => {
    const user = userEvent.setup();
    const serviceCalls = makePrefetchServiceCalls();
    renderSubnav('/app/settings/restaurant/profile', serviceCalls);

    await user.hover(screen.getByRole('link', { name: 'Restaurant profile' }));
    await user.hover(screen.getByRole('link', { name: 'Google Business Profile' }));
    await user.hover(screen.getByRole('link', { name: 'Availability & Booking types' }));
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
      expect(serviceCalls.listMenus).toHaveBeenCalledWith('rest-1');
      expect(serviceCalls.listTables).toHaveBeenCalledWith('rest-1');
      expect(serviceCalls.listInvites).toHaveBeenCalledWith('rest-1', 'pending');
    });
  });
});
