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
import type { ReactNode } from 'react';

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

vi.mock('@/components/features/restaurant-settings/dual-sync/DualSyncShell', () => ({
  DualSyncShell: ({
    restaurantId,
    renderEvidence,
  }: {
    restaurantId: string;
    renderEvidence?: (evidence: {
      syncControls: null;
      operationalPanels: null;
      onRequestRefresh: () => void;
      refreshPending: boolean;
    }) => ReactNode;
  }) => (
    <div data-testid="dual-sync-shell" data-restaurant-id={restaurantId}>
      {renderEvidence?.({
        syncControls: null,
        operationalPanels: null,
        onRequestRefresh: () => undefined,
        refreshPending: false,
      })}
    </div>
  ),
}));

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

function expectSharedChrome() {
  expect(
    screen.getByText(/optional\. link your google listing to compare your public details/i),
  ).toBeInTheDocument();
  expect(screen.queryByRole('navigation', { name: /google workflow/i })).not.toBeInTheDocument();
  expect(screen.queryByRole('heading', { level: 1 })).not.toBeInTheDocument();
}

function expectRelatedSettingsLinks() {
  expect(screen.getByText(/related settings/i)).toBeInTheDocument();
  expect(screen.getByRole('link', { name: /restaurant profile/i })).toHaveAttribute(
    'href',
    '/app/settings/restaurant/profile#profile-contact',
  );
  expect(screen.getByRole('link', { name: /availability & booking types/i })).toHaveAttribute(
    'href',
    '/app/settings/restaurant/availability#availability-schedule',
  );
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
    connectionResult.data = linkedConnection();

    render(<GoogleBusinessProfileSection restaurantId="rest-1" />);

    await user.click(screen.getByRole('button', { name: /check again/i }));

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

  it('renders the three steps with connect first and the later steps locked', () => {
    connectionResult.data = buildConnection({ status: 'unlinked' });

    render(<GoogleBusinessProfileSection restaurantId="rest-1" />);

    const connection = screen.getByRole('region', { name: /step 1: connection/i });
    expect(within(connection).getByText('Not connected')).toBeInTheDocument();
    expect(within(connection).getByRole('button', { name: 'Connect Google' })).toBeEnabled();
    expect(within(connection).queryByRole('button', { name: /check again/i })).toBeNull();
    const location = screen.getByRole('region', { name: /step 2: business location/i });
    expect(within(location).getByText('Locked until step 1 is done.')).toBeInTheDocument();
    expect(screen.getByText('Available once a location is linked.')).toBeInTheDocument();
    expect(screen.queryByTestId('dual-sync-shell')).not.toBeInTheDocument();
    expect(document.getElementById('gbp-sync-review')).toBeNull();
    expectSharedChrome();
    expectRelatedSettingsLinks();
  });

  it('uses the brief wording for the waiting and reconnect states', () => {
    connectionResult.data = buildConnection({ status: 'pending_auth' });
    const { unmount } = render(<GoogleBusinessProfileSection restaurantId="rest-1" />);

    expect(screen.getAllByText('Waiting for Google').length).toBeGreaterThan(0);
    unmount();

    connectionResult.data = linkedConnection({ status: 'reauth_required' });
    render(<GoogleBusinessProfileSection restaurantId="rest-1" />);

    expect(screen.getAllByText('Reconnect needed').length).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: 'Reconnect Google' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Change location' })).toBeInTheDocument();
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

    expect(screen.getAllByText('Choose a location').length).toBeGreaterThan(0);
    await user.click(screen.getByRole('button', { name: 'Choose location' }));

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

    await user.click(screen.getByRole('button', { name: 'Choose location' }));
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

  it('renders linked mode with connection, location, review and write controls', () => {
    connectionResult.data = linkedConnection({ availableLocations: [LOCATION] });

    render(<GoogleBusinessProfileSection restaurantId="rest-1" />);

    const connection = screen.getByTestId('gbp-connection-card');
    expect(within(connection).getAllByText('Linked').length).toBeGreaterThan(0);
    expect(within(connection).getByText('ops@example.com')).toBeInTheDocument();
    const location = screen.getByTestId('gbp-location-card');
    expect(within(location).getByText('Location chosen')).toBeInTheDocument();
    expect(within(location).getByText('Nabatable Main')).toBeInTheDocument();
    expect(within(location).getByText('Ops Account')).toBeInTheDocument();
    expect(within(location).getByText('1 Test St, London')).toBeInTheDocument();
    expect(within(location).getByRole('link', { name: /manage on google/i })).toHaveAttribute(
      'href',
      'https://www.google.com/maps/search/?api=1&query_place_id=place-1',
    );
    expect(screen.getByRole('button', { name: /check again/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /disconnect/i })).toBeInTheDocument();
    expect(screen.getByTestId('dual-sync-shell')).toHaveAttribute('data-restaurant-id', 'rest-1');
    expect(document.getElementById('gbp-sync-review')).toContainElement(
      screen.getByTestId('dual-sync-shell'),
    );
    expect(screen.getByRole('button', { name: /write controls and evidence/i })).toHaveAttribute(
      'aria-expanded',
      'false',
    );
    expectRelatedSettingsLinks();
  });

  it('keeps the review step open after a sync issue so differences can still be reviewed', () => {
    connectionResult.data = linkedConnection({
      status: 'sync_error',
      lastError: 'provider_pre_dispatch_failed',
    });

    render(<GoogleBusinessProfileSection restaurantId="rest-1" />);

    expect(screen.getAllByText('Sync issue').length).toBeGreaterThan(0);
    expect(screen.getByText('Couldn’t reach Google')).toBeInTheDocument();
    expect(screen.getByText('provider_pre_dispatch_failed')).toBeInTheDocument();
    expect(screen.getByTestId('dual-sync-shell')).toBeInTheDocument();
  });

  it('opens write controls automatically when Google pending changes are unknown', () => {
    const connectionQuery = operatorStateResult.connectionQuery as {
      data: unknown;
      isLoading: boolean;
      error: null;
    };
    connectionQuery.isLoading = false;
    connectionQuery.data = {
      version: 'v1',
      restaurantId: 'rest-1',
      provider: 'google_business_profile',
      connectionStatus: 'linked',
      writeState: 'blocked',
      connectionGeneration: 3,
      consentEpoch: 4,
      reasonCode: 'pending_paths_unknown',
      rollout: { eligible: true, cohort: 'canary', evaluatedAt: '2026-08-09T10:00:00.000Z' },
      pendingUpdates: {
        version: 'v1',
        restaurantId: 'rest-1',
        state: 'unknown',
        locationMasks: [],
        attributePaths: [],
        unknownPaths: [],
        observedAt: '2026-08-09T10:00:00.000Z',
        expiresAt: '2026-08-10T10:00:00.000Z',
      },
      notifications: { enabled: false, refCount: 0 },
      refresh: {
        status: 'stale',
        lastAttemptAt: null,
        lastSucceededAt: null,
        safeErrorCode: null,
      },
    };
    connectionResult.data = linkedConnection();

    try {
      render(<GoogleBusinessProfileSection restaurantId="rest-1" />);

      expect(screen.getByRole('button', { name: /write controls and evidence/i })).toHaveAttribute(
        'aria-expanded',
        'true',
      );
      expect(screen.getByText('Publishing stopped')).toBeInTheDocument();
      expect(screen.getByText('Writes off')).toBeInTheDocument();
      expect(
        screen.getByText('Publishing is stopped: Google’s pending changes are unknown'),
      ).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Request a fresh refresh' })).toBeInTheDocument();
    } finally {
      connectionQuery.isLoading = true;
      connectionQuery.data = undefined;
    }
  });

  it('hides admin-only Google operator controls without settings permission', () => {
    mockCanManageSettings = false;
    connectionResult.data = buildConnection({
      status: 'linked',
      externalAccountId: 'a-1',
      externalLocationId: 'l-1',
      externalLocationName: 'locations/1',
    });

    render(<GoogleBusinessProfileSection restaurantId="rest-1" />);

    expect(screen.queryByText(/loading google write controls/i)).not.toBeInTheDocument();
    expect(screen.queryByText('Writes on')).not.toBeInTheDocument();
  });

  it('renders truthful linked copy when the sync workspace is unavailable', () => {
    connectionResult.data = linkedConnection();

    render(<GoogleBusinessProfileSection restaurantId="rest-1" hasSyncWorkspace={false} />);

    expect(screen.getByText(/comparison tools are currently unavailable/i)).toBeInTheDocument();
    expect(screen.queryByTestId('dual-sync-shell')).not.toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /write controls and evidence/i }),
    ).toBeInTheDocument();
  });

  it('opens disconnect confirmation and cancels without mutating', async () => {
    const user = userEvent.setup();
    connectionResult.data = linkedConnection();

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
    connectionResult.data = linkedConnection();

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

  it('pins disconnect errors as fixed copy without the server message', async () => {
    const user = userEvent.setup();
    connectionResult.data = linkedConnection();
    disconnectMutation.mutate.mockImplementation(
      (_input: unknown, options: { onError: (error: Error) => void }) => {
        options.onError(
          new HttpError({ status: 403, code: 'PASSWORD_CONFIRMATION_FAILED', message: SENTINEL }),
        );
      },
    );

    render(<GoogleBusinessProfileSection restaurantId="rest-1" />);

    await user.click(screen.getByRole('button', { name: /disconnect/i }));
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
    connectionResult.data = linkedConnection();

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
      availableLocations: [{ ...LOCATION, title: 'Fallback Main' }],
    });
    locationsResult.error = new HttpError({ status: 500, message: SENTINEL });

    render(<GoogleBusinessProfileSection restaurantId="rest-1" />);

    expect(screen.getByText(/location refresh failed/i)).toBeInTheDocument();
    expect(
      screen.getByText('Google locations could not be loaded. Reason code: HTTP_500.'),
    ).toBeInTheDocument();
    expectNoSentinelAnywhere();

    await user.click(screen.getByRole('button', { name: /retry locations/i }));
    expect(locationsResult.refetch).toHaveBeenCalledTimes(1);

    await user.click(screen.getByRole('button', { name: 'Choose location' }));
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
