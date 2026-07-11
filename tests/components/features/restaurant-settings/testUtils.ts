import { vi } from 'vitest';

/**
 * vitest.config.ts sets `mockReset: true`, which wipes the matchMedia stub
 * installed by tests/setup.ts before each test. Components that read
 * window.matchMedia at mount (Sidebar/useIsMobile, Radix media hooks) need it
 * re-stubbed per test — same convention as tests/components/RestaurantSettingsShell.test.tsx.
 */
export function stubMatchMedia(matches = false) {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
}

function makeQueryState<T>(data: T) {
  return {
    data,
    error: null as Error | null,
    isError: false,
    isLoading: false,
    isFetching: false,
    refetch: vi.fn(),
  };
}

function makeMutationState() {
  return {
    isPending: false,
    isError: false,
    error: null as Error | null,
    mutate: vi.fn(),
    mutateAsync: vi.fn(),
    reset: vi.fn(),
  };
}

export type WeeklyRowFixture = {
  dayOfWeek: number;
  opensAt: string;
  closesAt: string;
  isClosed: boolean;
  notes: string;
  reservationIntervalMinutes: string;
  reservationSlotTimes: string;
};

export function makeWeeklyRow(over: Partial<WeeklyRowFixture> = {}): WeeklyRowFixture {
  return {
    dayOfWeek: 1,
    opensAt: '11:00',
    closesAt: '22:00',
    isClosed: false,
    notes: '',
    reservationIntervalMinutes: '30',
    reservationSlotTimes: '',
    ...over,
  };
}

type MealFixture = {
  id?: string;
  name: string;
  enabled: boolean;
  startTime: string;
  endTime: string;
};

export type DayServiceConfigFixture = {
  dayOfWeek: number;
  label: string;
  opensAt: string | null;
  closesAt: string | null;
  isClosed: boolean;
  lunch: MealFixture;
  dinner: MealFixture;
};

export function makeDayConfig(
  over: Partial<DayServiceConfigFixture> = {},
): DayServiceConfigFixture {
  return {
    dayOfWeek: 1,
    label: 'Monday',
    opensAt: '11:00',
    closesAt: '22:00',
    isClosed: false,
    lunch: { name: 'Lunch', enabled: true, startTime: '12:00', endTime: '15:00' },
    dinner: { name: 'Dinner', enabled: true, startTime: '18:00', endTime: '21:30' },
    ...over,
  };
}

const FAMILY_KEYS = [
  'businessDetails',
  'links',
  'categories',
  'serviceAreas',
  'attributes',
  'serviceItems',
] as const;

function familyRecord<T>(value: T): Record<(typeof FAMILY_KEYS)[number], T> {
  return Object.fromEntries(FAMILY_KEYS.map((key) => [key, value])) as Record<
    (typeof FAMILY_KEYS)[number],
    T
  >;
}

export function makeLinkRow(over: Record<string, unknown> = {}) {
  return {
    id: 'link-1',
    linkType: 'website',
    label: 'Website',
    url: 'https://example.com',
    isPrimary: false,
    ...over,
  };
}

export function makeCategoryRow(over: Record<string, unknown> = {}) {
  return {
    id: 'category-1',
    displayName: 'Gastropub',
    categoryCode: 'gastropub',
    isPrimary: true,
    moreHoursTypes: [],
    moreHoursTypeDraft: '',
    ...over,
  };
}

export function makeServiceAreaRow(over: Record<string, unknown> = {}) {
  return {
    id: 'area-1',
    displayName: 'Cambridge',
    areaType: 'locality',
    regionCode: 'GB',
    googlePlaceId: '',
    googlePlaceResourceName: '',
    placeDataJson: '',
    ...over,
  };
}

export function makeAttributeRow(over: Record<string, unknown> = {}) {
  return {
    id: 'attribute-1',
    attributeGroup: 'Amenities',
    attributeKey: 'has_wifi',
    attributeName: 'attributes/has_wifi',
    attributeId: 'has_wifi',
    displayName: 'Wi-Fi',
    displayText: 'Free Wi-Fi',
    displayTextStandalone: '',
    displayTextNegative: '',
    valueType: 'BOOL',
    boolValue: 'true',
    textValue: '',
    uriValue: '',
    uriValuesText: '',
    enumValuesText: '',
    unsetEnumValuesText: '',
    rawValueJson: '',
    rawEnumValuesJson: '',
    displayValueJson: '',
    valueMetadataJson: '',
    ...over,
  };
}

