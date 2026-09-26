import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const connectionState = vi.hoisted(() => ({
  data: null as unknown,
  isLoading: false,
  error: null as Error | null,
}));
const dualSyncState = { current: makeDualSyncHookState() };
const useOpsDualSync = vi.hoisted(() => vi.fn(() => dualSyncState.current));
const useOpsGoogleBusinessProfileConnection = vi.hoisted(() => vi.fn(() => connectionState));
const settingsRoute = vi.hoisted(() => ({ routeView: 'profile' as string | null }));

vi.mock('@/hooks/ops/useOpsGoogleBusinessProfile', () => ({
  useOpsGoogleBusinessProfileConnection,
}));

vi.mock('@/hooks/ops/useOpsDualSync', () => ({
  useOpsDualSync,
}));

vi.mock('@/components/features/restaurant-settings/shell/useRestaurantSettingsContext', () => ({
  useRestaurantSettingsContext: () => ({
    restaurantId: 'rest-1',
    restaurantName: 'Old Crown Girton',
    headingContext: null,
    routeView: settingsRoute.routeView,
  }),
}));

import { isGbpDriftRouteView } from '@/components/features/restaurant-settings/gbp-drift/gbpDriftRoutes';
import {
  GbpDriftProvider,
  GbpDriftReviewLink,
  GbpDriftStatusPill,
  getGbpDriftNavBadge,
  useGbpDriftStatus,
  getGbpDriftSectionBadge,
} from '@/components/features/restaurant-settings/GbpDriftProvider';
import { deriveGbpDriftStatus } from '@/components/features/restaurant-settings/gbpDriftStatus';

import { makeDualSyncHookState } from './testUtils';

const sectionStatus = {
  fieldCount: 3,
  inSyncCount: 1,
  needsReviewCount: 2,
  pendingCount: 0,
  failedCount: 0,
  conflictCount: 1,
  driftCount: 1,
};

