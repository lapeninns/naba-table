import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { GoogleBusinessProfileSection } from '@/components/features/restaurant-settings/google-business-profile/GoogleBusinessProfileSection';
import { deriveProfileVerification } from '@/components/features/restaurant-settings/google-business-profile/googleBusinessProfileVerification';
import { buildDriftReport } from '@/components/features/restaurant-settings/google-business-profile/lib/drift';

import type {
  GoogleBusinessProfileConnection,
  GoogleBusinessProfileWorkflow,
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

const workflowResult = {
  data: {
    latestDraft: null,
    sectionSummaries: [],
    publishableSections: [],
    blockedReasons: [],
    auditEvents: [],
    activePublishJob: null,
  } as GoogleBusinessProfileWorkflow,
  isLoading: false,
  error: null as Error | null,
  refetch: vi.fn(),
};

const updateDraftMutation = {
  mutate: vi.fn(),
  mutateAsync: vi.fn(),
  isPending: false,
  error: null,
};

const publishMutation = {
  mutate: vi.fn(),
  mutateAsync: vi.fn(),
  isPending: false,
  error: null,
};

const preflightMutation = {
  mutate: vi.fn(),
  mutateAsync: vi.fn(),
  reset: vi.fn(),
  isPending: false,
  error: null as Error | null,
};

const retryMutation = {
  mutate: vi.fn(),
  mutateAsync: vi.fn(),
  isPending: false,
  error: null,
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
  useOpsCreateGoogleBusinessProfileDraft: () => ({
    mutate: vi.fn(),
    isPending: false,
    error: null,
  }),
  useOpsGoogleBusinessProfileWorkflow: () => workflowResult,
  useOpsUpdateGoogleBusinessProfileDraft: () => updateDraftMutation,
  useOpsPublishGoogleBusinessProfileDraft: () => publishMutation,
  useOpsPreflightGoogleBusinessProfileDraftPublish: () => preflightMutation,
  useOpsRetryGoogleBusinessProfileDraftGooglePush: () => retryMutation,
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

function emptyWorkflow(): GoogleBusinessProfileWorkflow {
  return {
    latestDraft: null,
    sectionSummaries: [],
    publishableSections: [],
    blockedReasons: [],
    auditEvents: [],
    activePublishJob: null,
  };
}

beforeEach(() => {
  connectionResult.data = undefined;
  connectionResult.error = null;
  connectionResult.isLoading = false;
  connectionResult.isFetching = false;
  profileResult.data = undefined;
  profileResult.error = null;
  workflowResult.data = emptyWorkflow();
  updateDraftMutation.mutate.mockReset();
  updateDraftMutation.mutateAsync.mockReset();
  publishMutation.mutate.mockReset();
  publishMutation.mutateAsync.mockReset();
  preflightMutation.mutate.mockReset();
  preflightMutation.mutateAsync.mockReset();
  preflightMutation.reset.mockReset();
  preflightMutation.error = null;
  retryMutation.mutate.mockReset();
  retryMutation.mutateAsync.mockReset();
});

describe('GoogleBusinessProfileSection', () => {
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

  it('renders the Google profile changes workspace and secondary analysis when linked', () => {
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
    workflowResult.data = {
      latestDraft: {
        id: 'draft-1',
        status: 'review_ready',
        fetchedAt: '2026-04-25T10:00:00.000Z',
        approvedAt: null,
        publishedAt: null,
        staleSections: [],
        conflictMetadata: {},
        selectedApprovals: { 'profile.name': true },
        sourceSnapshotRefs: {},
        coreSnapshotHashes: {},
        createdAt: '2026-04-25T10:00:00.000Z',
        updatedAt: '2026-04-25T10:00:00.000Z',
        sectionDiffs: [
          {
            sectionKey: 'profile',
            label: 'Profile',
            status: 'ready',
            summary: '1 change ready',
            canPublishToNabatable: true,
            canPushToGoogle: true,
            blockedReasons: [],
            items: [
              {
                fieldKey: 'profile.name',
                label: 'Business name',
                sectionKey: 'profile',
                currentValue: 'Old',
                providerValue: 'New',
                proposedValue: 'New',
                direction: 'pull_from_gbp',
                status: 'ready',
                selected: true,
                canPublishToNabatable: true,
                canPushToGoogle: true,
                warnings: [],
              },
            ],
          },
        ],
      },
      sectionSummaries: [],
      publishableSections: ['profile'],
      blockedReasons: [],
      auditEvents: [],
      activePublishJob: null,
    };

    render(<GoogleBusinessProfileSection restaurantId="rest-1" />);

    expect(screen.getByText(/google profile changes/i)).toBeInTheDocument();
    expect(screen.getByTestId('gbp-direction-tab-google_to_nabatable')).toBeInTheDocument();
    expect(screen.getByTestId('gbp-direction-tab-nabatable_to_google')).toBeInTheDocument();
    expect(screen.getByText(/change groups/i)).toBeInTheDocument();
    expect(screen.getByText('Business name')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /review selected changes \(1\)/i })).toBeEnabled();
    expect(screen.getByTestId('gbp-secondary-analysis')).toBeInTheDocument();
  });

  it('lets ops move a field into the push direction and exposes retry state for failed google pushes', async () => {
    const user = userEvent.setup();

    connectionResult.data = buildConnection({
      status: 'linked',
      externalLocationId: 'l-1',
      externalLocationTitle: 'Nabatable Main',
    });
    workflowResult.data = {
      latestDraft: {
        id: 'draft-2',
        status: 'approved',
        fetchedAt: '2026-04-25T10:00:00.000Z',
        approvedAt: '2026-04-25T10:05:00.000Z',
        publishedAt: null,
        staleSections: [],
        conflictMetadata: {},
        selectedApprovals: {},
        sourceSnapshotRefs: {},
        coreSnapshotHashes: {},
        createdAt: '2026-04-25T10:00:00.000Z',
        updatedAt: '2026-04-25T10:05:00.000Z',
        sectionDiffs: [
          {
            sectionKey: 'profile',
            label: 'Profile',
            status: 'ready',
            summary: '1 change ready',
            canPublishToNabatable: true,
            canPushToGoogle: true,
            blockedReasons: [],
            items: [
              {
                fieldKey: 'profile.contactPhone',
                label: 'Primary phone',
                sectionKey: 'profile',
                currentValue: '+44 20 9999 0000',
                providerValue: '+44 20 1234 5678',
                proposedValue: '+44 20 1234 5678',
                direction: 'pull_from_gbp',
                status: 'ready',
                selected: false,
                canPublishToNabatable: true,
                canPushToGoogle: true,
                warnings: [],
              },
            ],
          },
        ],
      },
      sectionSummaries: [],
      publishableSections: ['profile'],
      blockedReasons: [],
      auditEvents: [],
      activePublishJob: {
        id: 'job-1',
        draftId: 'draft-2',
        idempotencyKey: 'idem-1',
        mode: 'google_only',
        directionIntent: 'nabatable_to_google',
        status: 'google_failed',
        selectedApprovals: { 'profile.contactPhone': true },
        nabatableSections: ['profile'],
        googleUpdateMasks: ['phoneNumbers'],
        postNabatableCoreHashes: {},
        errorClassification: 'permission',
        errors: [{ message: 'Permission denied' }],
        nabatableEventId: 'event-1',
        googleEventId: 'event-2',
        canRetryGooglePush: true,
        retryBlockedReason: null,
        createdAt: '2026-04-25T10:00:00.000Z',
        updatedAt: '2026-04-25T10:06:00.000Z',
      },
    };

    render(<GoogleBusinessProfileSection restaurantId="rest-1" />);

    const pushTab = screen.getByTestId('gbp-direction-tab-nabatable_to_google');
    expect(pushTab).toBeInTheDocument();
    await user.click(pushTab);

    expect(screen.getByRole('button', { name: /review selected changes \(0\)/i })).toBeDisabled();
    await user.click(screen.getByRole('button', { name: /send to google/i }));
    expect(screen.getByRole('button', { name: /review selected changes \(1\)/i })).toBeEnabled();
    expect(screen.getByTestId('gbp-retry-google-push-button')).toBeInTheDocument();
  });

  it('shows a refresh-required state when the workflow draft is stale', () => {
    connectionResult.data = buildConnection({
      status: 'linked',
      externalLocationId: 'l-1',
      externalLocationTitle: 'Nabatable Main',
    });
    workflowResult.data = {
      latestDraft: {
        id: 'draft-stale',
        status: 'stale',
        fetchedAt: '2026-04-25T10:00:00.000Z',
        approvedAt: '2026-04-25T10:05:00.000Z',
        publishedAt: null,
        staleSections: ['profile'],
        conflictMetadata: {
          staleFieldKeys: ['profile.name'],
        },
        selectedApprovals: { 'profile.name': true },
        sourceSnapshotRefs: {},
        coreSnapshotHashes: {},
        createdAt: '2026-04-25T10:00:00.000Z',
        updatedAt: '2026-04-25T10:05:00.000Z',
        sectionDiffs: [
          {
            sectionKey: 'profile',
            label: 'Profile',
            status: 'stale',
            summary: 'Refresh required',
            canPublishToNabatable: false,
            canPushToGoogle: true,
            blockedReasons: [
              'Restaurant details changed after this review was created. Check for changes again before applying this section.',
            ],
            items: [
              {
                fieldKey: 'profile.name',
                label: 'Business name',
                sectionKey: 'profile',
                currentValue: 'Old',
                providerValue: 'New',
                proposedValue: 'New',
                direction: 'pull_from_gbp',
                status: 'ready',
                selected: true,
                canPublishToNabatable: true,
                canPushToGoogle: true,
                warnings: [],
              },
            ],
          },
        ],
      },
      sectionSummaries: [],
      publishableSections: [],
      blockedReasons: [
        'Some profile sections changed since review. Check for changes again before applying.',
      ],
      auditEvents: [],
      activePublishJob: null,
    };

    render(<GoogleBusinessProfileSection restaurantId="rest-1" />);

    expect(screen.getAllByText(/check for changes again/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/changed fields: profile.name/i)).toBeInTheDocument();
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