export function makeServiceItemRow(over: Record<string, unknown> = {}) {
  return {
    id: 'service-item-1',
    itemKey: 'sunday-roast',
    itemType: 'structured',
    displayName: 'Sunday roast',
    description: 'Weekly roast service',
    payloadJson: '',
    ...over,
  };
}

/**
 * Full-shape stand-in for the RestaurantBusinessContextEditor hook result used
 * by the discovery panels; every mutator is a vi.fn() so panels can assert
 * routing without the query/draft machinery.
 */
export function makeBusinessContextEditor(over: Record<string, unknown> = {}) {
  return {
    contextQuery: { data: null, isLoading: false, error: null },
    activeTab: '' as string,
    setActiveTab: vi.fn(),
    businessDetails: {
      openingDate: '',
      businessStatus: 'open',
      isServiceAreaBusiness: false,
    },
    links: [] as unknown[],
    categories: [] as unknown[],
    serviceAreas: [] as unknown[],
    serviceAreaDraft: '',
    setServiceAreaDraft: vi.fn(),
    attributes: [] as unknown[],
    serviceItems: [] as unknown[],
    seedSource: familyRecord<'core' | 'provider' | 'empty'>('core'),
    dirty: familyRecord(false),
    errors: {} as Partial<Record<string, string | null>>,
    savingFamily: null as string | null,
    savedFamily: null as string | null,
    providerCounts: familyRecord(0),
    coreCounts: familyRecord(0),
    updateBusinessDetails: vi.fn(),
    addLink: vi.fn(),
    updateLink: vi.fn(),
    removeLink: vi.fn(),
    addCategory: vi.fn(),
    updateCategory: vi.fn(),
    removeCategory: vi.fn(),
    updateMoreHoursDraft: vi.fn(),
    addMoreHoursTypes: vi.fn(),
    removeMoreHoursType: vi.fn(),
    updateServiceArea: vi.fn(),
    addServiceAreaFromDraft: vi.fn(),
    removeServiceArea: vi.fn(),
    toggleAmenityAttribute: vi.fn(),
    addAttribute: vi.fn(),
    updateAttribute: vi.fn(),
    removeAttribute: vi.fn(),
    addServiceItem: vi.fn(),
    updateServiceItem: vi.fn(),
    removeServiceItem: vi.fn(),
    resetFamily: vi.fn(),
    saveFamily: vi.fn().mockResolvedValue(undefined),
    ...over,
  };
}

/**
 * Full-shape dual-sync field summary (mirrors tests/components/DualSyncFieldRow.test.tsx).
 */
export function makeDualSyncFieldSummary(over: Record<string, unknown> = {}) {
  return {
    fieldKey: 'profile.name',
    sectionKey: 'profile',
    kind: 'profile',
    label: 'Business name',
    helpText: null,
    conflictPolicy: 'manual',
    deletePolicy: 'manual',
    policy: {
      fieldKey: 'profile.name',
      sectionKey: 'profile',
      authority: 'bidirectional_manual',
      riskLevel: 'critical',
      importable: true,
      exportable: true,
      requiresManualReview: true,
      googleWriteGroup: 'location.profile',
      semanticComparator: 'text',
      canonicalizer: 'canonicalizeText',
      destructiveWritePossible: true,
    },
    importable: true,
    exportable: true,
    sortOrder: 0,
    coreValue: 'Nabatable name',
    gbpValue: 'Google name',
    coreCanonicalHash: 'core-hash',
    gbpCanonicalHash: 'gbp-hash',
    capability: { canImport: true, canExport: true, canIgnore: true, blockedReasons: [] },
    state: 'conflict',
    lastInSyncAt: null,
    lastInSyncHash: null,
    lastCoreChangeAt: null,
    lastGbpChangeAt: null,
    openCandidate: null,
    ...over,
  };
}

