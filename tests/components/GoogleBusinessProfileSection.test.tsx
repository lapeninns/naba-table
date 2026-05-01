import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  countsFor,
  servicePeriodsDayCounts,
  tabTone,
  worstDriftStatus,
} from '@/components/features/restaurant-settings/google-business-profile/components/alignmentModel';
import { LinkedSummaryCard } from '@/components/features/restaurant-settings/google-business-profile/components/LinkedSummaryCard';
import {
  formatCoordinate,
  formatDisplayUrl,
  getLinkLabel,
  getPhoneLabel,
} from '@/components/features/restaurant-settings/google-business-profile/components/snapshotModel';
import {
  buildGoogleMapsPlaceHref,
  buildLocationValue,
} from '@/components/features/restaurant-settings/google-business-profile/googleBusinessProfileConnectionModel';
import { GoogleBusinessProfileSection } from '@/components/features/restaurant-settings/google-business-profile/GoogleBusinessProfileSection';
import { deriveProfileVerification } from '@/components/features/restaurant-settings/google-business-profile/googleBusinessProfileVerification';
import { buildDriftReport } from '@/components/features/restaurant-settings/google-business-profile/lib/drift';

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

beforeEach(() => {
  connectionResult.data = undefined;
  connectionResult.error = null;
  connectionResult.isLoading = false;
  connectionResult.isFetching = false;
  profileResult.data = undefined;
  profileResult.error = null;
  connectionResult.refetch.mockReset();
});

describe('GoogleBusinessProfileSection', () => {
  it('renders a switcher hint when no restaurant is selected', () => {
    render(<GoogleBusinessProfileSection restaurantId={null} />);

    expect(screen.getByText(/select a restaurant using the sidebar switcher/i)).toBeInTheDocument();
  });

  it('renders the connect card when the status is unlinked', () => {
    connectionResult.data = buildConnection({ status: 'unlinked' });
    render(<GoogleBusinessProfileSection restaurantId="rest-1" />);

    expect(
      screen.getByRole('heading', { level: 1, name: /google business profile/i }),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /connect google/i })).toBeInTheDocument();
    expect(screen.queryByText(/choose a business profile location/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/google profile changes/i)).not.toBeInTheDocument();
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

  it('renders secondary analysis when linked and does not render the retired V2 workspace', () => {
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

    expect(screen.getByTestId('gbp-secondary-analysis')).toBeInTheDocument();
    expect(screen.getByText(/secondary analysis/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /generate review draft/i })).toBeInTheDocument();
    expect(screen.getByText(/google snapshot/i)).toBeInTheDocument();
    expect(screen.queryByText(/google profile changes/i)).not.toBeInTheDocument();
  });

  it('renders an error card when the connection query fails', () => {
    connectionResult.error = new Error('boom');

    render(<GoogleBusinessProfileSection restaurantId="rest-1" />);

    expect(screen.getByText(/unable to load google business profile/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
  });
});

describe('LinkedSummaryCard', () => {
  it('uses the compact action bar and disclosure for linked profile actions', async () => {
    const user = userEvent.setup();

    render(
      <LinkedSummaryCard
        data={buildConnection({
          status: 'linked',
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
            {
              accountName: 'accounts/1',
              accountId: 'a-1',
              accountDisplayName: 'Ops Account',
              locationName: 'locations/2',
              locationId: 'l-2',
              title: 'Second Location',
              addressText: '2 Test St, London',
              placeId: 'place-2',
            },
          ],
        })}
        manageOnGoogleHref="https://maps.google.com/?cid=demo"
        onGenerateDraft={vi.fn()}
        onChangeLocation={vi.fn()}
        isGeneratingDraft={false}
      />,
    );

    expect(
      screen.getByRole('button', { name: /generate review draft/i }).parentElement,
    ).toHaveClass('rounded-md', 'bg-muted/30');
    expect(screen.queryByRole('link', { name: /view on google maps/i })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /more google actions/i }));
    expect(screen.getByRole('link', { name: /view on google maps/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /change location/i })).toBeInTheDocument();
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
      slug: 'nabatable-main',
      timezone: 'Europe/London',
      capacity: null,
      contactEmail: null,
      contactPhone: '+44 20 9999 0000',
      address: '1 Test St',
      businessDescription: null,
      managerDailySummaryEnabled: false,
      managerNotificationPhone: null,
      googleMapUrl: null,
      googleReviewUrl: null,
      bookingPolicy: null,
      logoUrl: null,
      emailSendReminder24h: true,
      emailSendReminderShort: true,
      emailSendReviewRequest: true,
      reservationIntervalMinutes: 15,
      reservationDefaultDurationMinutes: 90,
      reservationLastSeatingBufferMinutes: 15,
      reservationLifecycleGraceMinutes: 15,
      updatedAt: null,
    };

    const verification = deriveProfileVerification({ profile, connection });
    const report = buildDriftReport({ profile, connection, verification });

    expect(report.totals.drift).toBeGreaterThanOrEqual(3);
    expect(report.warnings).toEqual(
      expect.arrayContaining(['Warning A', 'Warning B', 'Warning C']),
    );
    expect(report.hasAnyData).toBe(true);
  });
});

describe('GBP alignment model', () => {
  it('counts row states and resolves tab tone by severity', () => {
    const counts = countsFor([
      {
        id: 'one',
        label: 'One',
        googleValue: 'A',
        nabatableValue: 'B',
        status: 'verified',
      },
      {
        id: 'two',
        label: 'Two',
        googleValue: 'A',
        nabatableValue: 'B',
        status: 'partial',
      },
      {
        id: 'three',
        label: 'Three',
        googleValue: 'A',
        nabatableValue: 'B',
        status: 'drift',
      },
    ]);

    expect(counts).toEqual({ drift: 1, partial: 1, verified: 1, unavailable: 0 });
    expect(tabTone(counts)).toBe('drift');
    expect(tabTone({ drift: 0, partial: 0, verified: 1, unavailable: 6 })).toBe('verified');
    expect(tabTone({ drift: 0, partial: 0, verified: 0, unavailable: 7 })).toBe('muted');
  });

  it('summarizes service-period day drift using lunch and dinner severity', () => {
    expect(worstDriftStatus('verified', 'drift')).toBe('drift');
    expect(
      servicePeriodsDayCounts([
        {
          bookingOption: 'lunch',
          name: 'Lunch',
          dayOfWeek: 1,
          startTime: '12:00',
          endTime: '15:00',
          matchesCore: true,
        },
        {
          bookingOption: 'dinner',
          name: 'Dinner',
          dayOfWeek: 1,
          startTime: '17:00',
          endTime: '22:00',
          matchesCore: false,
        },
      ]),
    ).toEqual({ drift: 1, partial: 0, verified: 0, unavailable: 6 });
  });
});

describe('GBP snapshot model', () => {
  it('formats coordinates and display URLs for compact snapshot rows', () => {
    expect(formatCoordinate(51.501364)).toBe('51.501364');
    expect(formatCoordinate(null)).toBeNull();
    expect(formatDisplayUrl('https://example.com/path/?a=1')).toBe('example.com/path/?a=1');
    expect(formatDisplayUrl('not a url')).toBe('not a url');
  });

  it('resolves public labels while preserving explicit Google labels', () => {
    expect(getPhoneLabel('primary')).toBe('Primary');
    expect(getPhoneLabel('fax')).toBe('fax');
    expect(getLinkLabel('website', null)).toBe('Website');
    expect(getLinkLabel('website', 'Bookings')).toBe('Bookings');
    expect(getLinkLabel('booking', null)).toBe('booking');
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
