import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, within, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const navigationState = vi.hoisted(() => ({
  pathname: '/app/settings/restaurant/profile',
}));

const dynamicState = vi.hoisted(() => ({
  names: [
    'profile',
    'discovery',
    'google-business-profile',
    'availability',
    'menu',
    'tables',
    'team',
    'staff-communications',
  ],
  index: 0,
}));

const prefetchState = vi.hoisted(() => ({
  // Mirror TanStack's QueryFunctionContext: settings queryFns read `signal` from it.
  prefetchIfStale: vi.fn(
    ({ queryFn }: { queryFn: (context: { signal: AbortSignal }) => unknown }) =>
      queryFn({ signal: new AbortController().signal }),
  ),
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

    return function MockDynamicSettingsSection(props: { restaurantId?: string | null }) {
      return (
        <div data-testid={`settings-view-${name}`} data-restaurant-id={props.restaurantId ?? ''} />
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
import {
  sectionNavOverflowEdges,
  SettingsSectionNav,
} from '@/components/features/restaurant-settings/shared';
import { OpsServicesProvider } from '@/contexts/ops-services';
import { OpsSessionProvider } from '@/contexts/ops-session';
import {
  OpsUnsavedChangesProvider,
  useRegisterOpsUnsavedChanges,
} from '@/contexts/ops-unsaved-changes';

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
  'discovery',
  'google-business-profile',
  'availability',
  'menu',
  'tables',
  'team',
  'staff-communications',
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
    getBusinessContext: vi.fn().mockResolvedValue({}),
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
              getBusinessContext: serviceCalls.getBusinessContext,
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

function DirtyRouteContent() {
  useRegisterOpsUnsavedChanges(
    'restaurant-settings-shell-test',
    true,
    'Leave dirty restaurant settings?',
  );

  return <div>Dirty route content</div>;
}

function renderPageShell(
  pathname: string,
  serviceCalls = makePrefetchServiceCalls(),
  children: ReactElement | string = 'Route content',
) {
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
              getBusinessContext: serviceCalls.getBusinessContext,
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
            <RestaurantSettingsPageShell>{children}</RestaurantSettingsPageShell>
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
      '/app/settings/restaurant/discovery',
      '/app/settings/restaurant/google-business-profile',
      '/app/settings/restaurant/availability',
      '/app/settings/restaurant/menu',
      '/app/settings/restaurant/tables',
      '/app/settings/restaurant/team',
      '/app/settings/restaurant/staff-communications',
    ]);
    expect(RESTAURANT_SETTINGS_NAV_ITEMS).toHaveLength(RESTAURANT_SETTINGS_ROUTES.length);
    expect(
      RESTAURANT_SETTINGS_NAV_ITEMS.find(
        (item) => item.href === '/app/settings/restaurant/availability',
      )?.aliases,
    ).toEqual([
      '/app/settings/restaurant/service-periods#service-windows',
      '/app/settings/restaurant/operating-hours#weekly-hours',
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
      // Luma 2.0: ops content stack is density-token-driven (compact ops = 1rem, = the prior gap-4).
      'gap-[var(--pg-density-gap-tight)]',
    );
  });

  it('leaves the Google review step to the Google Business Profile section', () => {
    renderWithOpsSession(<OpsRestaurantSettingsClient view="google-business-profile" />);

    // Step 3 (review) now renders inside GoogleBusinessProfileSection, which gates it on a
    // mapped location (see GoogleBusinessProfileSection.test.tsx).
    expect(screen.getByTestId('settings-view-google-business-profile')).toHaveAttribute(
      'data-restaurant-id',
      'rest-1',
    );
    expect(screen.queryByTestId('settings-view-dual-sync')).not.toBeInTheDocument();
    expect(document.getElementById('gbp-sync-review')).toBeNull();
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

  it('titles former availability routes as the Availability page and marks it active', () => {
    renderPageShell('/app/settings/restaurant/service-periods');

    expect(
      screen.getByRole('heading', { level: 1, name: 'Availability & Booking types' }),
    ).toBeInTheDocument();
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
    expect(availabilityLinks.some((link) => link.getAttribute('aria-current') === 'page')).toBe(
      true,
    );
  });

  it('guards the Settings crumb, sidebar links and close navigation when settings are dirty', async () => {
    const user = userEvent.setup();
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);
    renderPageShell(
      '/app/settings/restaurant/service-periods',
      makePrefetchServiceCalls(),
      <DirtyRouteContent />,
    );

    const breadcrumb = screen.getByRole('navigation', { name: 'Breadcrumb' });
    await user.click(within(breadcrumb).getByRole('link', { name: 'Settings' }));
    await user.click(screen.getByRole('link', { name: 'Tables' }));
    await user.click(screen.getByRole('link', { name: 'Close restaurant settings' }));

    expect(confirmSpy).toHaveBeenCalledTimes(3);
    confirmSpy.mockRestore();
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

    expect(first).toHaveClass('font-medium');
    expect(first).not.toHaveClass('font-semibold');

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

  it('marks the current section with weight as well as the underline', () => {
    render(
      <SettingsSectionNav
        title="Profile sections"
        showHeader={false}
        items={[
          { label: '1 · Brand', isActive: true, onSelect: vi.fn() },
          { label: '2 · Booking link', onSelect: vi.fn() },
        ]}
      />,
    );

    expect(screen.getByRole('button', { name: '1 · Brand' })).toHaveClass('font-semibold');
    expect(screen.getByRole('button', { name: '2 · Booking link' })).toHaveClass('font-medium');
    expect(screen.getByRole('list')).toBeInTheDocument();
  });

  it('reports scroll fades only while the section list overflows', () => {
    expect(sectionNavOverflowEdges({ scrollLeft: 0, clientWidth: 200, scrollWidth: 200 })).toEqual({
      start: false,
      end: false,
    });
    expect(sectionNavOverflowEdges({ scrollLeft: 0, clientWidth: 120, scrollWidth: 320 })).toEqual({
      start: false,
      end: true,
    });
    expect(sectionNavOverflowEdges({ scrollLeft: 40, clientWidth: 120, scrollWidth: 320 })).toEqual(
      { start: true, end: true },
    );
    expect(
      sectionNavOverflowEdges({ scrollLeft: 200, clientWidth: 120, scrollWidth: 320 }),
    ).toEqual({ start: true, end: false });
  });

  it('prefetches each settings route with the active restaurant service contract', async () => {
    const user = userEvent.setup();
    const serviceCalls = makePrefetchServiceCalls();
    renderSubnav('/app/settings/restaurant/profile', serviceCalls);

    await user.hover(screen.getByRole('link', { name: 'Restaurant profile' }));
    await user.hover(screen.getByRole('link', { name: 'Discovery details' }));
    await user.hover(screen.getByRole('link', { name: 'Google Business Profile' }));
    await user.hover(screen.getByRole('link', { name: 'Availability & Booking types' }));
    await user.hover(screen.getByRole('link', { name: 'Menu' }));
    await user.hover(screen.getByRole('link', { name: 'Tables' }));
    await user.hover(screen.getByRole('link', { name: 'Team' }));

    // Prefetches forward the query AbortSignal so a cancelled prefetch aborts its fetch.
    const withSignal = { signal: expect.any(AbortSignal) };
    await waitFor(() => {
      expect(serviceCalls.getProfile).toHaveBeenCalledWith('rest-1', withSignal);
      expect(serviceCalls.getBusinessContext).toHaveBeenCalledWith('rest-1', withSignal);
      expect(serviceCalls.getGoogleBusinessProfileConnection).toHaveBeenCalledWith(
        'rest-1',
        withSignal,
      );
      expect(serviceCalls.getOperatingHours).toHaveBeenCalledWith('rest-1', withSignal);
      expect(serviceCalls.getServicePeriods).toHaveBeenCalledWith('rest-1', withSignal);
      expect(serviceCalls.listOccasions).toHaveBeenCalledWith(withSignal);
      expect(serviceCalls.getTurnBands).toHaveBeenCalledWith('rest-1', withSignal);
      expect(serviceCalls.listMenus).toHaveBeenCalledWith('rest-1', withSignal);
      expect(serviceCalls.listTables).toHaveBeenCalledWith('rest-1', {}, withSignal);
      expect(serviceCalls.listInvites).toHaveBeenCalledWith('rest-1', 'all', withSignal);
    });
  });
});

function mockPrefersReducedMotion(matches: boolean) {
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: matches && query === '(prefers-reduced-motion: reduce)',
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }));
}

/**
 * Reduced-motion guarantee for the CSS entrance fade: nothing ever sets an inline opacity (so the
 * content can never be stranded at opacity 0, even before hydration), every animation utility is
 * gated behind `motion-safe:` (reduced-motion users get no animation at all), and no fill mode
 * holds the keyframe start, so the animation always ends on the element's own visible styles.
 */
function expectMotionSafeCssFade(element: HTMLElement) {
  expect(element.getAttribute('style') ?? '').not.toMatch(/opacity|transform/);
  const classes = Array.from(element.classList);
  expect(classes).toEqual(
    expect.arrayContaining(['motion-safe:animate-in', 'motion-safe:fade-in-0']),
  );
  const animationClasses = classes.filter((className) =>
    /(^|:)(animate-|fade-|slide-in-|zoom-in-|duration-|ease-|delay-|fill-mode-)/.test(className),
  );
  expect(animationClasses.filter((className) => !className.startsWith('motion-safe:'))).toEqual([]);
  expect(classes.filter((className) => className.includes('fill-mode-'))).toEqual([]);
}

describe('RestaurantSettingsPageShell with reduced motion', () => {
  it.each([
    { label: 'reduced motion', reduce: true },
    { label: 'default motion', reduce: false },
  ])('@a11y never leaves the page content invisible ($label)', ({ reduce }) => {
    mockPrefersReducedMotion(reduce);
    renderPageShell('/app/settings/restaurant/profile', undefined, <p>Settings body</p>);

    const wrapper = screen.getByText('Settings body').parentElement;
    expect(wrapper).not.toBeNull();
    // Checked synchronously on first render: no JS-driven initial opacity to wait out.
    expect(wrapper).not.toHaveStyle({ opacity: '0' });
    expectMotionSafeCssFade(wrapper as HTMLElement);
  });

  it('@perf fades with CSS instead of loading the motion runtime', () => {
    const source = readFileSync(
      resolve(
        process.cwd(),
        'src/components/features/restaurant-settings/RestaurantSettingsPageShell.tsx',
      ),
      'utf8',
    );

    expect(source).not.toMatch(/from ['"]motion(\/[^'"]*)?['"]/);
  });
});
