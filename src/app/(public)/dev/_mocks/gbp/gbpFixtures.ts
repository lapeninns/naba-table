/**
 * Google Business Profile scenarios for the dev harness. Fictional values in the real API
 * shapes. The V1 contracts (operator state, notices, exact preview, publish) use branded types
 * that only their parsers create, so those are plain JSON here: the harness serves them over
 * `fetch` and the app's own client parses them, exactly as in production.
 */

import { DEV_RESTAURANT_ID } from '../devIds';

import type { DualSyncFieldState, DualSyncSectionKey } from '@/server/dual-sync';
import type { DualSyncFieldSummary, GetDualSyncStateResponse } from '@/services/ops/dual-sync';
import type {
  GoogleBusinessProfileAvailableLocation,
  GoogleBusinessProfileConnection,
} from '@/services/ops/restaurants';

export const GBP_SCENARIOS = {
  linked: 'Linked, differences to review',
  failstop: 'Publishing stopped: unknown Google updates',
  reauth: 'Reconnect needed',
  rollout: 'Writes not enabled (rollout off)',
  paused: 'Sync paused',
  opsdown: 'Write controls unavailable',
  insync: 'Linked, everything matches',
  authorized: 'Signed in, choose a listing',
  pending: 'Waiting for Google consent',
  unlinked: 'Not connected',
  unconfigured: 'Not set up for this workspace',
} as const;

export type GbpScenario = keyof typeof GBP_SCENARIOS;

export function isGbpScenario(value: string | null | undefined): value is GbpScenario {
  return Boolean(value && value in GBP_SCENARIOS);
}

const id = DEV_RESTAURANT_ID;
const CHECKED_AT = '2026-09-26T12:58:00.000Z';

export const GBP_LOCATIONS: GoogleBusinessProfileAvailableLocation[] = [
  {
    accountName: 'accounts/1098823004417',
    accountId: '1098823004417',
    accountDisplayName: 'Lapen Inns',
    locationName: 'locations/4412098837161',
    locationId: '4412098837161',
    title: 'The White Horse',
    addressText: '12 Example Road, Sampleton AB1 2CD',
    placeId: 'places/white-horse',
  },
  {
    accountName: 'accounts/1098823004417',
    accountId: '1098823004417',
    accountDisplayName: 'Lapen Inns',
    locationName: 'locations/4412098837990',
    locationId: '4412098837990',
    title: 'The White Horse (old listing)',
    addressText: '12 Example Road, Sampleton AB1 2CD · marked closed on Google',
    placeId: 'places/white-horse-old',
  },
];

const businessInfo: GoogleBusinessProfileConnection['businessInfo'] = {
  details: {
    businessName: 'The White Horse',
    description: 'A traditional village pub serving food and real ales.',
    languageCode: 'en',
    openingDate: null,
    businessStatus: 'OPEN',
    isServiceAreaBusiness: false,
    canReopen: null,
    source: 'gbp',
    managedBy: 'gbp',
    lastSyncedAt: CHECKED_AT,
  },
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
      source: 'public',
      matchStatus: 'matched',
      summary: 'Google hours match Nabatable hours.',
      warnings: [],
      weekly: [],
      overrides: [],
    },
    servicePeriods: {
      source: 'more_hours',
      matchStatus: 'matched',
      summary: 'Google meal windows match Nabatable services.',
      warnings: [],
      periods: [],
    },
    bookingHours: {
      matchStatus: 'partial',
      summary: 'Booking hours are aligned.',
      warnings: [],
      missingInputs: [],
    },
  },
};

function connection(
  overrides: Partial<GoogleBusinessProfileConnection>,
): GoogleBusinessProfileConnection {
  return {
    isConfigured: true,
    provider: 'google_business_profile',
    status: 'linked',
    pushEnabled: true,
    connectedGoogleEmail: 'listing-owner@example.com',
    connectedGoogleName: 'Listing Owner',
    externalAccountId: GBP_LOCATIONS[0]!.accountId,
    externalAccountName: GBP_LOCATIONS[0]!.accountName,
    externalLocationId: GBP_LOCATIONS[0]!.locationId,
    externalLocationName: GBP_LOCATIONS[0]!.locationName,
    externalLocationTitle: GBP_LOCATIONS[0]!.title,
    externalPlaceId: GBP_LOCATIONS[0]!.placeId,
    providerTimezone: 'Europe/London',
    lastPullAt: CHECKED_AT,
    lastPushAt: null,
    lastError: null,
    availableLocations: GBP_LOCATIONS,
    businessInfo,
    ...overrides,
  };
}

