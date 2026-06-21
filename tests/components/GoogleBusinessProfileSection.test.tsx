import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  buildGoogleMapsPlaceHref,
  buildLocationValue,
} from '@/components/features/restaurant-settings/google-business-profile/googleBusinessProfileConnectionModel';
import { GoogleBusinessProfileSection } from '@/components/features/restaurant-settings/google-business-profile/GoogleBusinessProfileSection';
import { queryKeys } from '@/lib/query/keys';

import type { GoogleBusinessProfileConnection } from '@/services/ops/restaurants';

let mockSearchParams = new URLSearchParams();

const queryClientMock = vi.hoisted(() => ({
  invalidateQueries: vi.fn(),
}));

vi.mock('@tanstack/react-query', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    useQueryClient: () => queryClientMock,
  };
});

vi.mock('next/navigation', () => ({
  useSearchParams: () => mockSearchParams,
}));

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    warning: vi.fn(),
  },
}));

const connectionResult = {
  data: undefined as GoogleBusinessProfileConnection | undefined,
  isLoading: false,
  isFetching: false,
  error: null as Error | null,
  refetch: vi.fn(),
};

const locationsResult = {
  data: undefined as GoogleBusinessProfileConnection['availableLocations'] | undefined,
  isLoading: false,
  isFetching: false,
  error: null as Error | null,
  refetch: vi.fn(),
};

const linkMutation = {
  mutate: vi.fn(),
  isPending: false,
  error: null,
};

const disconnectMutation = {
  mutate: vi.fn(),
  isPending: false,
  error: null,
};

const startAuthorizationMutation = {
  mutate: vi.fn(),
  isPending: false,
  error: null,
};

vi.mock('@/hooks/ops/useOpsGoogleBusinessProfile', () => ({
  useOpsGoogleBusinessProfileConnection: () => connectionResult,
  useOpsGoogleBusinessProfileAvailableLocations: () => locationsResult,
  useOpsStartGoogleBusinessProfileAuthorization: () => startAuthorizationMutation,
  useOpsLinkGoogleBusinessProfileLocation: () => linkMutation,
  useOpsDisconnectGoogleBusinessProfile: () => disconnectMutation,
}));

function emptyBusinessInfo(): GoogleBusinessProfileConnection['businessInfo'] {
  return {
    details: null,
    addresses: [],
    phoneNumbers: [],
    links: [],
    categories: [],
    serviceAreas: [],
    hours: [],
    attributes: [],
    serviceItems: [],
    coreNormalization: {
      operatingHours: {
        source: 'unavailable',
        matchStatus: 'unavailable',
        summary: '',
        warnings: [],
        weekly: [],
        overrides: [],
      },
      servicePeriods: {
        source: 'unavailable',
        matchStatus: 'unavailable',
        summary: '',
        warnings: [],
        periods: [],
      },
      bookingHours: {
        matchStatus: 'unavailable',
        summary: '',
        warnings: [],
        missingInputs: [],
      },
    },
  };
}

function buildConnection(
  overrides: Partial<GoogleBusinessProfileConnection> = {},
): GoogleBusinessProfileConnection {
  return {
    isConfigured: true,
    provider: 'google_business_profile',
    status: 'unlinked',
    pushEnabled: true,
    connectedGoogleEmail: null,
    connectedGoogleName: null,
    externalAccountId: null,
    externalAccountName: null,
    externalLocationId: null,
    externalLocationName: null,
    externalLocationTitle: null,
    externalPlaceId: null,
    lastPullAt: null,
    lastPushAt: null,
    lastError: null,
    availableLocations: [],
    businessInfo: emptyBusinessInfo(),
    ...overrides,
  };
}

