import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { RestaurantGoogleBusinessProfileSection } from '@/components/features/restaurant-settings/RestaurantGoogleBusinessProfileSection';

import type { RestaurantGoogleBusinessProfileConnection } from '@/lib/restaurants/google-business-profile';

const {
  searchParamsMock,
  useStatusMock,
  useConnectMock,
  useRefreshMock,
  useSyncMock,
  useDisconnectMock,
} = vi.hoisted(() => ({
  searchParamsMock: vi.fn(() => new URLSearchParams()),
  useStatusMock: vi.fn(),
  useConnectMock: vi.fn(),
  useRefreshMock: vi.fn(),
  useSyncMock: vi.fn(),
  useDisconnectMock: vi.fn(),
}));

vi.mock('next/navigation', async () => {
  const actual = await vi.importActual('next/navigation');
  return {
    ...actual,
    useSearchParams: () => searchParamsMock(),
  };
});

vi.mock('@src/hooks/ops/useOpsRestaurantGoogleBusinessProfile', () => ({
  useOpsRestaurantGoogleBusinessProfile: useStatusMock,
  useOpsRestaurantGoogleBusinessProfileConnect: useConnectMock,
  useOpsRefreshRestaurantGoogleBusinessProfileCatalog: useRefreshMock,
  useOpsSyncRestaurantGoogleBusinessProfile: useSyncMock,
  useOpsDisconnectRestaurantGoogleBusinessProfile: useDisconnectMock,
}));

function createConnection(
  overrides: Partial<RestaurantGoogleBusinessProfileConnection> = {},
): RestaurantGoogleBusinessProfileConnection {
  return {
    connected: false,
    status: 'disconnected',
    accountId: null,
    accountName: null,
    locationId: null,
    locationName: null,
    locationTitle: null,
    availableLocations: [],
    oauthConnectedAt: null,
    lastSyncAt: null,
    lastSyncStatus: null,
    lastSyncError: null,
    normalizedProfile: null,
    latestChangeSummary: null,
    syncFamilies: [],
    syncHistory: [],
    ...overrides,
  };
}