describe('GbpDriftProvider', () => {
  beforeEach(() => {
    connectionState.data = null;
    connectionState.isLoading = false;
    connectionState.error = null;
    dualSyncState.current = makeDualSyncHookState();
    settingsRoute.routeView = 'profile';
    useOpsDualSync.mockClear();
    useOpsGoogleBusinessProfileConnection.mockClear();
  });

  it('@smoke renders children within the drift providers', () => {
    render(
      <GbpDriftProvider restaurantId="rest-1">
        <p>Drift-aware content</p>
      </GbpDriftProvider>,
    );

    expect(screen.getByText('Drift-aware content')).toBeInTheDocument();
  });

  it('@contract hides the status pill outside a meaningful drift state', () => {
    // Default context derives from a null restaurant: no pill at all.
    render(<GbpDriftStatusPill />);

    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });

  it('@contract shows a Google not linked pill when the profile is not connected', () => {
    connectionState.data = { status: 'unlinked' };
    render(
      <GbpDriftProvider restaurantId="rest-1">
        <GbpDriftStatusPill />
      </GbpDriftProvider>,
    );

    const pill = screen.getByRole('link', { name: 'Google not linked' });
    expect(pill).toHaveTextContent('Google not linked');
    expect(pill).toHaveAttribute(
      'href',
      expect.stringContaining('/settings/restaurant/google-business-profile#gbp-sync-review'),
    );
  });

  it.each([
    { status: 'authorized', externalAccountId: null, externalLocationId: null },
    { status: 'linked', externalAccountId: 'account-1', externalLocationId: null },
    { status: 'linked', externalAccountId: null, externalLocationId: 'location-1' },
    { status: 'unlinked', externalAccountId: 'account-1', externalLocationId: 'location-1' },
  ])(
    '@contract skips dual-sync state until a Google location is linked ($status/$externalAccountId/$externalLocationId)',
    (connection) => {
      connectionState.data = connection;

      render(
        <GbpDriftProvider restaurantId="rest-1">
          <p>Drift-aware content</p>
        </GbpDriftProvider>,
      );

      expect(useOpsDualSync).toHaveBeenCalledWith({ restaurantId: null, stateEnabled: true });
    },
  );

  const linkedConnection = {
    status: 'linked',
    externalAccountId: 'account-1',
    externalLocationId: 'location-1',
  };

  it.each([
    { routeView: 'profile', enabled: true },
    { routeView: 'availability', enabled: true },
    { routeView: 'discovery', enabled: true },
    { routeView: 'menu', enabled: true },
    { routeView: 'google-business-profile', enabled: true },
    { routeView: 'tables', enabled: false },
    { routeView: 'team', enabled: false },
    { routeView: 'staff-communications', enabled: false },
    // Overview (and any unknown settings path) has no route view.
    { routeView: null, enabled: false },
  ])(
    '@contract fetches Google drift only on routes that show it ($routeView -> $enabled)',
    ({ routeView, enabled }) => {
      settingsRoute.routeView = routeView;
      connectionState.data = linkedConnection;

      render(
        <GbpDriftProvider>
          <p>Drift-aware content</p>
        </GbpDriftProvider>,
      );

      expect(isGbpDriftRouteView(routeView)).toBe(enabled);
      expect(useOpsGoogleBusinessProfileConnection).toHaveBeenCalled();
      for (const call of useOpsGoogleBusinessProfileConnection.mock.calls as unknown[][]) {
        expect(call).toEqual(['rest-1', { enabled }]);
      }
      expect(useOpsDualSync).toHaveBeenCalled();
      for (const call of useOpsDualSync.mock.calls as unknown[][]) {
        // Cached state stays readable (restaurant id kept); only the fetch is gated.
        expect(call).toEqual([{ restaurantId: 'rest-1', stateEnabled: enabled }]);
      }
    },
  );

  function NavBadgeProbe() {
    const { status } = useGbpDriftStatus();
    return <p data-testid="nav-badge">{getGbpDriftNavBadge(status) ?? 'none'}</p>;
  }

  it.each(['tables', 'team', 'staff-communications', null])(
    '@contract shows no Link pill or badge on a cold non-drift route (%s) for an uncached connection',
    (routeView) => {
      settingsRoute.routeView = routeView;
      // A disabled, uncached query reports no data and isLoading=false.
      connectionState.data = undefined;
      dualSyncState.current = {
        ...makeDualSyncHookState(),
        stateQuery: { ...makeDualSyncHookState().stateQuery, data: undefined },
      };

      render(
        <GbpDriftProvider>
          <GbpDriftStatusPill />
          <NavBadgeProbe />
        </GbpDriftProvider>,
      );

      expect(screen.queryByRole('link')).not.toBeInTheDocument();
      expect(screen.getByTestId('nav-badge')).toHaveTextContent('none');
    },
  );

  it('@contract shows no stale Refresh/Check state on a non-drift route with only the connection cached', () => {
    settingsRoute.routeView = 'team';
    connectionState.data = linkedConnection;
    dualSyncState.current = {
      ...makeDualSyncHookState(),
      stateQuery: { ...makeDualSyncHookState().stateQuery, data: undefined },
    };

    render(
      <GbpDriftProvider>
        <GbpDriftStatusPill />
        <NavBadgeProbe />
      </GbpDriftProvider>,
    );

    expect(screen.queryByRole('link')).not.toBeInTheDocument();
    expect(screen.getByTestId('nav-badge')).toHaveTextContent('none');
  });

  it('@contract still shows cached Link state on a non-drift route', () => {
    settingsRoute.routeView = 'team';
    connectionState.data = { status: 'unlinked' };

    render(
      <GbpDriftProvider>
        <GbpDriftStatusPill />
        <NavBadgeProbe />
      </GbpDriftProvider>,
    );

    expect(screen.getByRole('link', { name: 'Google not linked' })).toHaveTextContent(
      'Google not linked',
    );
    expect(screen.getByTestId('nav-badge')).toHaveTextContent('Link');
  });

  it('@contract derives unknown, not not_connected, when the fetch is deferred and nothing is cached', () => {
    expect(
      deriveGbpDriftStatus({
        restaurantId: 'rest-1',
        connection: undefined,
        connectionLoading: false,
        dualSyncState: undefined,
        fetchDeferred: true,
      }).kind,
    ).toBe('unknown');
    const linkedDeferred = deriveGbpDriftStatus({
      restaurantId: 'rest-1',
      connection: linkedConnection as never,
      dualSyncState: undefined,
      fetchDeferred: true,
    });
    expect(linkedDeferred.kind).toBe('unknown');
    expect(linkedDeferred.isLinked).toBe(true);
    // Without deferral, a missing connection still means "not linked".
    expect(
      deriveGbpDriftStatus({ restaurantId: 'rest-1', connection: undefined, dualSyncState: null })
        .kind,
    ).toBe('not_connected');
  });

  it('@contract maps drift status kinds to nav badges', () => {
    expect(
      getGbpDriftNavBadge(
        deriveGbpDriftStatus({ restaurantId: null, connection: null, dualSyncState: null }),
      ),
    ).toBeNull();
    expect(
      getGbpDriftNavBadge(
        deriveGbpDriftStatus({
          restaurantId: 'rest-1',
          connection: { status: 'unlinked' } as never,
          dualSyncState: null,
        }),
      ),
    ).toBe('Link');
  });

  it('@contract renders a section review link only when the section needs attention', () => {
    expect(getGbpDriftSectionBadge(sectionStatus)).toBe('2 Google');

    render(
      <GbpDriftProvider restaurantId="rest-1">
        <GbpDriftReviewLink sectionStatus={sectionStatus} />
      </GbpDriftProvider>,
    );
    expect(screen.getByRole('link', { name: /Review in Google workspace/ })).toBeInTheDocument();
  });

  it('@contract renders nothing for a clean section status', () => {
    render(
      <GbpDriftProvider restaurantId="rest-1">
        <GbpDriftReviewLink
          sectionStatus={{ ...sectionStatus, needsReviewCount: 0, pendingCount: 0 }}
        />
      </GbpDriftProvider>,
    );

    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });
});
