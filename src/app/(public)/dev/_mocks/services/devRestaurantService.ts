import { fetchJson } from '@/lib/http/fetchJson';
import {
  buildEditableTemplateVariants,
  getRestaurantBookingEmailTemplateCatalog,
  getRestaurantBookingEmailTemplateDefinition,
  getRestaurantBookingEmailTemplateGroups,
  normalizeRestaurantEmailTemplatesDocument,
  type RestaurantBookingEmailTemplateKey,
  type RestaurantEmailTemplateVariant,
} from '@/lib/restaurants/email-templates';

import { DEV_RESTAURANT_ID } from '../devIds';

import type { RestaurantGoogleBusinessProfileConnection } from '@/lib/restaurants/google-business-profile';
import type {
  OperatingHoursSnapshot,
  RestaurantEmailTemplatePreview,
  PreviewEmailTemplateInput,
  RestaurantEmailTemplate,
  RestaurantEmailTemplateGroup,
  RestaurantEmailTemplatesSnapshot,
  RestaurantProfile,
  RestaurantService,
  SendTestEmailTemplateInput,
  ServicePeriodRow,
  TurnBandsPayload,
  TurnBandsSnapshot,
} from '@/services/ops/restaurants';


const SECOND_DEV_RESTAURANT_ID = '22222222-2222-4222-8222-222222222222';

type RestaurantSnapshot = {
  profile: RestaurantProfile;
  googleBusinessProfile: RestaurantGoogleBusinessProfileConnection;
  hours: OperatingHoursSnapshot;
  servicePeriods: ServicePeriodRow[];
  turnBands: TurnBandsSnapshot;
  emailTemplates: ReturnType<typeof normalizeRestaurantEmailTemplatesDocument>;
};

type MutableState = {
  restaurants: Record<string, RestaurantSnapshot>;
};