describe('RestaurantGoogleBusinessProfileSection', () => {
  beforeEach(() => {
    searchParamsMock.mockReturnValue(new URLSearchParams());
    useConnectMock.mockReturnValue({ isPending: false, mutateAsync: vi.fn() });
    useRefreshMock.mockReturnValue({ isPending: false, mutate: vi.fn() });
    useSyncMock.mockReturnValue({ isPending: false, mutateAsync: vi.fn() });
    useDisconnectMock.mockReturnValue({ isPending: false, mutateAsync: vi.fn() });
  });

  it('renders the disconnected workspace state on the dedicated page', () => {
    useStatusMock.mockReturnValue({
      data: createConnection(),
      isLoading: false,
      error: null,
    });

    render(<RestaurantGoogleBusinessProfileSection restaurantId="rest-1" />);

    expect(screen.getByText('Google Business Profile')).toBeInTheDocument();
    expect(screen.getByText(/no google business profile is connected yet/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Connect Google' })).toBeInTheDocument();
    expect(screen.getByText(/no sync run has completed yet/i)).toBeInTheDocument();
  });

  it('renders partial-sync diagnostics and imported data details', () => {
    useStatusMock.mockReturnValue({
      data: createConnection({
        connected: true,
        status: 'partial',
        accountId: 'acct-1',
        accountName: 'Lapen Inns',
        locationId: 'loc-1',
        locationName: 'locations/loc-1',
        locationTitle: 'The Old Crown Girton',
        oauthConnectedAt: '2026-04-08T08:00:00Z',
        lastSyncAt: '2026-04-08T09:00:00Z',
        lastSyncStatus: 'success',
        lastSyncError: 'Partial sync completed. Performance: Request contains an invalid argument.',
        availableLocations: [
          {
            accountId: 'acct-1',
            accountName: 'Lapen Inns',
            locationId: 'loc-1',
            locationName: 'locations/loc-1',
            title: 'The Old Crown Girton',
            addressText: '89 High St, Girton, Cambridge CB3 0QD',
            primaryPhone: '01223 277217',
            websiteUri: 'https://www.oldcrowngirton.example',
            mapsUri: 'https://maps.google.com/?cid=old-crown',
            reviewUri: 'https://g.page/r/old-crown/review',
            matchScore: 8,
          },
        ],
        normalizedProfile: {
          title: 'The Old Crown Girton',
          description: 'Historic village pub with a large garden and Nepalese favourites.',
          primaryCategory: 'Pub',
          additionalCategories: ['Nepalese restaurant', 'Beer garden'],
          addressText: '89 High St, Girton, Cambridge CB3 0QD',
          locality: 'Girton',
          regionCode: 'GB',
          postalCode: 'CB3 0QD',
          placeId: 'ChIJ-old-crown-girton',
          openStatus: 'OPEN',
          primaryPhone: '01223 277217',
          additionalPhones: [],
          websiteUri: 'https://www.oldcrowngirton.example',
          mapsUri: 'https://maps.google.com/?cid=old-crown',
          reviewUri: 'https://g.page/r/old-crown/review',
          regularHoursSummary: ['MONDAY 12:00 - MONDAY 22:00'],
          moreHoursSummary: ['Delivery Hours: MONDAY 11:00 - MONDAY 21:00'],
          specialHoursSummary: [],
          attributeLabels: ['Outdoor seating: Yes'],
          serviceItems: ['Delivery', 'Takeout'],
          rating: 4.5,
          reviewCount: 412,
          reviewSnippets: [
            {
              reviewId: 'review-1',
              starRating: 'FIVE',
              comment: 'Fantastic garden for families.',
              reviewerDisplayName: 'Alex P',
              createTime: '2026-04-01T10:00:00Z',
              updateTime: '2026-04-01T10:00:00Z',
            },
          ],
          media: [
            {
              name: 'media-1',
              category: 'EXTERIOR',
              format: 'PHOTO',
              sourceUrl: null,
              googleUrl: 'https://example.com/media-1',
              thumbnailUrl: 'https://example.com/media-1-thumb',
              description: 'Front garden and pub exterior',
            },
          ],
          metrics30d: [
            {
              metric: 'WEBSITE_CLICKS',
              total: 84,
              startDate: '2026-03-08',
              endDate: '2026-04-06',
            },
            {
              metric: 'BUSINESS_IMPRESSIONS_MOBILE_SEARCH',
              total: 242,
              startDate: '2026-03-08',
              endDate: '2026-04-06',
            },
          ],
        },
        latestChangeSummary: {
          generatedAt: '2026-04-08T09:00:00Z',
          hasBaseline: true,
          totalChanges: 3,
          remainingChanges: 0,
          highlights: [
            {
              key: 'serviceItems',
              label: 'Service items',
              family: 'attributes',
              kind: 'updated',
              before: 'Takeout',
              after: 'Delivery | Takeout',
            },
            {
              key: 'reviewCount',
              label: 'Review count',
              family: 'reviews',
              kind: 'updated',
              before: '398',
              after: '412',
            },
            {
              key: 'metric:BUSINESS_IMPRESSIONS_MOBILE_SEARCH',
              label: 'Business Impressions Mobile Search',
              family: 'performance',
              kind: 'added',
              before: null,
              after: '242 (2026-03-08 to 2026-04-06)',
            },
          ],
        },
        syncFamilies: [
          {
            key: 'location',
            label: 'Location details',
            status: 'success',
            error: null,
            updatedAt: '2026-04-08T09:00:00Z',
          },
          {
            key: 'performance',
            label: 'Performance',
            status: 'failed',
            error: 'Request contains an invalid argument.',
            updatedAt: '2026-04-08T09:00:00Z',
          },
        ],
        syncHistory: [
          {
            id: 'sync-2',
            trigger: 'manual',
            accountId: 'acct-1',
            accountName: 'Lapen Inns',
            locationId: 'loc-1',
            locationName: 'locations/loc-1',
            locationTitle: 'The Old Crown Girton',
            startedAt: '2026-04-08T08:58:00Z',
            completedAt: '2026-04-08T09:00:00Z',
            status: 'partial',
            error: 'Partial sync completed. Performance: Request contains an invalid argument.',
            syncFamilies: [
              {
                key: 'location',
                label: 'Location details',
                status: 'success',
                error: null,
                updatedAt: '2026-04-08T09:00:00Z',
              },
              {
                key: 'performance',
                label: 'Performance',
                status: 'failed',
                error: 'Request contains an invalid argument.',
                updatedAt: '2026-04-08T09:00:00Z',
              },
            ],
          },
        ],
      }),
      isLoading: false,
      error: null,
    });

    render(<RestaurantGoogleBusinessProfileSection restaurantId="rest-1" />);

    expect(screen.getByText('Partial sync completed')).toBeInTheDocument();
    expect(screen.getAllByText(/request contains an invalid argument/i).length).toBeGreaterThan(0);
    expect(screen.getByText('Place ID')).toBeInTheDocument();
    expect(screen.getByText('ChIJ-old-crown-girton')).toBeInTheDocument();
    expect(screen.getByText('Performance')).toBeInTheDocument();
    expect(screen.getByText('Front garden and pub exterior')).toBeInTheDocument();
    expect(screen.getAllByText('Service items').length).toBeGreaterThan(0);
    expect(screen.getByText('Delivery')).toBeInTheDocument();
    expect(screen.getAllByText(/Business Impressions Mobile Search/i).length).toBeGreaterThan(0);
    expect(screen.getByText('What changed since last sync')).toBeInTheDocument();
    expect(screen.getByText('3 changes detected')).toBeInTheDocument();
    expect(screen.getAllByText('Previous').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Latest').length).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: 'Sync Google data' })).toBeInTheDocument();
    expect(screen.getByText('Recent sync history')).toBeInTheDocument();
    expect(screen.getAllByText(/location details: success/i).length).toBeGreaterThan(0);
  });
});