const UNLINKED: Partial<GoogleBusinessProfileConnection> = {
  connectedGoogleEmail: null,
  connectedGoogleName: null,
  externalAccountId: null,
  externalAccountName: null,
  externalLocationId: null,
  externalLocationName: null,
  externalLocationTitle: null,
  externalPlaceId: null,
  lastPullAt: null,
  availableLocations: [],
};

export function gbpConnectionFor(scenario: GbpScenario): GoogleBusinessProfileConnection {
  switch (scenario) {
    case 'reauth':
      return connection({ status: 'reauth_required' });
    case 'authorized':
      return connection({
        ...UNLINKED,
        status: 'authorized',
        connectedGoogleEmail: 'listing-owner@example.com',
        availableLocations: GBP_LOCATIONS,
      });
    case 'pending':
      return connection({ ...UNLINKED, status: 'pending_auth' });
    case 'unlinked':
      return connection({ ...UNLINKED, status: 'unlinked' });
    case 'unconfigured':
      return connection({ ...UNLINKED, status: 'unlinked', isConfigured: false });
    default:
      return connection({});
  }
}

/** GET /google-business-profile (V1 operator state), as JSON. */
export type GbpOperatorStateFixture = {
  version: 'v1';
  restaurantId: string;
  provider: 'google_business_profile';
  connectionStatus: string;
  writeState: string;
  connectionGeneration: number;
  consentEpoch: number;
  reasonCode: string | null;
  rollout:
    | { eligible: true; cohort: string; evaluatedAt: string }
    | { eligible: false; reason: string; evaluatedAt: string };
  pendingUpdates:
    | { version: 'v1'; restaurantId: string; state: 'none' }
    | {
        version: 'v1';
        restaurantId: string;
        state: 'unknown';
        locationMasks: [];
        attributePaths: [];
        unknownPaths: string[];
        observedAt: string;
        expiresAt: string;
      };
  notifications: { enabled: boolean; refCount: number };
  refresh: {
    status: string;
    lastAttemptAt: string | null;
    lastSucceededAt: string | null;
    safeErrorCode: string | null;
  };
};

export function gbpOperatorStateFor(scenario: GbpScenario): GbpOperatorStateFixture {
  const base: GbpOperatorStateFixture = {
    version: 'v1',
    restaurantId: id,
    provider: 'google_business_profile',
    connectionStatus: 'linked',
    writeState: 'eligible',
    connectionGeneration: 7,
    consentEpoch: 3,
    reasonCode: null,
    rollout: { eligible: true, cohort: 'canary', evaluatedAt: CHECKED_AT },
    pendingUpdates: {
      version: 'v1',
      restaurantId: id,
      state: 'none',
    },
    notifications: { enabled: true, refCount: 2 },
    refresh: {
      status: 'succeeded',
      lastAttemptAt: CHECKED_AT,
      lastSucceededAt: CHECKED_AT,
      safeErrorCode: null,
    },
  };
  switch (scenario) {
    case 'failstop':
      return {
        ...base,
        writeState: 'blocked',
        reasonCode: 'pending_updates_unknown',
        pendingUpdates: {
          version: 'v1',
          restaurantId: id,
          state: 'unknown',
          locationMasks: [],
          attributePaths: [],
          unknownPaths: ['foodMenus', 'profile.description'],
          observedAt: CHECKED_AT,
          expiresAt: '2026-10-24T12:58:00.000Z',
        },
      };
    case 'reauth':
      return {
        ...base,
        connectionStatus: 'reauth_required',
        writeState: 'reauth_required',
        reasonCode: 'gbp_reauth_required',
        refresh: {
          status: 'failed',
          lastAttemptAt: '2026-09-26T08:12:00.000Z',
          lastSucceededAt: '2026-09-25T18:40:00.000Z',
          safeErrorCode: 'provider_invalid_grant',
        },
      };
    case 'rollout':
      return {
        ...base,
        writeState: 'blocked',
        reasonCode: 'rollout_off',
        rollout: { eligible: false, reason: 'rollout_off', evaluatedAt: CHECKED_AT },
      };
    default:
      return base;
  }
}