function expectSharedChrome() {
  expect(screen.getByTestId('gbp-overview-card')).toBeInTheDocument();
  expect(screen.queryByTestId('gbp-action-bar')).not.toBeInTheDocument();
  expect(screen.getByText(/google workflow/i)).toBeInTheDocument();
  expect(screen.queryByText(/google snapshot/i)).not.toBeInTheDocument();
  expect(screen.getByText(/related settings/i)).toBeInTheDocument();
  expect(screen.getByRole('link', { name: /restaurant profile/i })).toHaveAttribute(
    'href',
    '/app/settings/restaurant/profile#profile-contact',
  );
  expect(screen.getByRole('link', { name: /availability & booking types/i })).toHaveAttribute(
    'href',
    '/app/settings/restaurant/availability#availability-schedule',
  );
  expect(screen.getByText(/google is optional/i)).toBeInTheDocument();
}

beforeEach(() => {
  mockSearchParams = new URLSearchParams();
  connectionResult.data = undefined;
  connectionResult.error = null;
  connectionResult.isLoading = false;
  connectionResult.isFetching = false;
  connectionResult.refetch.mockReset();
  locationsResult.data = undefined;
  locationsResult.error = null;
  locationsResult.isLoading = false;
  locationsResult.isFetching = false;
  locationsResult.refetch.mockReset();
  linkMutation.mutate.mockReset();
  linkMutation.isPending = false;
  startAuthorizationMutation.mutate.mockReset();
  startAuthorizationMutation.isPending = false;
  disconnectMutation.mutate.mockReset();
  disconnectMutation.isPending = false;
  queryClientMock.invalidateQueries.mockReset();
  window.history.replaceState({}, '', '/app/settings/restaurant/google-business-profile');
});

