import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  buildGoogleMapsPlaceHref,
  buildLocationValue,
} from '@/components/features/restaurant-settings/google-business-profile/googleBusinessProfileConnectionModel';
import { GoogleBusinessProfileSection } from '@/components/features/restaurant-settings/google-business-profile/GoogleBusinessProfileSection';

import type { GoogleBusinessProfileConnection } from '@/services/ops/restaurants';

let mockSearchParams = new URLSearchParams();

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

vi.mock('@/hooks/ops/useOpsGoogleBusinessProfile', () => ({
  useOpsGoogleBusinessProfileConnection: () => connectionResult,
  useOpsGoogleBusinessProfileAvailableLocations: () => locationsResult,
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
  expect(screen.getByTestId('gbp-action-bar')).toBeInTheDocument();
  expect(screen.getByText(/related settings/i)).toBeInTheDocument();
  expect(screen.getByRole('link', { name: /restaurant profile/i })).toHaveAttribute(
    'href',
    '/app/settings/restaurant/profile#profile-discovery',
  );
  expect(screen.getByRole('link', { name: /availability & occasions/i })).toHaveAttribute(
    'href',
    '/app/settings/restaurant/availability',
  );
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
  disconnectMutation.mutate.mockReset();
  disconnectMutation.isPending = false;
  window.history.replaceState({}, '', '/app/settings/restaurant/google-business-profile');
});

describe('GoogleBusinessProfileSection', () => {
  it('renders shared chrome when no restaurant is selected', () => {
    render(<GoogleBusinessProfileSection restaurantId={null} />);

    expect(screen.getByText(/select a restaurant using the sidebar switcher/i)).toBeInTheDocument();
    expectSharedChrome();
  });

  it('renders loading shared chrome', () => {
    connectionResult.isLoading = true;

    render(<GoogleBusinessProfileSection restaurantId="rest-1" />);

    expect(screen.getByTestId('gbp-action-bar')).toBeInTheDocument();
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
    expect(screen.getByRole('link', { name: /connect google/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /refresh google/i })).not.toBeInTheDocument();
    expect(document.getElementById('gbp-connection')).toBeInTheDocument();
    expectSharedChrome();
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

  it('renders a linked summary with one compact action bar', () => {
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

    expect(screen.getByText(/linked location/i)).toBeInTheDocument();
    expect(screen.getByText('Nabatable Main')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /refresh google/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /manage on google/i })).toHaveAttribute(
      'href',
      'https://www.google.com/maps/search/?api=1&query_place_id=place-1',
    );
    expect(screen.getByRole('button', { name: /disconnect/i })).toBeInTheDocument();
    expect(screen.getAllByTestId('gbp-action-bar')).toHaveLength(1);
    expectSharedChrome();
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