function buildRestaurantSnapshot(
  overrides: Partial<RestaurantProfile> & Pick<RestaurantProfile, 'id' | 'name' | 'slug' | 'timezone'>,
): RestaurantSnapshot {
  const profile: RestaurantProfile = {
    id: overrides.id,
    name: overrides.name,
    slug: overrides.slug,
    timezone: overrides.timezone,
    capacity: overrides.capacity ?? 90,
    contactEmail: overrides.contactEmail ?? 'ops@example.com',
    contactPhone: overrides.contactPhone ?? '+44 7700 900123',
    address: overrides.address ?? '1 Example Street, London',
    googleMapUrl: overrides.googleMapUrl ?? null,
    googleReviewUrl: overrides.googleReviewUrl ?? null,
    bookingPolicy:
      overrides.bookingPolicy ??
      'Please arrive on time. Late arrivals may lose their table after a short grace period.',
    logoUrl: overrides.logoUrl ?? null,
    emailSendReminder24h: overrides.emailSendReminder24h ?? true,
    emailSendReminderShort: overrides.emailSendReminderShort ?? true,
    emailSendReviewRequest: overrides.emailSendReviewRequest ?? true,
    reservationIntervalMinutes: overrides.reservationIntervalMinutes ?? 15,
    reservationDefaultDurationMinutes: overrides.reservationDefaultDurationMinutes ?? 90,
    reservationLastSeatingBufferMinutes: overrides.reservationLastSeatingBufferMinutes ?? 15,
    reservationLifecycleGraceMinutes: overrides.reservationLifecycleGraceMinutes ?? 15,
  };

  const googleBusinessProfile: RestaurantGoogleBusinessProfileConnection = {
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
  };

  const hours: OperatingHoursSnapshot = {
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

  const servicePeriods: ServicePeriodRow[] = [
    { id: 'sp-1', name: 'Lunch', dayOfWeek: null, startTime: '12:00', endTime: '15:00', bookingOption: 'dining' },
    { id: 'sp-2', name: 'Dinner', dayOfWeek: null, startTime: '17:00', endTime: '22:00', bookingOption: 'dining' },
  ];

  const payload: TurnBandsPayload = {
    default: [
      { maxPartySize: 2, durationMinutes: 75 },
      { maxPartySize: 4, durationMinutes: 90 },
      { maxPartySize: 6, durationMinutes: 105 },
      { maxPartySize: 8, durationMinutes: 120 },
    ],
  };

  const turnBands: TurnBandsSnapshot = {
    restaurantId: profile.id,
    bands: payload,
    defaults: payload,
  };

  return { profile, googleBusinessProfile, hours, servicePeriods, turnBands, emailTemplates: null };
}

function buildInitialState(): MutableState {
  const primaryRestaurant = buildRestaurantSnapshot({
    id: DEV_RESTAURANT_ID,
    name: 'Dev Restaurant (Ops Harness)',
    slug: 'dev-restaurant',
    timezone: 'Europe/London',
  });

  const secondaryRestaurant = buildRestaurantSnapshot({
    id: SECOND_DEV_RESTAURANT_ID,
    name: 'Second Dev Restaurant',
    slug: 'second-dev-restaurant',
    timezone: 'America/New_York',
    address: '2 Example Street, New York',
    contactEmail: 'second.ops@example.com',
  });

  return {
    restaurants: {
      [primaryRestaurant.profile.id]: {
        ...primaryRestaurant,
        emailTemplates: normalizeRestaurantEmailTemplatesDocument(null),
      },
      [secondaryRestaurant.profile.id]: secondaryRestaurant,
    },
  };
}

function getRestaurantSnapshot(state: MutableState, restaurantId: string): RestaurantSnapshot {
  const snapshot = state.restaurants[restaurantId];
  if (!snapshot) {
    throw new Error('[dev][restaurantService] unknown restaurant');
  }
  return snapshot;
}

export class DevRestaurantService implements RestaurantService {
  private state: MutableState;

  constructor() {
    this.state = buildInitialState();
  }

  listRestaurants: RestaurantService['listRestaurants'] = async () =>
    Object.values(this.state.restaurants).map(({ profile }, index) => ({
      id: profile.id,
      name: profile.name,
      slug: profile.slug,
      timezone: profile.timezone,
      address: profile.address,
      role: index === 0 ? ('owner' as const) : ('manager' as const),
    }));

  async getProfile(restaurantId: string) {
    return getRestaurantSnapshot(this.state, restaurantId).profile;
  }

  async updateProfile(restaurantId: string, profile: Partial<RestaurantProfile>) {
    const snapshot = getRestaurantSnapshot(this.state, restaurantId);
    snapshot.profile = { ...snapshot.profile, ...profile };
    return snapshot.profile;
  }

  async getGoogleBusinessProfileStatus(restaurantId: string) {
    return getRestaurantSnapshot(this.state, restaurantId).googleBusinessProfile;
  }

  async getGoogleBusinessProfileConnectUrl(restaurantId: string) {
    const snapshot = getRestaurantSnapshot(this.state, restaurantId);
    snapshot.googleBusinessProfile = {
      ...snapshot.googleBusinessProfile,
      connected: true,
      status: 'needs_location',
      accountId: '1234567890',
      accountName: 'Lapen Inns',
      oauthConnectedAt: new Date('2026-04-07T12:00:00Z').toISOString(),
      syncFamilies: [],
      syncHistory: snapshot.googleBusinessProfile.syncHistory,
      availableLocations: [
        {
          accountId: '1234567890',
          accountName: 'Lapen Inns',
          locationId: '987654321',
          locationName: 'locations/987654321',
          title: snapshot.profile.name,
          addressText: snapshot.profile.address,
          primaryPhone: snapshot.profile.contactPhone,
          websiteUri: 'https://example.com/venues/demo-restaurant',
          mapsUri: 'https://maps.google.com/?cid=example',
          reviewUri: 'https://g.page/r/example/review',
          matchScore: 8,
        },
      ],
    };
    return 'https://accounts.google.com/o/oauth2/v2/auth?mock=1';
  }

  async refreshGoogleBusinessProfileCatalog(restaurantId: string) {
    const snapshot = getRestaurantSnapshot(this.state, restaurantId);
    if (!snapshot.googleBusinessProfile.connected) {
      throw new Error('Google Business Profile is not connected.');
    }
    snapshot.googleBusinessProfile = {
      ...snapshot.googleBusinessProfile,
      status: snapshot.googleBusinessProfile.locationId ? 'connected' : 'needs_location',
    };
    return snapshot.googleBusinessProfile;
  }

  async syncGoogleBusinessProfile(
    restaurantId: string,
    payload: { accountId?: string | null; locationId?: string | null } = {},
  ) {
    const snapshot = getRestaurantSnapshot(this.state, restaurantId);
    const selected =
      snapshot.googleBusinessProfile.availableLocations.find(
        (option) =>
          (!payload.locationId || option.locationId === payload.locationId) &&
          (!payload.accountId || option.accountId === payload.accountId),
      ) ?? snapshot.googleBusinessProfile.availableLocations[0];

    if (!selected) {
      throw new Error('Select a Google location first.');
    }

    snapshot.googleBusinessProfile = {
      ...snapshot.googleBusinessProfile,
      connected: true,
      status: 'partial',
      accountId: selected.accountId,
      accountName: selected.accountName,
      locationId: selected.locationId,
      locationName: selected.locationName,
      locationTitle: selected.title,
      lastSyncAt: new Date('2026-04-07T12:05:00Z').toISOString(),
      lastSyncStatus: 'success',
      lastSyncError: 'Partial sync completed. Performance: Request contains an invalid argument.',
      latestChangeSummary: {
        generatedAt: new Date('2026-04-07T12:05:00Z').toISOString(),
        hasBaseline: true,
        totalChanges: 4,
        remainingChanges: 0,
        highlights: [
          {
            key: 'description',
            label: 'Description',
            family: 'location',
            kind: 'updated',
            before: 'Earlier sync baseline for the venue profile.',
            after:
              'A polished Google Business Profile summary imported into the Ops profile so the landing page can stay current.',
          },
          {
            key: 'serviceItems',
            label: 'Service items',
            family: 'attributes',
            kind: 'updated',
            before: 'Takeout',
            after: 'Delivery | Takeout | Dine In',
          },
          {
            key: 'reviewCount',
            label: 'Review count',
            family: 'reviews',
            kind: 'updated',
            before: '241',
            after: '248',
          },
          {
            key: 'metric:BUSINESS_IMPRESSIONS_DESKTOP_SEARCH',
            label: 'Business Impressions Desktop Search',
            family: 'performance',
            kind: 'added',
            before: null,
            after: '412 (2026-03-08 to 2026-04-06)',
          },
        ],
      },
      normalizedProfile: {
        title: selected.title,
        description:
          'A polished Google Business Profile summary imported into the Ops profile so the landing page can stay current.',
        primaryCategory: 'Restaurant',
        additionalCategories: ['Pub', 'Gastropub'],
        addressText: selected.addressText,
        locality: 'London',
        regionCode: 'GB',
        postalCode: 'CB1 2AB',
        placeId: 'ChIJ-demo-place-id',
        openStatus: 'OPEN',
        primaryPhone: selected.primaryPhone,
        additionalPhones: [],
        websiteUri: selected.websiteUri,
        mapsUri: selected.mapsUri,
        reviewUri: selected.reviewUri,
        regularHoursSummary: ['MONDAY 12:00 - MONDAY 22:00', 'TUESDAY 12:00 - TUESDAY 22:00'],
        moreHoursSummary: ['Drive Through: MONDAY 08:00 - MONDAY 22:00'],
        specialHoursSummary: [],
        attributeLabels: ['Outdoor seating: Yes', 'Serves vegetarian dishes: Yes'],
        serviceItems: ['Delivery', 'Takeout', 'Dine In'],
        rating: 4.6,
        reviewCount: 248,
        reviewSnippets: [
          {
            reviewId: 'review-1',
            starRating: 'FIVE',
            comment: 'Friendly team, smooth booking, and a strong Sunday roast.',
            reviewerDisplayName: 'Local Guide',
            createTime: '2026-03-28T09:15:00Z',
            updateTime: '2026-03-28T09:15:00Z',
          },
        ],
        media: [
          {
            name: 'media-1',
            category: 'COVER',
            format: 'PHOTO',
            sourceUrl: 'https://images.example.com/restaurant-cover.jpg',
            googleUrl: 'https://images.example.com/restaurant-cover.jpg',
            thumbnailUrl: 'https://images.example.com/restaurant-cover-thumb.jpg',
            description: 'Dining room hero image',
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
            metric: 'BUSINESS_IMPRESSIONS_DESKTOP_SEARCH',
            total: 412,
            startDate: '2026-03-08',
            endDate: '2026-04-06',
          },
        ],
      },
      syncFamilies: [
        {
          key: 'location',
          label: 'Location details',
          status: 'success',
          error: null,
          updatedAt: new Date('2026-04-07T12:05:00Z').toISOString(),
        },
        {
          key: 'attributes',
          label: 'Attributes',
          status: 'success',
          error: null,
          updatedAt: new Date('2026-04-07T12:05:00Z').toISOString(),
        },
        {
          key: 'reviews',
          label: 'Reviews',
          status: 'success',
          error: null,
          updatedAt: new Date('2026-04-07T12:05:00Z').toISOString(),
        },
        {
          key: 'media',
          label: 'Media',
          status: 'success',
          error: null,
          updatedAt: new Date('2026-04-07T12:05:00Z').toISOString(),
        },
        {
          key: 'performance',
          label: 'Performance',
          status: 'failed',
          error: 'Request contains an invalid argument.',
          updatedAt: new Date('2026-04-07T12:05:00Z').toISOString(),
        },
      ],
      syncHistory: [
        {
          id: 'sync-2',
          trigger: 'manual',
          accountId: selected.accountId,
          accountName: selected.accountName,
          locationId: selected.locationId,
          locationName: selected.locationName,
          locationTitle: selected.title,
          startedAt: new Date('2026-04-07T12:04:10Z').toISOString(),
          completedAt: new Date('2026-04-07T12:05:00Z').toISOString(),
          status: 'partial',
          error: 'Partial sync completed. Performance: Request contains an invalid argument.',
          syncFamilies: [
            {
              key: 'location',
              label: 'Location details',
              status: 'success',
              error: null,
              updatedAt: new Date('2026-04-07T12:05:00Z').toISOString(),
            },
            {
              key: 'attributes',
              label: 'Attributes',
              status: 'success',
              error: null,
              updatedAt: new Date('2026-04-07T12:05:00Z').toISOString(),
            },
            {
              key: 'reviews',
              label: 'Reviews',
              status: 'success',
              error: null,
              updatedAt: new Date('2026-04-07T12:05:00Z').toISOString(),
            },
            {
              key: 'media',
              label: 'Media',
              status: 'success',
              error: null,
              updatedAt: new Date('2026-04-07T12:05:00Z').toISOString(),
            },
            {
              key: 'performance',
              label: 'Performance',
              status: 'failed',
              error: 'Request contains an invalid argument.',
              updatedAt: new Date('2026-04-07T12:05:00Z').toISOString(),
            },
          ],
        },
        {
          id: 'sync-1',
          trigger: 'manual',
          accountId: selected.accountId,
          accountName: selected.accountName,
          locationId: selected.locationId,
          locationName: selected.locationName,
          locationTitle: selected.title,
          startedAt: new Date('2026-04-07T11:30:00Z').toISOString(),
          completedAt: new Date('2026-04-07T11:30:32Z').toISOString(),
          status: 'failed',
          error: 'Request contains an invalid argument.',
          syncFamilies: [
            {
              key: 'location',
              label: 'Location details',
              status: 'failed',
              error: 'Request contains an invalid argument.',
              updatedAt: new Date('2026-04-07T11:30:32Z').toISOString(),
            },
          ],
        },
      ],
    };

    return snapshot.googleBusinessProfile;
  }

  async disconnectGoogleBusinessProfile(restaurantId: string) {
    const snapshot = getRestaurantSnapshot(this.state, restaurantId);
    snapshot.googleBusinessProfile = {
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
      syncHistory: snapshot.googleBusinessProfile.syncHistory,
    };
  }

  async getOperatingHours(restaurantId: string) {
    return getRestaurantSnapshot(this.state, restaurantId).hours;
  }

  async updateOperatingHours(restaurantId: string, snapshot: OperatingHoursSnapshot) {
    const restaurant = getRestaurantSnapshot(this.state, restaurantId);
    restaurant.hours = snapshot;
    return restaurant.hours;
  }

  async getServicePeriods(restaurantId: string) {
    return getRestaurantSnapshot(this.state, restaurantId).servicePeriods;
  }

  async updateServicePeriods(restaurantId: string, rows: ServicePeriodRow[]) {
    const restaurant = getRestaurantSnapshot(this.state, restaurantId);
    restaurant.servicePeriods = rows;
    return restaurant.servicePeriods;
  }

  async getTurnBands(restaurantId: string) {
    return getRestaurantSnapshot(this.state, restaurantId).turnBands;
  }

  async updateTurnBands(restaurantId: string, payload: TurnBandsPayload) {
    const restaurant = getRestaurantSnapshot(this.state, restaurantId);
    restaurant.turnBands = {
      restaurantId,
      bands: payload,
      defaults: restaurant.turnBands.defaults,
    };
    return restaurant.turnBands;
  }

  async getEmailTemplates(restaurantId: string): Promise<RestaurantEmailTemplatesSnapshot> {
    const restaurant = getRestaurantSnapshot(this.state, restaurantId);

    return {
      restaurantId,
      canEdit: true,
      groups: getRestaurantBookingEmailTemplateGroups().map<RestaurantEmailTemplateGroup>((group) => ({
        key: group.key,
        title: group.title,
        description: group.description,
        templates: getRestaurantBookingEmailTemplateCatalog()
          .filter((definition) => definition.group === group.key)
          .map<RestaurantEmailTemplate>((definition) => {
            const variants = buildEditableTemplateVariants(definition.key, restaurant.emailTemplates);
            const defaultVariants = buildEditableTemplateVariants(definition.key, null);
            const status = restaurant.emailTemplates?.templates[definition.key] ? 'custom' : 'default';
            return {
              key: definition.key,
              title: definition.title,
              description: definition.description,
              groupKey: definition.group,
              supportsCtaLabel: definition.supportsCtaLabel,
              availableVariables: ['{{name}}', '{{firstName}}', '{{venue}}', '{{date}}', '{{time}}', '{{party}}'],
              recommendedVariables: definition.recommendedVariables.map((key) => `{{${key}}}`),
              authoringHints: [...definition.authoringHints],
              status,
              activeVariantCount: variants.filter((variant) => variant.isActive).length,
              variants,
              defaultVariants,
            };
          }),
      })),
    };
  }

  async updateEmailTemplate(
    restaurantId: string,
    templateKey: RestaurantBookingEmailTemplateKey,
    payload: { variants: RestaurantEmailTemplateVariant[] },
  ) {
    const restaurant = getRestaurantSnapshot(this.state, restaurantId);
    const current = restaurant.emailTemplates ?? { version: 1 as const, templates: {} };
    restaurant.emailTemplates = {
      version: 1,
      templates: {
        ...current.templates,
        [templateKey]: {
          variants: payload.variants,
        },
      },
    };

    const definition = getRestaurantBookingEmailTemplateDefinition(templateKey);
    return {
      key: definition.key,
      title: definition.title,
      description: definition.description,
      groupKey: definition.group,
      supportsCtaLabel: definition.supportsCtaLabel,
      availableVariables: ['{{name}}', '{{firstName}}', '{{venue}}', '{{date}}', '{{time}}', '{{party}}'],
      recommendedVariables: definition.recommendedVariables.map((key) => `{{${key}}}`),
      authoringHints: [...definition.authoringHints],
      status: 'custom' as const,
      activeVariantCount: payload.variants.filter((variant) => variant.isActive).length,
      variants: payload.variants,
      defaultVariants: buildEditableTemplateVariants(templateKey, null),
    };
  }

  async resetEmailTemplate(restaurantId: string, templateKey: RestaurantBookingEmailTemplateKey) {
    const restaurant = getRestaurantSnapshot(this.state, restaurantId);
    const current = restaurant.emailTemplates ?? { version: 1 as const, templates: {} };
    const templates = { ...current.templates };
    delete templates[templateKey];
    restaurant.emailTemplates = {
      version: 1,
      templates,
    };

    const definition = getRestaurantBookingEmailTemplateDefinition(templateKey);
    const variants = buildEditableTemplateVariants(templateKey, null);
    return {
      key: definition.key,
      title: definition.title,
      description: definition.description,
      groupKey: definition.group,
      supportsCtaLabel: definition.supportsCtaLabel,
      availableVariables: ['{{name}}', '{{firstName}}', '{{venue}}', '{{date}}', '{{time}}', '{{party}}'],
      recommendedVariables: definition.recommendedVariables.map((key) => `{{${key}}}`),
      authoringHints: [...definition.authoringHints],
      status: 'default' as const,
      activeVariantCount: variants.filter((variant) => variant.isActive).length,
      variants,
      defaultVariants: variants,
    };
  }

  async previewEmailTemplate(
    restaurantId: string,
    templateKey: RestaurantBookingEmailTemplateKey,
    payload: PreviewEmailTemplateInput = {},
  ): Promise<RestaurantEmailTemplatePreview> {
    const restaurant = getRestaurantSnapshot(this.state, restaurantId);
    const response = await fetchJson<{ restaurantId: string; preview: RestaurantEmailTemplatePreview }>(
      '/dev/api/restaurant-email-template-preview',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          templateKey,
          preferredVariantId: payload.preferredVariantId,
          recipientEmail: 'preview@nabatable.local',
          variants: payload.variants?.length
            ? payload.variants
            : buildEditableTemplateVariants(templateKey, restaurant.emailTemplates),
          venue: {
            id: restaurant.profile.id,
            slug: restaurant.profile.slug,
            name: restaurant.profile.name,
            timezone: restaurant.profile.timezone,
            address: restaurant.profile.address,
            phone: restaurant.profile.contactPhone,
            email: restaurant.profile.contactEmail,
            policy: restaurant.profile.bookingPolicy,
            logoUrl: restaurant.profile.logoUrl,
            googleMapUrl: restaurant.profile.googleMapUrl,
            googleReviewUrl: restaurant.profile.googleReviewUrl,
          },
        }),
      },
    );

    return response.preview;
  }

  async sendTestEmailTemplate(
    restaurantId: string,
    templateKey: RestaurantBookingEmailTemplateKey,
    payload: SendTestEmailTemplateInput,
  ) {
    return {
      ok: true as const,
      restaurantId,
      provider: 'mock' as const,
      messageId: `mock-${templateKey}`,
      preview: await this.previewEmailTemplate(restaurantId, templateKey, payload),
    };
  }
}

export function createDevRestaurantService(): RestaurantService {
  return new DevRestaurantService();
}