export const GBP_TERMINAL_NOTICES = {
  notices: [
    {
      id: 'notice_1',
      grant_id: 'grant_1',
      event_id: 'event_1',
      terminal_kind: 'consumed',
      safe_reason_code: 'provider_succeeded',
      requires_fresh_preview: false,
      status: 'delivered',
      terminal_at: '2026-09-24T17:12:00.000Z',
      due_at: '2026-09-24T17:13:00.000Z',
      dispatched_at: '2026-09-24T17:12:00.000Z',
      outcome_unknown_at: null,
      delivered_at: '2026-09-24T17:12:30.000Z',
      failed_at: null,
      last_error_code: null,
      created_at: '2026-09-24T17:12:00.000Z',
      providerInstruction: 'none',
      operationalDeliveryInstruction: 'none',
    },
  ],
  census: {
    pending_count: 0,
    overdue_count: 0,
    claimed_count: 0,
    dispatched_count: 0,
    outcome_unknown_count: 0,
    delivered_count: 1,
    failed_count: 0,
    oldest_pending_at: null,
  },
  asOf: CHECKED_AT,
};

type FieldSeed = {
  key: string;
  section: DualSyncSectionKey;
  label: string;
  core: unknown;
  gbp: unknown;
  state: DualSyncFieldState;
  risk?: 'low' | 'medium' | 'high' | 'critical';
  importOnly?: boolean;
  kind?: string;
  comparator?: DualSyncFieldSummary['policy']['semanticComparator'];
};

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

function hours(day: string, which: 'core' | 'gbp') {
  if (day === 'Monday') return 'Closed';
  if (day === 'Sunday') return which === 'core' ? '12:00–21:00' : '12:00–22:30';
  if (day === 'Friday' || day === 'Saturday') return '12:00–23:00';
  return '12:00–22:30';
}

const FIELD_SEEDS: FieldSeed[] = [
  {
    key: 'profile.businessName',
    section: 'profile',
    label: 'Business name',
    core: 'The White Horse',
    gbp: 'The White Horse',
    state: 'in_sync',
  },
  {
    key: 'profile.description',
    section: 'profile',
    label: 'Business description',
    core: 'Village pub with a Nepalese kitchen: momo, curries and Sunday roasts, real ales and a garden.',
    gbp: 'A traditional village pub serving food and real ales.',
    state: 'core_dirty',
  },
  {
    key: 'profile.phone',
    section: 'profile',
    label: 'Contact phone',
    core: '01632 960 123',
    gbp: '01632 960 987',
    state: 'conflict',
    risk: 'high',
    comparator: 'phone',
  },
  {
    key: 'profile.address',
    section: 'profile',
    label: 'Address',
    core: '12 Example Road, Sampleton AB1 2CD',
    gbp: '12 Example Road, Sampleton AB1 2CD',
    state: 'in_sync',
    risk: 'high',
  },
  {
    key: 'profile.mapsUrl',
    section: 'profile',
    label: 'Google Maps URL',
    core: null,
    gbp: 'https://maps.google.com/?cid=0000000000',
    state: 'gbp_dirty',
    importOnly: true,
    comparator: 'url',
  },
  ...DAYS.map<FieldSeed>((day) => ({
    key: `operatingHours.weekly.${day.toLowerCase()}`,
    section: 'operatingHours',
    label: day,
    core: hours(day, 'core'),
    gbp: hours(day, 'gbp'),
    state: day === 'Sunday' ? 'core_dirty' : 'in_sync',
    comparator: 'hours',
  })),
  {
    key: 'servicePeriods.sundayLunch',
    section: 'servicePeriods',
    label: 'Sunday lunch',
    core: '12:00–16:00',
    gbp: null,
    state: 'core_dirty',
    comparator: 'service_period',
  },
  {
    key: 'servicePeriods.dinner',
    section: 'servicePeriods',
    label: 'Dinner, Tuesday to Saturday',
    core: '17:30–21:30',
    gbp: '17:30–21:30',
    state: 'in_sync',
    comparator: 'service_period',
  },
  {
    key: 'businessContext.categories.primary',
    section: 'businessContext.categories',
    label: 'Primary category',
    core: 'Pub',
    gbp: 'Pub',
    state: 'in_sync',
    risk: 'high',
    comparator: 'category',
  },
  {
    key: 'businessContext.categories.additional',
    section: 'businessContext.categories',
    label: 'Additional categories',
    core: ['Nepalese restaurant', 'Restaurant'],
    gbp: ['Restaurant'],
    state: 'core_dirty',
    risk: 'high',
    comparator: 'list',
  },
  {
    key: 'businessContext.attributes.serves_vegetarian',
    section: 'businessContext.attributes',
    label: 'Serves vegetarian dishes',
    core: 'Yes',
    gbp: null,
    state: 'core_dirty',
    comparator: 'attribute',
  },
  {
    key: 'businessContext.attributes.outdoor',
    section: 'businessContext.attributes',
    label: 'Outdoor seating',
    core: 'Yes',
    gbp: 'Yes',
    state: 'in_sync',
    comparator: 'attribute',
  },
  {
    key: 'businessContext.attributes.wheelchair',
    section: 'businessContext.attributes',
    label: 'Wheelchair-accessible entrance',
    core: null,
    gbp: 'Yes',
    state: 'gbp_dirty',
    comparator: 'attribute',
  },
  {
    key: 'businessContext.serviceItems.dineIn',
    section: 'businessContext.serviceItems',
    label: 'Dine-in',
    core: 'Offered',
    gbp: 'Offered',
    state: 'in_sync',
    comparator: 'service_item',
  },
  {
    key: 'foodMenus.items.mains.chicken-momo',
    section: 'foodMenus',
    label: 'Chicken momo',
    core: '£8.50',
    gbp: '£7.95',
    state: 'core_dirty',
    kind: 'foodMenu.item',
    comparator: 'food_menu_item',
  },
  {
    key: 'foodMenus.items.mains.sunday-roast-beef',
    section: 'foodMenus',
    label: 'Sunday roast beef',
    core: '£17.00',
    gbp: null,
    state: 'core_dirty',
    kind: 'foodMenu.item',
    comparator: 'food_menu_item',
  },
  {
    key: 'foodMenus.items.mains.lamb-curry',
    section: 'foodMenus',
    label: 'Lamb curry',
    core: null,
    gbp: '£14.50',
    state: 'gbp_dirty',
    kind: 'foodMenu.item',
    comparator: 'food_menu_item',
  },
  {
    key: 'foodMenus.items.starters.veg-momo',
    section: 'foodMenus',
    label: 'Vegetable momo',
    core: '£7.50',
    gbp: '£7.50',
    state: 'in_sync',
    kind: 'foodMenu.item',
    comparator: 'food_menu_item',
  },
];

