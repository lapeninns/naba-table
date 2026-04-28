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

import type {
  GoogleBusinessProfileConnection,
  GoogleBusinessProfileDraftPatchPayload,
  GoogleBusinessProfileDraftPublishPayload,
  GoogleBusinessProfileDraftPublishPreflight,
  GoogleBusinessProfileDraftPublishPreflightPayload,
  GoogleBusinessProfilePublishDirectionIntent,
  GoogleBusinessProfileWorkflow,
  RestaurantBusinessContextSnapshot,
  UpdateRestaurantBusinessContextInput,
  GoogleBusinessProfileOperatingHoursSyncPayload,
  GoogleBusinessProfileProfileSyncPayload,
  GoogleBusinessProfileProtectedActionPayload,
  GoogleBusinessProfileServicePeriodsSyncPayload,
  LinkGoogleBusinessProfileLocationInput,
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

function resolvePublishDirectionIntent(payload: {
  directionIntent?: GoogleBusinessProfilePublishDirectionIntent;
  pushToGoogle?: boolean;
}): GoogleBusinessProfilePublishDirectionIntent {
  return (
    payload.directionIntent ??
    (payload.pushToGoogle ? 'google_to_nabatable_with_google_sync' : 'google_to_nabatable')
  );
}

type RestaurantSnapshot = {
  profile: RestaurantProfile;
  businessContext: RestaurantBusinessContextSnapshot['core'];
  hours: OperatingHoursSnapshot;
  servicePeriods: ServicePeriodRow[];
  turnBands: TurnBandsSnapshot;
  emailTemplates: ReturnType<typeof normalizeRestaurantEmailTemplatesDocument>;
};

type MutableState = {
  restaurants: Record<string, RestaurantSnapshot>;
};

function buildRestaurantSnapshot(
  overrides: Partial<RestaurantProfile> &
    Pick<RestaurantProfile, 'id' | 'name' | 'slug' | 'timezone'>,
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
    managerDailySummaryEnabled: overrides.managerDailySummaryEnabled ?? true,
    managerNotificationPhone: overrides.managerNotificationPhone ?? '+44 7700 900123',
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

  return {
    profile,
    businessContext: {
      categories: [],
      serviceAreas: [],
      attributes: [],
      serviceItems: [],
    },
    hours,
    servicePeriods,
    turnBands,
    emailTemplates: null,
  };
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

  async getBusinessContext(restaurantId: string): Promise<RestaurantBusinessContextSnapshot> {
    const snapshot = getRestaurantSnapshot(this.state, restaurantId);
    const connection = await this.getGoogleBusinessProfileConnection();

    return {
      core: snapshot.businessContext,
      providerSnapshot: {
        categories: connection.businessInfo.categories.map((row) => ({
          id: row.id,
          displayName: row.displayName,
          categoryCode: row.categoryCode,
          moreHoursTypes: row.moreHoursTypes,
          isPrimary: row.isPrimary,
          source: 'gbp',
          managedBy: 'gbp',
          updatedAt: row.lastSyncedAt,
        })),
        serviceAreas: connection.businessInfo.serviceAreas.map((row) => ({
          id: row.id,
          displayName: row.displayName,
          areaType: row.areaType,
          regionCode: row.regionCode,
          placeData: row.placeData,
          source: 'gbp',
          managedBy: 'gbp',
          updatedAt: row.lastSyncedAt,
        })),
        attributes: connection.businessInfo.attributes.map((row) => ({
          id: row.id,
          attributeGroup: row.attributeGroup,
          attributeKey: row.attributeKey,
          attributeName: row.attributeName,
          attributeId: row.attributeId,
          displayName: row.displayName,
          displayText: row.displayText,
          displayTextStandalone: row.displayTextStandalone,
          displayTextNegative: row.displayTextNegative,
          valueType: row.valueType,
          boolValue: row.boolValue,
          textValue: row.textValue,
          uriValue: row.uriValue,
          uriValues: row.uriValues,
          enumValues: row.enumValues,
          unsetEnumValues: row.unsetEnumValues,
          valueMetadata: row.valueMetadata,
          source: 'gbp',
          managedBy: 'gbp',
          updatedAt: row.lastSyncedAt,
        })),
        serviceItems: connection.businessInfo.serviceItems.map((row) => ({
          id: row.id,
          itemKey: row.itemKey,
          itemType: row.itemType,
          displayName: row.displayName,
          description: row.description,
          payload: row.payload,
          source: 'gbp',
          managedBy: 'gbp',
          updatedAt: row.lastSyncedAt,
        })),
      },
    };
  }

  async updateBusinessContext(
    restaurantId: string,
    payload: UpdateRestaurantBusinessContextInput,
  ): Promise<RestaurantBusinessContextSnapshot> {
    const snapshot = getRestaurantSnapshot(this.state, restaurantId);
    const now = new Date().toISOString();

    if (payload.categories) {
      snapshot.businessContext.categories = payload.categories.map((row, index) => ({
        id: row.id ?? `core-category-${index + 1}`,
        displayName: row.displayName,
        categoryCode: row.categoryCode ?? null,
        moreHoursTypes: row.moreHoursTypes ?? [],
        isPrimary: row.isPrimary ?? false,
        source: 'nabatable',
        managedBy: 'nabatable',
        updatedAt: now,
      }));
    }

    if (payload.serviceAreas) {
      snapshot.businessContext.serviceAreas = payload.serviceAreas.map((row, index) => ({
        id: row.id ?? `core-service-area-${index + 1}`,
        displayName: row.displayName,
        areaType: row.areaType ?? 'region',
        regionCode: row.regionCode ?? null,
        placeData: row.placeData ?? null,
        source: 'nabatable',
        managedBy: 'nabatable',
        updatedAt: now,
      }));
    }

    if (payload.attributes) {
      snapshot.businessContext.attributes = payload.attributes.map((row, index) => ({
        id: row.id ?? `core-attribute-${index + 1}`,
        attributeGroup: row.attributeGroup ?? null,
        attributeKey: row.attributeKey,
        attributeName: row.attributeName ?? null,
        attributeId: row.attributeId ?? null,
        displayName: row.displayName ?? null,
        displayText: row.displayText ?? null,
        displayTextStandalone: row.displayTextStandalone ?? null,
        displayTextNegative: row.displayTextNegative ?? null,
        valueType: row.valueType,
        boolValue: row.boolValue ?? null,
        textValue: row.textValue ?? null,
        uriValue: row.uriValue ?? null,
        uriValues: row.uriValues ?? [],
        enumValues: row.enumValues ?? [],
        unsetEnumValues: row.unsetEnumValues ?? [],
        valueMetadata: row.valueMetadata ?? [],
        source: 'nabatable',
        managedBy: 'nabatable',
        updatedAt: now,
      }));
    }

    if (payload.serviceItems) {
      snapshot.businessContext.serviceItems = payload.serviceItems.map((row, index) => ({
        id: row.id ?? `core-service-item-${index + 1}`,
        itemKey: row.itemKey,
        itemType: row.itemType ?? null,
        displayName: row.displayName ?? null,
        description: row.description ?? null,
        payload: row.payload ?? null,
        source: 'nabatable',
        managedBy: 'nabatable',
        updatedAt: now,
      }));
    }

    return this.getBusinessContext(restaurantId);
  }

  async syncProfileWithGoogleBusinessProfile(
    restaurantId: string,
    payload: GoogleBusinessProfileProfileSyncPayload,
  ) {
    const snapshot = getRestaurantSnapshot(this.state, restaurantId);
    const connection = await this.getGoogleBusinessProfileConnection();

    if (payload.direction !== 'pull_from_gbp') {
      return snapshot.profile;
    }

    const selectedFields = payload.fields ?? [
      'name',
      'contactPhone',
      'address',
      'googleMapUrl',
      'googleReviewUrl',
    ];
    const primaryAddress =
      connection.businessInfo.addresses.find((address) => address.isPrimary) ??
      connection.businessInfo.addresses[0];
    const primaryPhone =
      connection.businessInfo.phoneNumbers.find((phone) => phone.isPrimary) ??
      connection.businessInfo.phoneNumbers[0];
    const googleMapLink = connection.businessInfo.links.find(
      (link) => link.linkType === 'google_map',
    );
    const googleReviewLink = connection.businessInfo.links.find(
      (link) => link.linkType === 'google_review',
    );

    snapshot.profile = {
      ...snapshot.profile,
      ...(selectedFields.includes('name')
        ? { name: connection.externalLocationTitle ?? snapshot.profile.name }
        : {}),
      ...(selectedFields.includes('contactPhone')
        ? { contactPhone: primaryPhone?.phoneNumber ?? snapshot.profile.contactPhone }
        : {}),
      ...(selectedFields.includes('address')
        ? { address: primaryAddress?.formattedAddress ?? snapshot.profile.address }
        : {}),
      ...(selectedFields.includes('googleMapUrl')
        ? { googleMapUrl: googleMapLink?.url ?? snapshot.profile.googleMapUrl }
        : {}),
      ...(selectedFields.includes('googleReviewUrl')
        ? { googleReviewUrl: googleReviewLink?.url ?? snapshot.profile.googleReviewUrl }
        : {}),
      updatedAt: new Date().toISOString(),
    };

    return snapshot.profile;
  }

  async getOperatingHours(restaurantId: string) {
    return getRestaurantSnapshot(this.state, restaurantId).hours;
  }

  async updateOperatingHours(restaurantId: string, snapshot: OperatingHoursSnapshot) {
    const restaurant = getRestaurantSnapshot(this.state, restaurantId);
    restaurant.hours = snapshot;
    return restaurant.hours;
  }

  async syncOperatingHoursWithGoogleBusinessProfile(
    restaurantId: string,
    _payload: GoogleBusinessProfileOperatingHoursSyncPayload,
  ) {
    return getRestaurantSnapshot(this.state, restaurantId).hours;
  }

  async getServicePeriods(restaurantId: string) {
    return getRestaurantSnapshot(this.state, restaurantId).servicePeriods;
  }

  async updateServicePeriods(restaurantId: string, rows: ServicePeriodRow[]) {
    const restaurant = getRestaurantSnapshot(this.state, restaurantId);
    restaurant.servicePeriods = rows;
    return restaurant.servicePeriods;
  }

  async syncServicePeriodsWithGoogleBusinessProfile(
    restaurantId: string,
    _payload: GoogleBusinessProfileServicePeriodsSyncPayload,
  ) {
    return getRestaurantSnapshot(this.state, restaurantId).servicePeriods;
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
      groups: getRestaurantBookingEmailTemplateGroups().map<RestaurantEmailTemplateGroup>(
        (group) => ({
          key: group.key,
          title: group.title,
          description: group.description,
          templates: getRestaurantBookingEmailTemplateCatalog()
            .filter((definition) => definition.group === group.key)
            .map<RestaurantEmailTemplate>((definition) => {
              const variants = buildEditableTemplateVariants(
                definition.key,
                restaurant.emailTemplates,
              );
              const defaultVariants = buildEditableTemplateVariants(definition.key, null);
              const status = restaurant.emailTemplates?.templates[definition.key]
                ? 'custom'
                : 'default';
              return {
                key: definition.key,
                title: definition.title,
                description: definition.description,
                groupKey: definition.group,
                supportsCtaLabel: definition.supportsCtaLabel,
                availableVariables: [
                  '{{name}}',
                  '{{firstName}}',
                  '{{venue}}',
                  '{{date}}',
                  '{{time}}',
                  '{{party}}',
                ],
                recommendedVariables: definition.recommendedVariables.map((key) => `{{${key}}}`),
                authoringHints: [...definition.authoringHints],
                status,
                activeVariantCount: variants.filter((variant) => variant.isActive).length,
                variants,
                defaultVariants,
              };
            }),
        }),
      ),
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
      availableVariables: [
        '{{name}}',
        '{{firstName}}',
        '{{venue}}',
        '{{date}}',
        '{{time}}',
        '{{party}}',
      ],
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
      availableVariables: [
        '{{name}}',
        '{{firstName}}',
        '{{venue}}',
        '{{date}}',
        '{{time}}',
        '{{party}}',
      ],
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
    const response = await fetchJson<{
      restaurantId: string;
      preview: RestaurantEmailTemplatePreview;
    }>('/dev/api/restaurant-email-template-preview', {
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
    });

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

  async getGoogleBusinessProfileConnection(): Promise<GoogleBusinessProfileConnection> {
    const verification = {
      provider: 'google_business_profile',
      syncStatus: 'synced',
      isVerified: true,
      verifiedAt: '2026-04-18T10:30:00Z',
      verifiedBy: 'system',
      lastSyncedAt: '2026-04-18T10:30:00Z',
      lastCheckedAt: '2026-04-18T10:30:00Z',
    } as const;

    return {
      isConfigured: true,
      provider: 'google_business_profile',
      status: 'linked',
      connectedGoogleEmail: 'ops@nabatable.dev',
      connectedGoogleName: 'Nabatable Ops',
      externalAccountId: 'acc-demo-1',
      externalAccountName: 'accounts/123456789012345678901',
      externalLocationId: 'loc-demo-1',
      externalLocationName: 'locations/12345678901234567890',
      externalLocationTitle: 'Nabatable Demo Kitchen',
      externalPlaceId: 'ChIJN1t_tDeuEmsRUsoyG83frY4',
      lastPullAt: '2026-04-18T10:30:00Z',
      lastPushAt: null,
      lastError: null,
      availableLocations: [
        {
          accountName: 'accounts/123456789012345678901',
          accountId: 'acc-demo-1',
          accountDisplayName: 'Nabatable Demo Group',
          locationName: 'locations/12345678901234567890',
          locationId: 'loc-demo-1',
          title: 'Nabatable Demo Kitchen',
          addressText: '14 Market Street, Cambridge CB2 3QJ',
          placeId: 'ChIJN1t_tDeuEmsRUsoyG83frY4',
        },
        {
          accountName: 'accounts/123456789012345678901',
          accountId: 'acc-demo-1',
          accountDisplayName: 'Nabatable Demo Group',
          locationName: 'locations/22345678901234567890',
          locationId: 'loc-demo-2',
          title: 'Nabatable Riverside',
          addressText: '22 Riverside Walk, Cambridge CB5 8AD',
          placeId: 'ChIJW-T2Wt7uEmsRKl2I1CJFUsI',
        },
      ],
      businessInfo: {
        details: {
          businessName: 'Nabatable Demo Kitchen',
          description:
            'Contemporary British dining with a wood-fired grill, seasonal cocktails, and a fast-moving neighbourhood service.',
          languageCode: 'en-GB',
          openingDate: '2024-09-12',
          businessStatus: 'OPEN',
          isServiceAreaBusiness: false,
          canReopen: true,
          source: 'google_business_profile',
          managedBy: 'owner',
          lastSyncedAt: '2026-04-18T10:30:00Z',
          verification: {
            businessName: verification,
            description: verification,
            languageCode: verification,
            openingDate: verification,
            businessStatus: verification,
            isServiceAreaBusiness: verification,
            canReopen: verification,
          },
        },
        addresses: [
          {
            id: 'gbp-address-1',
            addressType: 'storefront',
            formattedAddress: '14 Market Street, Cambridge CB2 3QJ',
            addressLines: ['14 Market Street'],
            locality: 'Cambridge',
            administrativeArea: 'Cambridgeshire',
            postalCode: 'CB2 3QJ',
            regionCode: 'GB-ENG',
            countryCode: 'GB',
            languageCode: 'en-GB',
            sublocality: null,
            organization: null,
            sortingCode: null,
            recipients: [],
            latlng: {
              latitude: 52.2053,
              longitude: 0.1218,
            },
            isPrimary: true,
            lastSyncedAt: '2026-04-18T10:30:00Z',
            verificationStatus: verification,
          },
        ],
        phoneNumbers: [
          {
            id: 'gbp-phone-1',
            phoneKind: 'primary',
            phoneNumber: '+44 20 7946 0958',
            isPrimary: true,
            lastSyncedAt: '2026-04-18T10:30:00Z',
            verificationStatus: verification,
          },
        ],
        links: [
          {
            id: 'gbp-link-1',
            linkType: 'website',
            linkStatus: 'active',
            label: 'Website',
            url: 'https://nabatable.local/demo-kitchen',
            isPrimary: true,
            lastSyncedAt: '2026-04-18T10:30:00Z',
            verificationStatus: verification,
          },
          {
            id: 'gbp-link-2',
            linkType: 'menu',
            linkStatus: 'active',
            label: 'Menu',
            url: 'https://nabatable.local/demo-kitchen/menu',
            isPrimary: false,
            lastSyncedAt: '2026-04-18T10:30:00Z',
            verificationStatus: verification,
          },
          {
            id: 'gbp-link-3',
            linkType: 'google_map',
            linkStatus: 'active',
            label: 'Google Maps',
            url: 'https://maps.google.com/?cid=1234567890123456789',
            isPrimary: false,
            lastSyncedAt: '2026-04-18T10:30:00Z',
            verificationStatus: verification,
          },
          {
            id: 'gbp-link-4',
            linkType: 'google_review',
            linkStatus: 'active',
            label: 'Google Reviews',
            url: 'https://search.google.com/local/writereview?placeid=ChIJN1t_tDeuEmsRUsoyG83frY4',
            isPrimary: false,
            lastSyncedAt: '2026-04-18T10:30:00Z',
            verificationStatus: verification,
          },
        ],
        categories: [
          {
            id: 'gbp-category-1',
            displayName: 'Restaurant',
            categoryCode: 'restaurant',
            moreHoursTypes: [
              {
                hoursTypeId: 'KITCHEN',
                displayName: 'Kitchen',
                localizedDisplayName: 'Kitchen',
              },
            ],
            isPrimary: true,
            lastSyncedAt: '2026-04-18T10:30:00Z',
            verificationStatus: verification,
          },
          {
            id: 'gbp-category-2',
            displayName: 'Cocktail Bar',
            categoryCode: 'cocktail_bar',
            moreHoursTypes: [],
            isPrimary: false,
            lastSyncedAt: '2026-04-18T10:30:00Z',
            verificationStatus: verification,
          },
        ],
        serviceAreas: [],
        hours: [
          {
            id: 'gbp-hours-1',
            hoursType: 'public',
            periodLabel: null,
            periodCode: null,
            openDay: 1,
            closeDay: 1,
            startDate: null,
            endDate: null,
            openTime: '12:00',
            closeTime: '22:00',
            isClosed: false,
            lastSyncedAt: '2026-04-18T10:30:00Z',
            verificationStatus: verification,
          },
          {
            id: 'gbp-hours-2',
            hoursType: 'public',
            periodLabel: null,
            periodCode: null,
            openDay: 2,
            closeDay: 2,
            startDate: null,
            endDate: null,
            openTime: '12:00',
            closeTime: '22:00',
            isClosed: false,
            lastSyncedAt: '2026-04-18T10:30:00Z',
            verificationStatus: verification,
          },
          {
            id: 'gbp-hours-3',
            hoursType: 'service',
            periodLabel: 'Kitchen',
            periodCode: 'KITCHEN',
            openDay: 5,
            closeDay: 5,
            startDate: null,
            endDate: null,
            openTime: '11:30',
            closeTime: '22:30',
            isClosed: false,
            lastSyncedAt: '2026-04-18T10:30:00Z',
            verificationStatus: verification,
          },
          {
            id: 'gbp-hours-4',
            hoursType: 'special',
            periodLabel: null,
            periodCode: null,
            openDay: null,
            closeDay: null,
            startDate: '2026-05-05',
            endDate: '2026-05-05',
            openTime: '12:00',
            closeTime: '23:30',
            isClosed: false,
            lastSyncedAt: '2026-04-18T10:30:00Z',
            verificationStatus: verification,
          },
        ],
        attributes: [
          {
            id: 'gbp-attr-1',
            attributeGroup: 'Amenities',
            attributeKey: 'outdoor_seating',
            attributeName: 'locations/123/attributes/outdoor_seating',
            attributeId: 'outdoor_seating',
            displayName: 'Outdoor seating',
            displayText: 'Outdoor seating: Yes',
            displayTextStandalone: 'Outdoor seating',
            displayTextNegative: 'No outdoor seating',
            valueType: 'boolean',
            boolValue: true,
            textValue: null,
            uriValue: null,
            uriValues: [],
            enumValues: [],
            unsetEnumValues: [],
            valueMetadata: [],
            lastSyncedAt: '2026-04-18T10:30:00Z',
            verificationStatus: verification,
          },
          {
            id: 'gbp-attr-2',
            attributeGroup: 'Dining options',
            attributeKey: 'reservations',
            attributeName: 'locations/123/attributes/reservations',
            attributeId: 'reservations',
            displayName: 'Reservations',
            displayText: 'Reservations required',
            displayTextStandalone: 'Reservations required',
            displayTextNegative: null,
            valueType: 'text',
            boolValue: null,
            textValue: 'Recommended for peak dinner service',
            uriValue: null,
            uriValues: [],
            enumValues: [],
            unsetEnumValues: [],
            valueMetadata: [],
            lastSyncedAt: '2026-04-18T10:30:00Z',
            verificationStatus: verification,
          },
        ],
        serviceItems: [
          {
            id: 'gbp-service-item-1',
            itemKey: 'private_dining',
            itemType: 'service',
            displayName: 'Private dining',
            description: 'Semi-private events and group dining packages.',
            payload: {
              structuredServiceItemId: 'private_dining',
              displayName: 'Private dining',
              description: 'Semi-private events and group dining packages.',
            },
            lastSyncedAt: '2026-04-18T10:30:00Z',
            verificationStatus: verification,
          },
        ],
        coreNormalization: {
          operatingHours: {
            source: 'public',
            matchStatus: 'drifted',
            summary:
              'GBP public hours normalize cleanly, but Friday and weekend rows still differ from the current core schedule.',
            warnings: ['Friday closes 30 minutes earlier in GBP than in core.'],
            weekly: [
              {
                dayOfWeek: 0,
                opensAt: '12:00',
                closesAt: '21:00',
                isClosed: false,
                matchesCore: false,
              },
              {
                dayOfWeek: 1,
                opensAt: '12:00',
                closesAt: '22:00',
                isClosed: false,
                matchesCore: true,
              },
              {
                dayOfWeek: 2,
                opensAt: '12:00',
                closesAt: '22:00',
                isClosed: false,
                matchesCore: true,
              },
              {
                dayOfWeek: 3,
                opensAt: '12:00',
                closesAt: '22:00',
                isClosed: false,
                matchesCore: true,
              },
              {
                dayOfWeek: 4,
                opensAt: '12:00',
                closesAt: '22:00',
                isClosed: false,
                matchesCore: true,
              },
              {
                dayOfWeek: 5,
                opensAt: '11:30',
                closesAt: '22:30',
                isClosed: false,
                matchesCore: false,
              },
              {
                dayOfWeek: 6,
                opensAt: '11:30',
                closesAt: '21:30',
                isClosed: false,
                matchesCore: true,
              },
            ],
            overrides: [
              {
                effectiveDate: '2026-05-05',
                opensAt: '12:00',
                closesAt: '23:30',
                isClosed: false,
                matchesCore: false,
              },
            ],
          },
          servicePeriods: {
            source: 'more_hours',
            matchStatus: 'partial',
            summary:
              'Kitchen more-hours infer usable lunch and dinner windows for most days, but Sunday dinner still needs manual confirmation.',
            warnings: ['Sunday has only one broad kitchen window, so dinner remains inferred.'],
            periods: [
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
                matchesCore: true,
              },
              {
                bookingOption: 'lunch',
                name: 'Lunch',
                dayOfWeek: 5,
                startTime: '11:30',
                endTime: '15:00',
                matchesCore: true,
              },
              {
                bookingOption: 'dinner',
                name: 'Dinner',
                dayOfWeek: 5,
                startTime: '17:00',
                endTime: '22:30',
                matchesCore: false,
              },
              {
                bookingOption: 'lunch',
                name: 'Lunch',
                dayOfWeek: 6,
                startTime: '11:30',
                endTime: '15:00',
                matchesCore: true,
              },
            ],
          },
          bookingHours: {
            matchStatus: 'partial',
            summary:
              'GBP informs the outer booking envelope, but booking rules still depend on Nabatable-only duration and slot settings.',
            warnings: [
              'Reservation interval and last-seating rules are still verified from core settings only.',
            ],
            missingInputs: ['reservation interval minutes', 'last seating buffer'],
          },
        },
      },
    };
  }

  async getGoogleBusinessProfileWorkflow(): Promise<GoogleBusinessProfileWorkflow> {
    const connection = await this.getGoogleBusinessProfileConnection();
    const fetchedAt = '2026-04-25T09:30:00.000Z';
    return {
      latestDraft: {
        id: 'dev-gbp-draft-review',
        status: 'review_ready',
        fetchedAt,
        approvedAt: null,
        publishedAt: null,
        staleSections: [],
        conflictMetadata: {},
        selectedApprovals: {
          'profile.name': true,
          'operatingHours.weekly.0': true,
          'servicePeriods.2.dinner': false,
        },
        sourceSnapshotRefs: { lastPullAt: connection.lastPullAt },
        coreSnapshotHashes: {},
        createdAt: fetchedAt,
        updatedAt: fetchedAt,
        sectionDiffs: [
          {
            sectionKey: 'profile',
            label: 'Profile, contact and links',
            status: 'ready',
            summary: '1 of 2 changes selected.',
            canPublishToNabatable: true,
            canPushToGoogle: true,
            blockedReasons: [],
            items: [
              {
                fieldKey: 'profile.name',
                label: 'Business name',
                sectionKey: 'profile',
                currentValue: 'Nabatable Demo',
                providerValue: 'Nabatable Demo Cafe',
                proposedValue: 'Nabatable Demo Cafe',
                direction: 'pull_from_gbp',
                status: 'ready',
                selected: true,
                canPublishToNabatable: true,
                canPushToGoogle: true,
                warnings: [],
              },
              {
                fieldKey: 'profile.contactPhone',
                label: 'Primary phone',
                sectionKey: 'profile',
                currentValue: '+44 1223 555010',
                providerValue: '+44 1223 555010',
                proposedValue: '+44 1223 555010',
                direction: 'pull_from_gbp',
                status: 'unchanged',
                selected: false,
                canPublishToNabatable: true,
                canPushToGoogle: true,
                warnings: [],
              },
            ],
          },
          {
            sectionKey: 'operatingHours',
            label: 'Operating hours',
            status: 'ready',
            summary: '1 weekly change ready.',
            canPublishToNabatable: true,
            canPushToGoogle: true,
            blockedReasons: [],
            items: [
              {
                fieldKey: 'operatingHours.weekly.0',
                label: 'Weekly day 0',
                sectionKey: 'operatingHours',
                currentValue: '09:00–17:00',
                providerValue: '10:00–18:00',
                proposedValue: '10:00–18:00',
                direction: 'pull_from_gbp',
                status: 'ready',
                selected: true,
                canPublishToNabatable: true,
                canPushToGoogle: true,
                warnings: ['Sunday opening is one hour later than current.'],
              },
              {
                fieldKey: 'operatingHours.weekly.1',
                label: 'Weekly day 1',
                sectionKey: 'operatingHours',
                currentValue: '09:00–17:00',
                providerValue: '09:00–17:00',
                proposedValue: '09:00–17:00',
                direction: 'pull_from_gbp',
                status: 'unchanged',
                selected: false,
                canPublishToNabatable: true,
                canPushToGoogle: true,
                warnings: [],
              },
            ],
          },
          {
            sectionKey: 'businessContext.serviceItems',
            label: 'Service items',
            status: 'ready',
            summary: '1 service window suggestion.',
            canPublishToNabatable: true,
            canPushToGoogle: false,
            blockedReasons: [],
            items: [
              {
                fieldKey: 'servicePeriods.2.dinner',
                label: 'dinner day 2',
                sectionKey: 'businessContext.serviceItems',
                currentValue: '17:00–22:00',
                providerValue: '18:00–22:00',
                proposedValue: '18:00–22:00',
                direction: 'pull_from_gbp',
                status: 'ready',
                selected: false,
                canPublishToNabatable: true,
                canPushToGoogle: false,
                warnings: [],
              },
            ],
          },
          {
            sectionKey: 'businessContext.attributes',
            label: 'Attributes',
            status: 'unchanged',
            summary: 'No attribute changes.',
            canPublishToNabatable: true,
            canPushToGoogle: true,
            blockedReasons: [],
            items: [],
          },
        ],
      },
      sectionSummaries: [
        {
          sectionKey: 'profile',
          label: 'Profile, contact and links',
          status: 'ready',
          selectedCount: 1,
          itemCount: 2,
        },
        {
          sectionKey: 'operatingHours',
          label: 'Operating hours',
          status: 'ready',
          selectedCount: 1,
          itemCount: 2,
        },
      ],
      publishableSections: ['profile', 'operatingHours'],
      blockedReasons: [],
      auditEvents: [
        {
          id: 'dev-gbp-event-recent',
          draftId: 'dev-gbp-draft-review',
          direction: 'pull_from_gbp_to_nabatable',
          flow: 'google_to_nabatable_apply',
          directionLabel: 'Google -> Nabatable apply',
          affectedSections: ['profile'],
          googleUpdateMasks: [],
          result: 'success',
          errors: [],
          createdAt: '2026-04-24T16:00:00.000Z',
        },
      ],
      activePublishJob: null,
    };
  }

  async createGoogleBusinessProfileDraft(): Promise<GoogleBusinessProfileWorkflow> {
    const connection = await this.getGoogleBusinessProfileConnection();
    const now = new Date().toISOString();
    return {
      latestDraft: {
        id: 'dev-gbp-draft-1',
        status: 'review_ready',
        fetchedAt: now,
        approvedAt: null,
        publishedAt: null,
        staleSections: [],
        conflictMetadata: {},
        selectedApprovals: {
          'profile.name': true,
          'profile.contactPhone': true,
        },
        sourceSnapshotRefs: { lastPullAt: connection.lastPullAt },
        coreSnapshotHashes: {},
        createdAt: now,
        updatedAt: now,
        sectionDiffs: [
          {
            sectionKey: 'profile',
            label: 'Profile, contact and links',
            status: 'ready',
            summary: '2 approval items ready.',
            canPublishToNabatable: true,
            canPushToGoogle: true,
            blockedReasons: [],
            items: [
              {
                fieldKey: 'profile.name',
                label: 'Business name',
                sectionKey: 'profile',
                currentValue: 'Nabatable Demo',
                providerValue: connection.externalLocationTitle,
                proposedValue: connection.externalLocationTitle,
                direction: 'pull_from_gbp',
                status: 'ready',
                selected: true,
                canPublishToNabatable: true,
                canPushToGoogle: true,
                warnings: [],
              },
              {
                fieldKey: 'profile.contactPhone',
                label: 'Primary phone',
                sectionKey: 'profile',
                currentValue: '+44 7700 900123',
                providerValue: '+44 1223 555010',
                proposedValue: '+44 1223 555010',
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
      sectionSummaries: [
        {
          sectionKey: 'profile',
          label: 'Profile, contact and links',
          status: 'ready',
          selectedCount: 2,
          itemCount: 2,
        },
      ],
      publishableSections: ['profile'],
      blockedReasons: [],
      auditEvents: [],
      activePublishJob: null,
    };
  }

  async updateGoogleBusinessProfileDraft(
    _restaurantId: string,
    _draftId: string,
    _payload: GoogleBusinessProfileDraftPatchPayload,
  ): Promise<GoogleBusinessProfileWorkflow> {
    return this.createGoogleBusinessProfileDraft();
  }

  async preflightGoogleBusinessProfileDraftPublish(
    _restaurantId: string,
    draftId: string,
    payload: GoogleBusinessProfileDraftPublishPreflightPayload,
  ): Promise<GoogleBusinessProfileDraftPublishPreflight> {
    const workflow = await this.createGoogleBusinessProfileDraft();
    const selectedItems =
      workflow.latestDraft?.sectionDiffs.flatMap((section) =>
        section.items.filter((item) => payload.selectedApprovals[item.fieldKey]),
      ) ?? [];
    const directionIntent = resolvePublishDirectionIntent(payload);
    const wantsGoogleSync = directionIntent !== 'google_to_nabatable';
    const isGoogleOnly = directionIntent === 'nabatable_to_google';
    const googleUpdateMasks: GoogleBusinessProfileDraftPublishPreflight['googleUpdateMasks'] =
      wantsGoogleSync ? ['title', 'phoneNumbers'] : [];
    return {
      publishJobId: 'dev-gbp-publish-job-1',
      idempotencyKey: `dev-${draftId}-${wantsGoogleSync ? 'google' : 'nabatable'}`,
      mode: isGoogleOnly
        ? 'google_only'
        : wantsGoogleSync
          ? 'nabatable_and_google'
          : 'nabatable_only',
      directionIntent,
      selectedApprovals: payload.selectedApprovals,
      nabatableUpdates: isGoogleOnly ? [] : selectedItems,
      pullOnlyItems: wantsGoogleSync
        ? selectedItems.filter((item) => !item.canPushToGoogle)
        : selectedItems,
      googleUpdateMasks,
      warnings: [],
      errors: [],
      canPublish: selectedItems.length > 0,
      canPushToGoogle: googleUpdateMasks.length > 0,
      activePublishJob: {
        id: 'dev-gbp-publish-job-1',
        draftId,
        idempotencyKey: `dev-${draftId}-${wantsGoogleSync ? 'google' : 'nabatable'}`,
        mode: isGoogleOnly
          ? 'google_only'
          : wantsGoogleSync
            ? 'nabatable_and_google'
            : 'nabatable_only',
        directionIntent,
        status: 'preflight_ready',
        selectedApprovals: payload.selectedApprovals,
        nabatableSections: ['profile'],
        googleUpdateMasks,
        postNabatableCoreHashes: {},
        errorClassification: null,
        errors: [],
        nabatableEventId: null,
        googleEventId: null,
        canRetryGooglePush: false,
        retryBlockedReason: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    };
  }

  async publishGoogleBusinessProfileDraft(
    _restaurantId: string,
    _draftId: string,
    _payload: GoogleBusinessProfileDraftPublishPayload,
  ): Promise<GoogleBusinessProfileWorkflow> {
    const workflow = await this.createGoogleBusinessProfileDraft();
    if (workflow.latestDraft) {
      workflow.latestDraft.status = 'published';
      workflow.latestDraft.publishedAt = new Date().toISOString();
    }
    workflow.auditEvents = [
      {
        id: 'dev-gbp-event-1',
        draftId: workflow.latestDraft?.id ?? null,
        direction: 'pull_from_gbp_to_nabatable',
        flow: 'google_to_nabatable_apply',
        directionLabel: 'Google -> Nabatable apply',
        affectedSections: ['profile'],
        googleUpdateMasks: [],
        result: 'success',
        errors: [],
        createdAt: new Date().toISOString(),
      },
    ];
    return workflow;
  }

  async retryGoogleBusinessProfileDraftGooglePush(): Promise<GoogleBusinessProfileWorkflow> {
    const workflow = await this.createGoogleBusinessProfileDraft();
    if (workflow.latestDraft) {
      workflow.latestDraft.status = 'published';
      workflow.latestDraft.publishedAt = new Date().toISOString();
    }
    workflow.activePublishJob = null;
    return workflow;
  }

  async linkGoogleBusinessProfileLocation(
    _restaurantId: string,
    _payload: LinkGoogleBusinessProfileLocationInput,
  ): Promise<GoogleBusinessProfileConnection> {
    return this.getGoogleBusinessProfileConnection();
  }

  async disconnectGoogleBusinessProfileConnection(): Promise<GoogleBusinessProfileConnection> {
    return this.getGoogleBusinessProfileConnection();
  }

  async syncGoogleBusinessProfileBusinessInfo(
    _restaurantId: string,
    _payload: GoogleBusinessProfileProtectedActionPayload,
  ): Promise<GoogleBusinessProfileConnection> {
    return this.getGoogleBusinessProfileConnection();
  }
}

export function createDevRestaurantService(): RestaurantService {
  return new DevRestaurantService();
}
