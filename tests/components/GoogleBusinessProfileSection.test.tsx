import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type {
  GoogleBusinessProfileConnection,
  RestaurantProfile,
} from '@/services/ops/restaurants';

vi.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams(),
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

const profileResult = {
  data: undefined as RestaurantProfile | undefined,
  isLoading: false,
  error: null as Error | null,
};

vi.mock('@/hooks/ops/useOpsGoogleBusinessProfile', () => ({
  useOpsGoogleBusinessProfileConnection: () => connectionResult,
  useOpsLinkGoogleBusinessProfileLocation: () => ({
    mutate: vi.fn(),
    isPending: false,
    error: null,
  }),
  useOpsDisconnectGoogleBusinessProfile: () => ({
    mutate: vi.fn(),
    isPending: false,
    error: null,
  }),
  useOpsSyncGoogleBusinessProfile: () => ({
    mutate: vi.fn(),
    isPending: false,
    error: null,
  }),
}));

vi.mock('@/hooks/ops/useOpsRestaurantDetails', () => ({
  useOpsRestaurantDetails: () => profileResult,
}));

vi.mock('@/hooks/ops/useOpsOperatingHours', () => ({
  useOpsOperatingHours: () => ({
    data: undefined,
    isLoading: false,
  }),
}));

vi.mock('@/hooks/ops/useOpsServicePeriods', () => ({
  useOpsServicePeriods: () => ({
    data: undefined,
    isLoading: false,
  }),
}));

import { GoogleBusinessProfileSection } from '@/components/features/restaurant-settings/google-business-profile/GoogleBusinessProfileSection';
import { buildDriftReport } from '@/components/features/restaurant-settings/google-business-profile/lib/drift';
import { deriveProfileVerification } from '@/components/features/restaurant-settings/google-business-profile/googleBusinessProfileVerification';

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

beforeEach(() => {
  connectionResult.data = undefined;
  connectionResult.error = null;
  connectionResult.isLoading = false;
  connectionResult.isFetching = false;
  profileResult.data = undefined;
  profileResult.error = null;
});

describe('GoogleBusinessProfileSection', () => {
  it('renders the connect card when the status is unlinked', () => {
    connectionResult.data = buildConnection({ status: 'unlinked' });
    render(<GoogleBusinessProfileSection restaurantId="rest-1" />);

    expect(screen.getByRole('heading', { level: 1, name: /google business profile/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /connect google/i })).toBeInTheDocument();
    expect(screen.queryByText(/choose a business profile location/i)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /sync now/i })).not.toBeInTheDocument();
  });

  it('renders the location picker card when the status is authorized', () => {
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
          title: 'Nabatable Main',
          addressText: '1 Test St, London',
          placeId: 'place-1',
        },
      ],
    });
    render(<GoogleBusinessProfileSection restaurantId="rest-1" />);

    expect(screen.getByText(/choose a business profile location/i)).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: /available locations/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /link location/i })).toBeInTheDocument();
  });

  it('renders the linked summary, alignment, and snapshot cards when status is linked', () => {
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
      availableLocations: [
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
      ],
    });
    render(<GoogleBusinessProfileSection restaurantId="rest-1" />);

    expect(screen.getByRole('heading', { level: 1, name: /google business profile/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /sync now/i })).toBeInTheDocument();
    expect(screen.getByText('Alignment')).toBeInTheDocument();
    expect(screen.getByText(/google snapshot/i)).toBeInTheDocument();
  });

  it('surfaces the last sync error inside the linked summary when status is sync_error', () => {
    connectionResult.data = buildConnection({
      status: 'sync_error',
      externalLocationId: 'l-1',
      externalLocationTitle: 'Nabatable Main',
      lastError: 'Temporary sync failure',
    });
    render(<GoogleBusinessProfileSection restaurantId="rest-1" />);

    expect(screen.getByText(/sync needs attention/i)).toBeInTheDocument();
    expect(screen.getByText(/temporary sync failure/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /sync now/i })).toBeInTheDocument();
  });
});

describe('buildDriftReport', () => {
  it('aggregates drift counts across profile fields, hours, and service periods', () => {
    const connection: GoogleBusinessProfileConnection = buildConnection({
      status: 'linked',
      externalLocationTitle: 'Nabatable Main',
      businessInfo: {
        ...emptyBusinessInfo(),
        phoneNumbers: [
          {
            id: 'p-1',
            phoneKind: 'primary',
            phoneNumber: '+44 20 1234 5678',
            isPrimary: true,
            lastSyncedAt: null,
          },
        ],
        coreNormalization: {
          operatingHours: {
            source: 'public',
            matchStatus: 'drifted',
            summary: '',
            warnings: ['Warning A'],
            weekly: [
              {
                dayOfWeek: 1,
                opensAt: '09:00',
                closesAt: '17:00',
                isClosed: false,
                matchesCore: true,
              },
              {
                dayOfWeek: 2,
                opensAt: '09:00',
                closesAt: '17:00',
                isClosed: false,
                matchesCore: false,
              },
            ],
            overrides: [
              {
                effectiveDate: '2026-04-21',
                opensAt: null,
                closesAt: null,
                isClosed: true,
                matchesCore: false,
              },
            ],
          },
          servicePeriods: {
            source: 'more_hours',
            matchStatus: 'drifted',
            summary: '',
            warnings: ['Warning B'],
            periods: [
              {
                bookingOption: 'lunch',
                name: 'Lunch',
                dayOfWeek: 1,
                startTime: '12:00',
                endTime: '15:00',
                matchesCore: false,
              },
            ],
          },
          bookingHours: {
            matchStatus: 'partial',
            summary: '',
            warnings: ['Warning C'],
            missingInputs: [],
          },
        },
      },
    });

    const profile: RestaurantProfile = {
      id: 'rest-1',
      name: 'Nabatable Main',
      contactPhone: '+44 20 9999 0000',
      address: '1 Test St',
      googleMapUrl: null,
      googleReviewUrl: null,
      website: null,
      logoUrl: null,
      heroImageUrl: null,
      timezone: 'Europe/London',
      currency: 'GBP',
      bookingEmail: null,
      supportEmail: null,
      description: null,
      bookingLeadMinutes: null,
      maxPartySize: null,
      minPartySize: null,
      defaultTurnTimeMinutes: null,
      createdAt: null,
      updatedAt: null,
    } as RestaurantProfile;

    const verification = deriveProfileVerification({ profile, connection });
    const report = buildDriftReport({ profile, connection, verification });

    expect(report.totals.drift).toBeGreaterThanOrEqual(3);
    expect(report.warnings).toEqual(expect.arrayContaining(['Warning A', 'Warning B', 'Warning C']));
    expect(report.hasAnyData).toBe(true);
  });
});