function field(seed: FieldSeed, sortOrder: number, scenario: GbpScenario): DualSyncFieldSummary {
  const state: DualSyncFieldState = scenario === 'insync' ? 'in_sync' : seed.state;
  const canExport = !seed.importOnly && seed.core !== null;
  return {
    fieldKey: seed.key,
    sectionKey: seed.section,
    kind: seed.kind ?? seed.section,
    label: seed.label,
    helpText: null,
    conflictPolicy: 'manual',
    deletePolicy: 'manual',
    policy: {
      fieldKey: seed.key,
      sectionKey: seed.section,
      authority: seed.importOnly ? 'import_only' : 'bidirectional_manual',
      riskLevel: seed.risk ?? 'medium',
      importable: true,
      exportable: !seed.importOnly,
      requiresManualReview: false,
      semanticComparator: seed.comparator ?? 'text',
      canonicalizer: 'passthrough',
      destructiveWritePossible: seed.section === 'foodMenus',
    },
    importable: true,
    exportable: !seed.importOnly,
    sortOrder,
    coreValue: scenario === 'insync' ? (seed.core ?? seed.gbp) : seed.core,
    gbpValue: scenario === 'insync' ? (seed.core ?? seed.gbp) : seed.gbp,
    coreCanonicalHash: null,
    gbpCanonicalHash: null,
    capability: {
      canImport: true,
      canExport,
      canIgnore: true,
      blockedReasons: seed.importOnly
        ? ['Google owns this value. You can use Google’s value in Nabatable, but not send it.']
        : seed.core === null
          ? ['Not set in Nabatable, so there is nothing to send.']
          : [],
    },
    state,
    lastInSyncAt: CHECKED_AT,
    lastInSyncHash: null,
    lastCoreChangeAt: state === 'in_sync' ? null : '2026-09-26T10:00:00.000Z',
    lastGbpChangeAt: null,
    openCandidate: null,
  };
}