/** Full-shape dual-sync publish operation row for panel/table tests. */
export function makeDualSyncPublishOperation(over: Record<string, unknown> = {}) {
  return {
    id: 'op-1',
    restaurantId: 'rest-1',
    publishJobId: 'job-1',
    publishBatchId: null,
    operationGroupId: null,
    sectionKey: 'profile',
    fieldKey: 'profile.name',
    direction: 'export_to_google',
    status: 'succeeded',
    attemptCount: 1,
    beforeCoreHash: null,
    beforeGbpHash: null,
    afterCoreHash: null,
    afterGbpHash: null,
    googleUpdateMask: null,
    errorCode: null,
    errorMessage: null,
    externalResponse: null,
    startedAt: '2026-07-10T18:30:00.000Z',
    finishedAt: '2026-07-10T18:30:02.000Z',
    createdAt: '2026-07-10T18:29:59.000Z',
    ...over,
  };
}

/** Full-shape Google Business Profile connection fixture. */
export function makeGbpConnection(over: Record<string, unknown> = {}) {
  return {
    isConfigured: true,
    provider: 'google_business_profile',
    status: 'authorized',
    pushEnabled: false,
    connectedGoogleEmail: 'owner@example.com',
    connectedGoogleName: 'Owner',
    externalAccountId: 'account-1',
    externalAccountName: 'accounts/account-1',
    externalLocationId: null,
    externalLocationName: null,
    externalLocationTitle: null,
    externalPlaceId: null,
    providerTimezone: null,
    lastPullAt: null,
    lastPushAt: null,
    lastError: null,
    availableLocations: [
      {
        accountName: 'accounts/account-1',
        accountId: 'account-1',
        accountDisplayName: 'Lapen Inns',
        locationName: 'locations/location-1',
        locationId: 'location-1',
        title: 'Old Crown Girton',
        addressText: '1 High Street, Girton',
        placeId: 'place-1',
      },
    ],
    businessInfo: null,
    ...over,
  };
}

/** Full-shape durable queue job (mirrors tests/components/DualSyncQueueJobsPanel.test.tsx). */
export function makeDualSyncJob(over: Record<string, unknown> = {}) {
  return {
    id: 'queue-job-1',
    restaurantId: 'restaurant-1',
    provider: 'google_business_profile',
    jobKind: 'publish_batch',
    status: 'dead_letter',
    idempotencyKey: 'request-1',
    priority: 100,
    payload: {},
    attemptCount: 3,
    maxAttempts: 3,
    availableAt: '2026-05-09T12:00:00.000Z',
    lockedAt: null,
    lockedBy: null,
    lastErrorCode: 'QUOTA_LIMITED',
    lastErrorMessage: 'Google edit budget exhausted.',
    deadLetterReason: 'Google edit budget exhausted.',
    startedAt: '2026-05-09T11:59:00.000Z',
    finishedAt: '2026-05-09T12:00:00.000Z',
    createdAt: '2026-05-09T11:58:00.000Z',
    updatedAt: '2026-05-09T12:00:00.000Z',
    ...over,
  };
}

/** Publish-job rollup row (mirrors tests/components/DualSyncPublishJobsPanel.test.tsx). */
export function makeDualSyncPublishJobRollup(over: Record<string, unknown> = {}) {
  return {
    publishJobId: 'publish-job-1',
    restaurantId: 'restaurant-1',
    startedAt: '2026-05-09T12:00:00.000Z',
    finishedAt: '2026-05-09T12:00:01.000Z',
    totalOperations: 1,
    succeededCount: 1,
    failedCount: 0,
    skippedCount: 0,
    otherCount: 0,
    sections: ['profile'],
    errorCodes: [],
    importCount: 0,
    exportCount: 1,
    ...over,
  };
}

/**
 * Full-shape stand-in for the useOpsDualSync() hook return value so components
 * that reach for any of its queries/mutations render without TypeErrors.
 */
export function makeDualSyncHookState() {
  return {
    stateQuery: makeQueryState<unknown>(null),
    refreshMutation: makeMutationState(),
    publishMutation: makeMutationState(),
    previewPublishMutation: makeMutationState(),
    autoExportMutation: makeMutationState(),
    retryJobMutation: makeMutationState(),
    cancelCandidateMutation: makeMutationState(),
    controlMutation: makeMutationState(),
    operationsQuery: makeQueryState<unknown>(null),
    jobsQuery: makeQueryState<unknown>(null),
    candidatesQuery: makeQueryState<unknown>(null),
    metricsQuery: makeQueryState<unknown>(null),
    publishJobsQuery: makeQueryState<unknown>(null),
    publishJobDetailQuery: makeQueryState<unknown>(null),
  };
}
