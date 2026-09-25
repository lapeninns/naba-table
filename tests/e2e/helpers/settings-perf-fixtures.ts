import type { Page, Route } from '@playwright/test';

/**
 * Read-only `/api/ops/**` fixtures for the opt-in settings performance spec. Shapes mirror the
 * existing settings browser specs and the dev `DevRestaurantState` fixtures. The GBP connection
 * is linked to a location so the dual-sync drift query runs. Every non-GET request gets 403.
 */
export const perfRestaurantId = '11111111-1111-4111-8111-111111111111';

const restaurant = {
  id: perfRestaurantId,
  name: 'QA Perf Restaurant',
  slug: 'qa-perf',
  isActive: true,
  timezone: 'Europe/London',
  capacity: 90,
  contactEmail: 'qa.perf@example.test',
  contactPhone: '+440000000000',
  address: '1 QA Street, Test Town',
  businessDescription: 'Local QA fixture restaurant for settings performance measurement.',
  managerDailySummaryEnabled: true,
  managerWhatsappEnabled: false,
  managerName: 'QA',
  managerNotificationPhone: '+440000000001',
  googleMapUrl: null,
  googleReviewUrl: null,
  bookingPolicy: 'QA browser fixtures only.',
  logoUrl: null,
  emailSendReminder24h: true,
  emailSendReminderShort: true,
  emailSendReviewRequest: true,
  reservationIntervalMinutes: 15,
  reservationDefaultDurationMinutes: 90,
  reservationLastSeatingBufferMinutes: 15,
  reservationLifecycleGraceMinutes: 15,
  createdAt: '2026-05-16T00:00:00.000Z',
  updatedAt: '2026-05-16T00:00:00.000Z',
  role: 'owner',
};

// DevRestaurantState fixtures (src/app/(public)/dev/_mocks/services/devRestaurantState.ts).
const operatingHours = {
  restaurantId: perfRestaurantId,
  timezone: 'Europe/London',
  weekly: [
    { dayOfWeek: 0, opensAt: '12:00', closesAt: '22:00', isClosed: false, notes: null },
    { dayOfWeek: 1, opensAt: '12:00', closesAt: '22:00', isClosed: false, notes: null },
    { dayOfWeek: 2, opensAt: '12:00', closesAt: '22:00', isClosed: false, notes: null },
    { dayOfWeek: 3, opensAt: '12:00', closesAt: '22:00', isClosed: false, notes: null },
    { dayOfWeek: 4, opensAt: '12:00', closesAt: '23:00', isClosed: false, notes: null },
    { dayOfWeek: 5, opensAt: '11:30', closesAt: '23:00', isClosed: false, notes: null },
    { dayOfWeek: 6, opensAt: '11:30', closesAt: '21:30', isClosed: false, notes: null },
  ],
  overrides: [
    {
      id: 'override-1',
      effectiveDate: '2026-02-14',
      opensAt: '12:00',
      closesAt: '23:30',
      isClosed: false,
      notes: 'Valentine’s Day extended service',
    },
  ],
};

const servicePeriods = [
  {
    id: 'sp-1',
    name: 'Lunch',
    dayOfWeek: null,
    startTime: '12:00',
    endTime: '15:00',
    bookingOption: 'dining',
  },
  {
    id: 'sp-2',
    name: 'Dinner',
    dayOfWeek: null,
    startTime: '17:00',
    endTime: '22:00',
    bookingOption: 'dining',
  },
];

const turnBandsPayload = {
  default: [
    { maxPartySize: 2, durationMinutes: 75 },
    { maxPartySize: 4, durationMinutes: 90 },
    { maxPartySize: 6, durationMinutes: 105 },
    { maxPartySize: 8, durationMinutes: 120 },
  ],
};

const occasions = [
  {
    key: 'dining',
    label: 'Dining',
    shortLabel: 'Dining',
    description: 'Table bookings',
    sortOrder: 1,
    defaultStartTime: '12:00',
    defaultEndTime: '22:00',
    isActive: true,
  },
];

const STAMP = '2026-05-16T09:00:00.000Z';
const REAL_AMENITY_KEYS = [
  'has_wheelchair_accessible_entrance',
  'has_wheelchair_accessible_restroom',
  'has_wheelchair_accessible_parking',
  'has_restroom',
  'reservations',
  'delivery',
  'takeout',
];