export function gbpDualSyncStateFor(scenario: GbpScenario): GetDualSyncStateResponse {
  return {
    restaurantId: id,
    coreSnapshot: {} as GetDualSyncStateResponse['coreSnapshot'],
    gbpSnapshot: {} as GetDualSyncStateResponse['gbpSnapshot'],
    coreSnapshotHash: `core-${scenario}`,
    gbpSnapshotHash: `gbp-${scenario}`,
    fields: FIELD_SEEDS.map((seed, index) => field(seed, index, scenario)),
    outboundQueue: {
      totalOpen: 2,
      autoExportable: 2,
      missingBaseline: 0,
      lastQueuedAt: CHECKED_AT,
    },
    lastSnapshot: {
      runId: 'snapshot-run-1',
      runKind: 'manual',
      startedAt: CHECKED_AT,
      finishedAt: CHECKED_AT,
    },
    control: {
      restaurantId: id,
      provider: 'google_business_profile',
      syncPaused: scenario === 'paused',
      pauseReason: scenario === 'paused' ? 'Paused while the menu is being rewritten.' : null,
      pausedByUserId: null,
      pausedAt: scenario === 'paused' ? CHECKED_AT : null,
      resumedAt: null,
      createdAt: null,
      updatedAt: null,
    },
  };
}

export function gbpExactPreview(fieldKeys: readonly string[]) {
  const issuedAt = new Date();
  const expiresAt = new Date(issuedAt.getTime() + 15 * 60_000);
  const hash = (char: string) => char.repeat(64);
  const profileKeys = fieldKeys.filter((key) => !key.startsWith('foodMenus.'));
  const menuKeys = fieldKeys.filter((key) => key.startsWith('foodMenus.'));
  const group = (
    groupId: string,
    writeGroup: string,
    keys: readonly string[],
    resource: string,
    updateMasks: string[],
    fullReplacement: boolean,
  ) => ({
    groupId,
    writeGroup,
    direction: 'export_to_google' as const,
    fieldKeys: [...keys],
    method: 'PATCH' as const,
    resource,
    updateMasks,
    beforeDisplay: {
      core: Object.fromEntries(keys.map((key) => [key, 'Nabatable value'])),
      google: Object.fromEntries(keys.map((key) => [key, 'Google value'])),
    },
    afterDisplay: {
      core: Object.fromEntries(keys.map((key) => [key, 'Nabatable value'])),
      google: Object.fromEntries(keys.map((key) => [key, 'Nabatable value'])),
    },
    beforeHashes: {
      core: Object.fromEntries(keys.map((key) => [key, hash('a')])),
      google: Object.fromEntries(keys.map((key) => [key, hash('b')])),
    },
    afterHashes: {
      core: Object.fromEntries(keys.map((key) => [key, hash('a')])),
      google: Object.fromEntries(keys.map((key) => [key, hash('a')])),
    },
    requestHash: hash('c'),
    decisionHash: hash('d'),
    warnings: fullReplacement
      ? ['This replaces the complete Google FoodMenus resource.']
      : ['Updates public Google Business Profile data.'],
    riskLevel: fullReplacement ? ('critical' as const) : ('high' as const),
    fullReplacement,
  });

  const groups = [
    ...(profileKeys.length
      ? [
          group(
            'group_location_profile',
            'location.profile',
            profileKeys,
            GBP_LOCATIONS[0]!.locationName,
            ['profile.description', 'regularHours'],
            false,
          ),
        ]
      : []),
    ...(menuKeys.length
      ? [
          group(
            'group_food_menus',
            'location.foodMenus',
            menuKeys,
            `${GBP_LOCATIONS[0]!.accountName}/${GBP_LOCATIONS[0]!.locationName}/foodMenus`,
            ['*'],
            true,
          ),
        ]
      : []),
  ];

  return {
    confirmationVersion: 'gbp-exact-consent-v1',
    policyVersion: 'gbp-write-policy-v1',
    rendererVersion: 'gbp-renderer-v1',
    listing: {
      restaurantId: id,
      externalProfileRowId: 'profile_row_1',
      accountId: GBP_LOCATIONS[0]!.accountId,
      profileId: 'profile_1',
      locationId: GBP_LOCATIONS[0]!.locationId,
      connectionGeneration: 7,
      consentEpoch: 3,
    },
    snapshotPins: { core: hash('a'), google: hash('b') },
    groups,
    planFingerprint: hash('e'),
    issuedAt: issuedAt.toISOString(),
    expiresAt: expiresAt.toISOString(),
  };
}

export function gbpPublishResponse(groupIds: readonly string[]) {
  return {
    mode: 'immediate',
    bundleId: 'bundle_1',
    grantIds: ['grant_1'],
    outcomes: groupIds.map((groupId) => ({
      groupId,
      status: 'consumed',
      reasonCode: 'provider_succeeded',
    })),
  };
}
