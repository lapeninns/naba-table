import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { toast } from 'sonner';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  buildGoogleMapsPlaceHref,
  buildLocationValue,
} from '@/components/features/restaurant-settings/google-business-profile/googleBusinessProfileConnectionModel';
import { GoogleBusinessProfileSection } from '@/components/features/restaurant-settings/google-business-profile/GoogleBusinessProfileSection';
import { HttpError } from '@/lib/http/errors';
import { queryKeys } from '@/lib/query/keys';

import type { GoogleBusinessProfileConnection } from '@/services/ops/restaurants';

const SENTINEL = 'SECRET_DB_DETAIL relation "x" does not exist';

function expectNoSentinelAnywhere() {
  expect(document.body.textContent).not.toContain('SECRET_DB_DETAIL');
  for (const call of vi.mocked(toast.error).mock.calls) {
    expect(JSON.stringify(call)).not.toContain('SECRET_DB_DETAIL');
  }
}

let mockSearchParams = new URLSearchParams();
let mockCanManageSettings = true;

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

vi.mock('@/contexts/ops-session', () => ({
  useOpsSession: () => ({ permissions: { canManageSettings: mockCanManageSettings } }),
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

const operatorStateResult = {
  connectionQuery: {
    data: undefined,
    isLoading: true,
    error: null,
  },
  terminalNoticesQuery: {
    data: undefined,
  },
  setWriteAccessMutation: {
    mutateAsync: vi.fn(),
    isPending: false,
    error: null,
  },
  setNotificationParticipationMutation: {
    mutateAsync: vi.fn(),
    isPending: false,
    error: null,
  },
};

// The comparison workspace (review table, decision bar, publish flows) has its own suite.
vi.mock(
  '@/components/features/restaurant-settings/google-business-profile/components/GbpSyncWorkspace',
  () => ({
    GbpSyncWorkspace: ({ restaurantId }: { restaurantId: string }) => (
      <div data-testid="gbp-sync-workspace" data-restaurant-id={restaurantId} />
    ),
  }),
);

vi.mock('@/hooks/ops/useOpsGoogleBusinessProfile', () => ({
  useOpsGoogleBusinessProfileConnection: () => connectionResult,
  useOpsGoogleBusinessProfileAvailableLocations: () => locationsResult,
  useOpsStartGoogleBusinessProfileAuthorization: () => startAuthorizationMutation,
  useOpsLinkGoogleBusinessProfileLocation: () => linkMutation,
  useOpsDisconnectGoogleBusinessProfile: () => disconnectMutation,
  useOpsGbpOperatorState: () => operatorStateResult,
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

const LOCATION = {
  accountName: 'accounts/1',
  accountId: 'a-1',
  accountDisplayName: 'Ops Account',
  locationName: 'locations/1',
  locationId: 'l-1',
  title: 'Nabatable Main',
  addressText: '1 Test St, London',
  placeId: 'place-1',
};

function linkedConnection(overrides: Partial<GoogleBusinessProfileConnection> = {}) {
  return buildConnection({
    status: 'linked',
    connectedGoogleEmail: 'ops@example.com',
    externalAccountId: 'a-1',
    externalAccountName: 'accounts/1',
    externalLocationId: 'l-1',
    externalLocationName: 'locations/1',
    externalLocationTitle: 'Nabatable Main',
    externalPlaceId: 'place-1',
    lastPullAt: '2026-04-20T10:00:00.000Z',
    ...overrides,
  });
}

/** The page intro shows while there is nothing else to explain the page (loading, errors). */
async function openOperations(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('tab', { name: /operations/i }));
}

function expectSharedChrome() {
  expect(
    screen.getByText(/optional\. link your google listing to compare your public details/i),
  ).toBeInTheDocument();
  expect(screen.queryByRole('heading', { level: 1 })).not.toBeInTheDocument();
}

beforeEach(() => {
  mockSearchParams = new URLSearchParams();
  mockCanManageSettings = true;
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
  vi.mocked(toast.error).mockReset();
  window.history.replaceState({}, '', '/app/settings/restaurant/google-business-profile');
});

describe('GoogleBusinessProfileSection', () => {
  it('renders shared chrome when no restaurant is selected', () => {
    render(<GoogleBusinessProfileSection restaurantId={null} />);

    expect(screen.getByText(/select a restaurant using the sidebar switcher/i)).toBeInTheDocument();
    expectSharedChrome();
  });

  it('invalidates GBP and dual-sync workspace queries when checking Google again', async () => {
    const user = userEvent.setup();
    // "Check again" is the refresh while the listing is linked but not comparable.
    connectionResult.data = linkedConnection({ status: 'reauth_required' });

    render(<GoogleBusinessProfileSection restaurantId="rest-1" />);

    await user.click(screen.getByRole('button', { name: /check again/i }));

    // Invalidation alone refetches the active queries; no extra refetch() doubles the requests.
    expect(connectionResult.refetch).not.toHaveBeenCalled();
    expect(queryClientMock.invalidateQueries).toHaveBeenCalledWith({
      queryKey: queryKeys.opsRestaurants.googleBusinessProfile('rest-1'),
      exact: true,
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

  it('renders error shared chrome with a try-again action', () => {
    connectionResult.error = new HttpError({ status: 500, message: SENTINEL });

    render(<GoogleBusinessProfileSection restaurantId="rest-1" />);

    expect(screen.getByText(/unable to load google business profile/i)).toBeInTheDocument();
    expect(
      screen.getByText('Google Business Profile could not be loaded. Reason code: HTTP_500.'),
    ).toBeInTheDocument();
    expectNoSentinelAnywhere();
    expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument();
    expectSharedChrome();
  });

  it('renders an explicit empty state when the query resolves without data', () => {
    render(<GoogleBusinessProfileSection restaurantId="rest-1" />);

    expect(screen.getByText(/connection details are not available/i)).toBeInTheDocument();
    expectSharedChrome();
  });

  it('renders the three steps with sign-in first and the later steps locked', () => {
    connectionResult.data = buildConnection({ status: 'unlinked' });

    render(<GoogleBusinessProfileSection restaurantId="rest-1" />);

    const setup = screen.getByRole('region', { name: 'Link your Google listing' });
    expect(within(setup).getByText('Not connected')).toBeInTheDocument();
    expect(within(setup).getByRole('button', { name: 'Connect Google' })).toBeEnabled();
    expect(within(setup).getByText('Available after sign-in.')).toBeInTheDocument();
    expect(
      within(setup).getByText(
        'Nothing is sent to Google until you review and confirm an exact plan.',
      ),
    ).toBeInTheDocument();
    expect(within(setup).queryByRole('button', { name: 'Choose listing' })).toBeNull();
    expect(screen.queryByTestId('gbp-sync-workspace')).not.toBeInTheDocument();
    expect(document.getElementById('gbp-sync-review')).toBeNull();
    // Deep links from other settings pages still land on the right part of the page.
    expect(document.getElementById('gbp-connection')).toBe(setup);
    expect(document.getElementById('gbp-location')).toBeInTheDocument();
  });

  it('uses the brief wording for the waiting and reconnect states', () => {
    connectionResult.data = buildConnection({ status: 'pending_auth' });
    const { unmount } = render(<GoogleBusinessProfileSection restaurantId="rest-1" />);

    expect(screen.getAllByText('Waiting for Google').length).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: 'Start Google sign-in again' })).toBeInTheDocument();
    unmount();

    connectionResult.data = linkedConnection({ status: 'reauth_required' });
    render(<GoogleBusinessProfileSection restaurantId="rest-1" />);

    expect(screen.getAllByText('Reconnect needed').length).toBeGreaterThan(0);
    expect(screen.getByText('Reconnect Google to keep publishing')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Reconnect Google' })).toBeInTheDocument();
    expect(
      screen.getByText('Reconnect Google to compare your details with the listing again.'),
    ).toBeInTheDocument();
  });

  it('pins Google callback errors above the steps', async () => {
    mockSearchParams = new URLSearchParams(
      'gbp=error&message=Google%20authorization%20was%20cancelled%20or%20denied.',
    );
    connectionResult.data = buildConnection({ status: 'unlinked' });

    render(<GoogleBusinessProfileSection restaurantId="rest-1" />);

    expect(await screen.findByText('Google connection failed')).toBeInTheDocument();
    expect(
      screen.getByText(
        'Google authorization was cancelled or denied. Connect Google to try again.',
      ),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /retry connect/i })).toBeInTheDocument();
  });

  it('never renders free text from the callback message parameter', async () => {
    mockSearchParams = new URLSearchParams({ gbp: 'error', message: SENTINEL });
    connectionResult.data = buildConnection({ status: 'unlinked' });

    render(<GoogleBusinessProfileSection restaurantId="rest-1" />);

    expect(await screen.findByText('Google connection failed')).toBeInTheDocument();
    expect(
      screen.getByText('Google Business Profile connection failed. Connect Google to try again.'),
    ).toBeInTheDocument();
    expect(toast.error).toHaveBeenCalledWith(
      'Google Business Profile connection failed. Connect Google to try again.',
    );
    expectNoSentinelAnywhere();
  });

  it('pins authorization mutation errors with a retry action', async () => {
    const user = userEvent.setup();
    connectionResult.data = buildConnection({ status: 'unlinked' });
    startAuthorizationMutation.mutate.mockImplementation(
      (_input: unknown, options: { onError: (error: Error) => void }) => {
        options.onError(new HttpError({ status: 502, message: SENTINEL }));
      },
    );

    render(<GoogleBusinessProfileSection restaurantId="rest-1" />);

    await user.click(screen.getByRole('button', { name: 'Connect Google' }));

    expect(await screen.findByText('Google authorization failed')).toBeInTheDocument();
    const copy = 'Google authorization could not be started. Reason code: HTTP_502.';
    expect(screen.getByText(copy)).toBeInTheDocument();
    expect(toast.error).toHaveBeenCalledWith(copy);
    expectNoSentinelAnywhere();
    expect(screen.getByRole('button', { name: /retry connect/i })).toBeInTheDocument();
  });

  it('chooses a location in a dialog with native radios when the status is authorized', async () => {
    const user = userEvent.setup();
    connectionResult.data = buildConnection({
      status: 'authorized',
      connectedGoogleEmail: 'ops@example.com',
      availableLocations: [],
    });
    locationsResult.data = [LOCATION];

    render(<GoogleBusinessProfileSection restaurantId="rest-1" />);

    expect(screen.getAllByText('Choose a listing').length).toBeGreaterThan(0);
    await user.click(screen.getByRole('button', { name: 'Choose listing' }));

    const dialog = await screen.findByRole('dialog', {
      name: /choose a business profile location/i,
    });
    const group = within(dialog).getByRole('group', { name: 'Available locations' });
    expect(within(group).getByRole('radio', { name: /nabatable main/i })).toBeChecked();
    expect(within(dialog).getByText('1 Test St, London · Ops Account')).toBeInTheDocument();

    await user.click(within(dialog).getByRole('button', { name: 'Link location' }));

    expect(linkMutation.mutate).toHaveBeenCalledWith(
      {
        accountName: 'accounts/1',
        accountId: 'a-1',
        locationName: 'locations/1',
        locationId: 'l-1',
      },
      expect.objectContaining({ onSuccess: expect.any(Function) }),
    );
    expect(document.getElementById('gbp-location')).toBeInTheDocument();
  });

  it('pins link-location errors with a retry action', async () => {
    const user = userEvent.setup();
    connectionResult.data = buildConnection({
      status: 'authorized',
      connectedGoogleEmail: 'ops@example.com',
      availableLocations: [],
    });
    locationsResult.data = [LOCATION];
    linkMutation.mutate.mockImplementation(
      (_input: unknown, options: { onError: (error: Error) => void }) => {
        options.onError(new HttpError({ status: 500, message: SENTINEL }));
      },
    );

    render(<GoogleBusinessProfileSection restaurantId="rest-1" />);

    await user.click(screen.getByRole('button', { name: 'Choose listing' }));
    const dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: 'Link location' }));

    const copy = 'The location could not be linked. Reason code: HTTP_500.';
    expect(await within(dialog).findByText('Location link failed')).toBeInTheDocument();
    expect(dialog).toHaveTextContent(copy);
    expectNoSentinelAnywhere();

    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }));

    expect(await screen.findByRole('button', { name: /retry link/i })).toBeInTheDocument();
    expect(screen.getByText(copy)).toBeInTheDocument();
    expect(toast.error).toHaveBeenCalledWith(copy);
    expectNoSentinelAnywhere();
  });

  it('hands a linked, comparable listing to the comparison workspace', async () => {
    connectionResult.data = linkedConnection({ availableLocations: [LOCATION] });

    render(<GoogleBusinessProfileSection restaurantId="rest-1" />);

    expect(await screen.findByTestId('gbp-sync-workspace')).toHaveAttribute(
      'data-restaurant-id',
      'rest-1',
    );
    expect(screen.queryByTestId('gbp-setup-card')).not.toBeInTheDocument();
  });

  it('hides admin-only Google operator controls without settings permission', () => {
    mockCanManageSettings = false;
    connectionResult.data = linkedConnection({ status: 'reauth_required' });

    render(<GoogleBusinessProfileSection restaurantId="rest-1" />);

    expect(screen.queryByText(/loading google write controls/i)).not.toBeInTheDocument();
    expect(screen.queryByText('Google writes')).not.toBeInTheDocument();
    expect(screen.queryByTestId('gbp-operator-controls')).not.toBeInTheDocument();
  });

  it('opens disconnect confirmation and cancels without mutating', async () => {
    const user = userEvent.setup();
    connectionResult.data = linkedConnection({ status: 'reauth_required' });

    render(<GoogleBusinessProfileSection restaurantId="rest-1" />);

    await openOperations(user);
    await user.click(screen.getByRole('button', { name: /disconnect google/i }));

    expect(screen.getByText(/disconnect google business profile\?/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/confirm with your password/i)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /cancel/i }));

    expect(disconnectMutation.mutate).not.toHaveBeenCalled();
    expect(screen.queryByText(/disconnect google business profile\?/i)).not.toBeInTheDocument();
  });

  it('confirms disconnect with password through the existing mutation', async () => {
    const user = userEvent.setup();
    connectionResult.data = linkedConnection({ status: 'reauth_required' });

    render(<GoogleBusinessProfileSection restaurantId="rest-1" />);

    await openOperations(user);
    await user.click(screen.getByRole('button', { name: /disconnect google/i }));
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

  it('pins disconnect errors as fixed copy without the server message', async () => {
    const user = userEvent.setup();
    connectionResult.data = linkedConnection({ status: 'reauth_required' });
    disconnectMutation.mutate.mockImplementation(
      (_input: unknown, options: { onError: (error: Error) => void }) => {
        options.onError(
          new HttpError({ status: 403, code: 'PASSWORD_CONFIRMATION_FAILED', message: SENTINEL }),
        );
      },
    );

    render(<GoogleBusinessProfileSection restaurantId="rest-1" />);

    await openOperations(user);
    await user.click(screen.getByRole('button', { name: /disconnect google/i }));
    await user.type(screen.getByLabelText(/confirm with your password/i), 'secret-password');
    await user.click(screen.getAllByRole('button', { name: /^disconnect$/i }).at(-1)!);

    const copy =
      'Your password was not accepted. Check it and try again. Reason code: PASSWORD_CONFIRMATION_FAILED.';
    expect(await screen.findByText('Disconnect failed')).toBeInTheDocument();
    expect(screen.getAllByText(copy).length).toBeGreaterThan(0);
    expect(toast.error).toHaveBeenCalledWith(copy);
    expectNoSentinelAnywhere();
  });

  it('disables disconnect dialog controls while the mutation is pending', async () => {
    const user = userEvent.setup();
    connectionResult.data = linkedConnection({ status: 'reauth_required' });

    const { rerender } = render(<GoogleBusinessProfileSection restaurantId="rest-1" />);

    await openOperations(user);
    await user.click(screen.getByRole('button', { name: /disconnect google/i }));
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
      availableLocations: [{ ...LOCATION, title: 'Fallback Main' }],
    });
    locationsResult.error = new HttpError({ status: 500, message: SENTINEL });

    render(<GoogleBusinessProfileSection restaurantId="rest-1" />);

    expect(screen.getByText(/listings didn’t load/i)).toBeInTheDocument();
    expect(
      screen.getByText('Google locations could not be loaded. Reason code: HTTP_500.'),
    ).toBeInTheDocument();
    expectNoSentinelAnywhere();

    await user.click(screen.getByRole('button', { name: /try again/i }));
    expect(locationsResult.refetch).toHaveBeenCalledTimes(1);

    await user.click(screen.getByRole('button', { name: 'Choose listing' }));
    expect(
      await screen.findByRole('group', { name: /available locations \(possibly stale\)/i }),
    ).toBeInTheDocument();
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