/** Large discovery fixture: 40 categories, 60 amenities/attributes, 20 service areas. */
export function buildLargeBusinessContextFamily() {
  const categories = Array.from({ length: 40 }, (_, index) => ({
    id: `perf-category-${index}`,
    displayName: `Perf category ${index + 1}`,
    categoryCode: `gcid:perf_category_${index + 1}`,
    moreHoursTypes: [],
    isPrimary: index === 0,
    source: 'core',
    managedBy: 'nabatable',
    updatedAt: STAMP,
  }));
  const attributes = Array.from({ length: 60 }, (_, index) => {
    const key = REAL_AMENITY_KEYS[index] ?? `perf_amenity_${index + 1}`;
    return {
      id: `perf-attribute-${index}`,
      attributeGroup: index < REAL_AMENITY_KEYS.length ? 'amenities' : 'perf',
      attributeKey: key,
      attributeName: `attributes/${key}`,
      attributeId: key,
      displayName: `Perf amenity ${index + 1}`,
      displayText: null,
      displayTextStandalone: null,
      displayTextNegative: null,
      valueType: 'BOOL',
      boolValue: index % 3 !== 0,
      textValue: null,
      uriValue: null,
      uriValues: [],
      enumValues: [],
      unsetEnumValues: [],
      rawValue: null,
      rawEnumValues: null,
      displayValue: null,
      valueMetadata: [],
      source: 'core',
      managedBy: 'nabatable',
      updatedAt: STAMP,
    };
  });
  const serviceAreas = Array.from({ length: 20 }, (_, index) => ({
    id: `perf-area-${index}`,
    displayName: `Perf Town ${index + 1}, UK`,
    areaType: 'place',
    regionCode: 'GB',
    googlePlaceId: `perf-place-${index + 1}`,
    googlePlaceResourceName: null,
    placeData: null,
    source: 'core',
    managedBy: 'nabatable',
    updatedAt: STAMP,
  }));

  return {
    businessDetails: {
      id: 'perf-business-details',
      openingDate: null,
      businessStatus: 'OPEN',
      isServiceAreaBusiness: true,
      source: 'core',
      managedBy: 'nabatable',
      updatedAt: STAMP,
    },
    links: [],
    categories,
    serviceAreas,
    attributes,
    serviceItems: [],
  };
}

const businessInfo = {
  details: {
    businessName: 'QA Perf Restaurant',
    description: 'Fixture listing description',
    languageCode: 'en',
    openingDate: null,
    businessStatus: 'OPEN',
    isServiceAreaBusiness: false,
    canReopen: null,
    source: 'gbp',
    managedBy: 'gbp',
    lastSyncedAt: STAMP,
  },
  addresses: [],
  phoneNumbers: [],
  links: [],
  categories: [],
  serviceAreas: [],
  hours: [],
  specialHours: [],
  attributes: [],
  serviceItems: [],
};

const linkedGbpConnection = {
  isConfigured: true,
  provider: 'google_business_profile',
  status: 'linked',
  pushEnabled: false,
  connectedGoogleEmail: 'ops@example.test',
  connectedGoogleName: 'QA Ops',
  externalAccountId: 'account-1',
  externalAccountName: 'accounts/1',
  externalLocationId: 'location-1',
  externalLocationName: 'locations/1',
  externalLocationTitle: 'QA Perf Restaurant',
  externalPlaceId: 'places/qa-perf',
  providerTimezone: 'Europe/London',
  lastPullAt: STAMP,
  lastPushAt: null,
  lastError: null,
  availableLocations: [],
  businessInfo,
};

const dualSyncState = {
  restaurantId: perfRestaurantId,
  coreSnapshot: {},
  gbpSnapshot: {},
  coreSnapshotHash: 'qa-core-hash',
  gbpSnapshotHash: 'qa-gbp-hash',
  fields: [],
  outboundQueue: { totalOpen: 0, autoExportable: 0, missingBaseline: 0, lastQueuedAt: null },
  lastSnapshot: null,
  control: null,
};

export async function installPerfApiMocks(page: Page): Promise<void> {
  const base = `/api/ops/restaurants/${perfRestaurantId}`;
  const businessContext = buildLargeBusinessContextFamily();

  await page.route('**/api/ops/**', async (route: Route) => {
    const request = route.request();
    if (request.method() !== 'GET') {
      await route.fulfill({ status: 403, json: { error: 'read_only_perf_fixture' } });
      return;
    }

    const pathname = new URL(request.url()).pathname;
    const json = ((): unknown => {
      switch (pathname) {
        case '/api/ops/restaurants':
          return {
            items: [restaurant],
            pageInfo: { hasNext: false, page: 1, pageSize: 50, total: 1 },
          };
        case base:
          return { restaurant };
        case `${base}/business-context`:
          return { core: businessContext, providerSnapshot: businessContext };
        case `${base}/hours`:
          return operatingHours;
        case `${base}/service-periods`:
          return { restaurantId: perfRestaurantId, periods: servicePeriods };
        case `${base}/turn-bands`:
          return {
            restaurantId: perfRestaurantId,
            bands: turnBandsPayload,
            defaults: turnBandsPayload,
          };
        case '/api/ops/occasions':
          return { occasions };
        case `${base}/menus`:
          return { menus: [] };
        case '/api/ops/team/invitations':
          return { invites: [] };
        case '/api/ops/tables':
          return { tables: [], summary: null };
        case `${base}/google-business-profile`:
        case `${base}/google-business-profile/details`:
          return linkedGbpConnection;
        case `${base}/dual-sync/state`:
          return dualSyncState;
        default:
          return {};
      }
    })();

    await route.fulfill({ json });
  });
}