describe('GoogleBusinessProfileSection', () => {
  it('renders shared chrome when no restaurant is selected', () => {
    render(<GoogleBusinessProfileSection restaurantId={null} />);

    expect(screen.getByText(/select a restaurant using the sidebar switcher/i)).toBeInTheDocument();
    expectSharedChrome();
  });

  it('invalidates GBP and dual-sync workspace queries when refreshing Google', async () => {
    const user = userEvent.setup();
    connectionResult.data = buildConnection({
      status: 'linked',
      externalAccountId: 'a-1',
      externalAccountName: 'accounts/1',
      externalLocationId: 'l-1',
      externalLocationName: 'locations/1',
      externalLocationTitle: 'Nabatable Main',
    });

    render(<GoogleBusinessProfileSection restaurantId="rest-1" />);

    await user.click(screen.getByRole('button', { name: /refresh connection/i }));

    expect(connectionResult.refetch).toHaveBeenCalledTimes(1);
    expect(queryClientMock.invalidateQueries).toHaveBeenCalledWith({
      queryKey: queryKeys.opsRestaurants.googleBusinessProfile('rest-1'),
    });
    expect(queryClientMock.invalidateQueries).toHaveBeenCalledWith({
      queryKey: ['dual-sync-state', 'rest-1'],
    });
  });

  it('renders loading shared chrome', () => {
    connectionResult.isLoading = true;

    render(<GoogleBusinessProfileSection restaurantId="rest-1" />);

    expectSharedChrome();
  });

  it('renders error shared chrome with retry', () => {
    connectionResult.error = new Error('boom');

    render(<GoogleBusinessProfileSection restaurantId="rest-1" />);

    expect(screen.getByText(/unable to load google business profile/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
    expectSharedChrome();
  });

  it('renders an explicit empty state when the query resolves without data', () => {
    render(<GoogleBusinessProfileSection restaurantId="rest-1" />);

    expect(screen.getByText(/connection details are not available/i)).toBeInTheDocument();
    expectSharedChrome();
  });

  it('renders the connect card without owning a page h1', () => {
    connectionResult.data = buildConnection({ status: 'unlinked' });

    render(<GoogleBusinessProfileSection restaurantId="rest-1" />);

    expect(screen.queryByRole('heading', { level: 1 })).not.toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /connect google/i }).length).toBeGreaterThan(0);
    expect(screen.queryByRole('button', { name: /refresh connection/i })).not.toBeInTheDocument();
    expect(document.getElementById('gbp-connection')).toBeInTheDocument();
    expectSharedChrome();
  });

  it('pins Google callback errors above the connection overview', async () => {
    mockSearchParams = new URLSearchParams('gbp=error&message=OAuth%20failed');
    connectionResult.data = buildConnection({ status: 'unlinked' });

    render(<GoogleBusinessProfileSection restaurantId="rest-1" />);

    expect(await screen.findByText('Google connection failed')).toBeInTheDocument();
    expect(screen.getByText('OAuth failed')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /retry connect/i })).toBeInTheDocument();
  });

  it('pins authorization mutation errors with a retry action', async () => {
    const user = userEvent.setup();
    connectionResult.data = buildConnection({ status: 'unlinked' });
    startAuthorizationMutation.mutate.mockImplementation(
      (_input: unknown, options: { onError: (error: Error) => void }) => {
        options.onError(new Error('OAuth service down'));
      },
    );

    render(<GoogleBusinessProfileSection restaurantId="rest-1" />);

    await user.click(screen.getAllByRole('button', { name: /connect google/i })[0]);

    expect(await screen.findByText('Google authorization failed')).toBeInTheDocument();
    expect(screen.getByText('OAuth service down')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /retry connect/i })).toBeInTheDocument();
  });

  it('renders the location picker card when the status is authorized', () => {
    connectionResult.data = buildConnection({
      status: 'authorized',
      connectedGoogleEmail: 'ops@example.com',
      availableLocations: [],
    });
    locationsResult.data = [
      {
        accountName: 'accounts/1',
        accountId: 'a-1',
        accountDisplayName: 'Ops Account',
        locationName: 'locations/1',
        locationId: 'l-1',
        title: 'Nabatable Main',
        addressText: '1 Test St, London',
        placeId: 'place-1',
      },
    ];

    render(<GoogleBusinessProfileSection restaurantId="rest-1" />);

    expect(screen.getByText(/choose a business profile location/i)).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: /available locations/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /link location/i })).toBeInTheDocument();
    expect(document.getElementById('gbp-location')).toBeInTheDocument();
    expectSharedChrome();
  });

  it('pins link-location errors with a retry action', async () => {
    const user = userEvent.setup();
    connectionResult.data = buildConnection({
      status: 'authorized',
      connectedGoogleEmail: 'ops@example.com',
      availableLocations: [],
    });
    locationsResult.data = [
      {
        accountName: 'accounts/1',
        accountId: 'a-1',
        accountDisplayName: 'Ops Account',
        locationName: 'locations/1',
        locationId: 'l-1',
        title: 'Nabatable Main',
        addressText: '1 Test St, London',
        placeId: 'place-1',
      },
    ];
    linkMutation.mutate.mockImplementation(
      (_input: unknown, options: { onError: (error: Error) => void }) => {
        options.onError(new Error('Google rejected the location link'));
      },
    );

    render(<GoogleBusinessProfileSection restaurantId="rest-1" />);

    await user.click(await screen.findByRole('button', { name: /link location/i }));

    expect(await screen.findByText('Location link failed')).toBeInTheDocument();
    expect(screen.getByText('Google rejected the location link')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /retry link/i })).toBeInTheDocument();
  });

  it('renders linked mode with one overview action surface', () => {
    connectionResult.data = buildConnection({
      status: 'linked',
      connectedGoogleEmail: 'ops@example.com',
      externalAccountId: 'a-1',
      externalAccountName: 'accounts/1',
      externalLocationId: 'l-1',
      externalLocationName: 'locations/1',
      externalLocationTitle: 'Nabatable Main',
      externalPlaceId: 'place-1',
      lastPullAt: '2026-04-20T10:00:00.000Z',
    });

    render(<GoogleBusinessProfileSection restaurantId="rest-1" />);

    expect(screen.getAllByText('Nabatable Main').length).toBeGreaterThan(0);
    expect(screen.getAllByText(/linked and ready/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/review changes below/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /refresh connection/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /manage on google/i })).toHaveAttribute(
      'href',
      'https://www.google.com/maps/search/?api=1&query_place_id=place-1',
    );
    expect(screen.getByRole('button', { name: /disconnect/i })).toBeInTheDocument();
    expect(screen.getAllByTestId('gbp-overview-card')).toHaveLength(1);
    expectSharedChrome();
  });

  it('renders truthful linked copy when the sync workspace is unavailable', () => {
    connectionResult.data = buildConnection({
      status: 'linked',
      connectedGoogleEmail: 'ops@example.com',
      externalAccountId: 'a-1',
      externalAccountName: 'accounts/1',
      externalLocationId: 'l-1',
      externalLocationName: 'locations/1',
      externalLocationTitle: 'Nabatable Main',
    });

    render(<GoogleBusinessProfileSection restaurantId="rest-1" hasSyncWorkspace={false} />);

    expect(screen.getByText(/google business profile linked/i)).toBeInTheDocument();
    expect(screen.getByText(/comparison tools are currently unavailable/i)).toBeInTheDocument();
    expect(screen.queryByText(/use the sync workspace below/i)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /review changes/i })).not.toBeInTheDocument();
  });

  it('opens disconnect confirmation and cancels without mutating', async () => {
    const user = userEvent.setup();
    connectionResult.data = buildConnection({
      status: 'linked',
      externalAccountId: 'a-1',
      externalAccountName: 'accounts/1',
      externalLocationId: 'l-1',
      externalLocationName: 'locations/1',
      externalLocationTitle: 'Nabatable Main',
    });

    render(<GoogleBusinessProfileSection restaurantId="rest-1" />);

    await user.click(screen.getByRole('button', { name: /disconnect/i }));

    expect(screen.getByText(/disconnect google business profile\?/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/confirm with your password/i)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /cancel/i }));

    expect(disconnectMutation.mutate).not.toHaveBeenCalled();
    expect(screen.queryByText(/disconnect google business profile\?/i)).not.toBeInTheDocument();
  });

  it('confirms disconnect with password through the existing mutation', async () => {
    const user = userEvent.setup();
    connectionResult.data = buildConnection({
      status: 'linked',
      externalAccountId: 'a-1',
      externalAccountName: 'accounts/1',
      externalLocationId: 'l-1',
      externalLocationName: 'locations/1',
      externalLocationTitle: 'Nabatable Main',
    });

    render(<GoogleBusinessProfileSection restaurantId="rest-1" />);

    await user.click(screen.getByRole('button', { name: /disconnect/i }));
    expect(screen.getAllByRole('button', { name: /^disconnect$/i }).at(-1)).toBeDisabled();
    await user.type(screen.getByLabelText(/confirm with your password/i), 'secret-password');
    await user.click(screen.getAllByRole('button', { name: /^disconnect$/i }).at(-1)!);

    expect(disconnectMutation.mutate).toHaveBeenCalledTimes(1);
    expect(disconnectMutation.mutate).toHaveBeenCalledWith(
      { password: 'secret-password' },
      expect.objectContaining({
        onSuccess: expect.any(Function),
        onError: expect.any(Function),
      }),
    );
  });

  it('disables disconnect dialog controls while the mutation is pending', async () => {
    const user = userEvent.setup();
    connectionResult.data = buildConnection({
      status: 'linked',
      externalAccountId: 'a-1',
      externalAccountName: 'accounts/1',
      externalLocationId: 'l-1',
      externalLocationName: 'locations/1',
      externalLocationTitle: 'Nabatable Main',
    });

    const { rerender } = render(<GoogleBusinessProfileSection restaurantId="rest-1" />);

    await user.click(screen.getByRole('button', { name: /disconnect/i }));
    disconnectMutation.isPending = true;
    rerender(<GoogleBusinessProfileSection restaurantId="rest-1" />);

    expect(screen.getByRole('button', { name: /cancel/i })).toBeDisabled();
    expect(screen.getAllByRole('button', { name: /disconnecting/i }).at(-1)).toBeDisabled();
  });

  it('surfaces location refresh errors with retry while keeping fallback locations', async () => {
    const user = userEvent.setup();
    connectionResult.data = buildConnection({
      status: 'authorized',
      connectedGoogleEmail: 'ops@example.com',
      availableLocations: [
        {
          accountName: 'accounts/1',
          accountId: 'a-1',
          accountDisplayName: 'Ops Account',
          locationName: 'locations/1',
          locationId: 'l-1',
          title: 'Fallback Main',
          addressText: '1 Test St, London',
          placeId: 'place-1',
        },
      ],
    });
    locationsResult.error = new Error('Google location discovery failed');

    render(<GoogleBusinessProfileSection restaurantId="rest-1" />);

    expect(screen.getByText(/location refresh failed/i)).toBeInTheDocument();
    expect(screen.getByText(/google location discovery failed/i)).toBeInTheDocument();
    expect(
      screen.getByRole('combobox', { name: /available locations \(possibly stale\)/i }),
    ).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /retry locations/i }));

    expect(locationsResult.refetch).toHaveBeenCalledTimes(1);
  });

  it('scrolls whitelisted hash anchors into view', async () => {
    const scrollIntoView = vi.fn();
    const requestAnimationFrame = vi.fn((callback: FrameRequestCallback) => {
      callback(0);
      return 1;
    });
    vi.stubGlobal('requestAnimationFrame', requestAnimationFrame);
    Object.defineProperty(window.HTMLElement.prototype, 'scrollIntoView', {
      configurable: true,
      value: scrollIntoView,
    });
    window.history.replaceState(
      {},
      '',
      '/app/settings/restaurant/google-business-profile#gbp-connection',
    );
    connectionResult.data = buildConnection({ status: 'unlinked' });

    render(<GoogleBusinessProfileSection restaurantId="rest-1" />);

    await waitFor(() =>
      expect(scrollIntoView).toHaveBeenCalledWith(
        expect.objectContaining({
          block: 'start',
          behavior: 'smooth',
        }),
      ),
    );
  });

  it('scrolls to the location hash when the picker is visible', async () => {
    const scrollIntoView = vi.fn();
    const requestAnimationFrame = vi.fn((callback: FrameRequestCallback) => {
      callback(0);
      return 1;
    });
    vi.stubGlobal('requestAnimationFrame', requestAnimationFrame);
    Object.defineProperty(window.HTMLElement.prototype, 'scrollIntoView', {
      configurable: true,
      value: scrollIntoView,
    });
    window.history.replaceState(
      {},
      '',
      '/app/settings/restaurant/google-business-profile#gbp-location',
    );
    connectionResult.data = buildConnection({
      status: 'authorized',
      connectedGoogleEmail: 'ops@example.com',
      availableLocations: [],
    });
    locationsResult.data = [
      {
        accountName: 'accounts/1',
        accountId: 'a-1',
        accountDisplayName: 'Ops Account',
        locationName: 'locations/1',
        locationId: 'l-1',
        title: 'Nabatable Main',
        addressText: '1 Test St, London',
        placeId: 'place-1',
      },
    ];

    render(<GoogleBusinessProfileSection restaurantId="rest-1" />);

    await waitFor(() =>
      expect(scrollIntoView).toHaveBeenCalledWith(
        expect.objectContaining({
          block: 'start',
          behavior: 'smooth',
        }),
      ),
    );
    expect(document.getElementById('gbp-location')).toBeInTheDocument();
  });
});

describe('GBP connection model', () => {
  it('builds stable location select values and Google Maps URLs', () => {
    expect(
      buildLocationValue({
        accountName: 'accounts/1',
        accountId: 'a-1',
        accountDisplayName: 'Ops Account',
        locationName: 'locations/2',
        locationId: 'l-2',
        title: 'Nabatable Main',
        addressText: '1 Test St',
        placeId: 'place 2',
      }),
    ).toBe(
      JSON.stringify({
        accountName: 'accounts/1',
        accountId: 'a-1',
        locationName: 'locations/2',
        locationId: 'l-2',
      }),
    );
    expect(buildGoogleMapsPlaceHref('place 2')).toBe(
      'https://www.google.com/maps/search/?api=1&query_place_id=place%202',
    );
    expect(buildGoogleMapsPlaceHref(null)).toBeNull();
  });
});
