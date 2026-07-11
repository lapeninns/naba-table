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
    businessDescription: overrides.businessDescription ?? null,
    managerDailySummaryEnabled: overrides.managerDailySummaryEnabled ?? true,
    managerWhatsappEnabled: overrides.managerWhatsappEnabled ?? false,
    managerName: overrides.managerName ?? 'Sam',
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

  return { profile, hours, servicePeriods, turnBands, emailTemplates: null };
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

  private unimplemented<T extends (...args: unknown[]) => unknown>(name: string): T {
    return (async (..._args: unknown[]) => {
      throw new Error(`[dev][restaurantService] ${name} is not implemented`);
    }) as unknown as T;
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

  getBusinessContext =
    this.unimplemented<RestaurantService['getBusinessContext']>('getBusinessContext');
  updateBusinessContext =
    this.unimplemented<RestaurantService['updateBusinessContext']>('updateBusinessContext');
  syncProfileWithGoogleBusinessProfile = this.unimplemented<
    RestaurantService['syncProfileWithGoogleBusinessProfile']
  >('syncProfileWithGoogleBusinessProfile');

  async getOperatingHours(restaurantId: string) {
    return getRestaurantSnapshot(this.state, restaurantId).hours;
  }

  async updateOperatingHours(restaurantId: string, snapshot: OperatingHoursSnapshot) {
    const restaurant = getRestaurantSnapshot(this.state, restaurantId);
    restaurant.hours = snapshot;
    return restaurant.hours;
  }

  syncOperatingHoursWithGoogleBusinessProfile = this.unimplemented<
    RestaurantService['syncOperatingHoursWithGoogleBusinessProfile']
  >('syncOperatingHoursWithGoogleBusinessProfile');

  async getServicePeriods(restaurantId: string) {
    return getRestaurantSnapshot(this.state, restaurantId).servicePeriods;
  }

  async updateServicePeriods(restaurantId: string, rows: ServicePeriodRow[]) {
    const restaurant = getRestaurantSnapshot(this.state, restaurantId);
    restaurant.servicePeriods = rows;
    return restaurant.servicePeriods;
  }

  syncServicePeriodsWithGoogleBusinessProfile = this.unimplemented<
    RestaurantService['syncServicePeriodsWithGoogleBusinessProfile']
  >('syncServicePeriodsWithGoogleBusinessProfile');

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
          managerName: restaurant.profile.managerName,
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

  getGoogleBusinessProfileConnection = this.unimplemented<
    RestaurantService['getGoogleBusinessProfileConnection']
  >('getGoogleBusinessProfileConnection');
  getGoogleBusinessProfileAvailableLocations = this.unimplemented<
    RestaurantService['getGoogleBusinessProfileAvailableLocations']
  >('getGoogleBusinessProfileAvailableLocations');
  startGoogleBusinessProfileAuthorization = this.unimplemented<
    RestaurantService['startGoogleBusinessProfileAuthorization']
  >('startGoogleBusinessProfileAuthorization');
  getGoogleBusinessProfileWorkflow = this.unimplemented<
    RestaurantService['getGoogleBusinessProfileWorkflow']
  >('getGoogleBusinessProfileWorkflow');
  createGoogleBusinessProfileDraft = this.unimplemented<
    RestaurantService['createGoogleBusinessProfileDraft']
  >('createGoogleBusinessProfileDraft');
  updateGoogleBusinessProfileDraft = this.unimplemented<
    RestaurantService['updateGoogleBusinessProfileDraft']
  >('updateGoogleBusinessProfileDraft');
  preflightGoogleBusinessProfileDraftPublish = this.unimplemented<
    RestaurantService['preflightGoogleBusinessProfileDraftPublish']
  >('preflightGoogleBusinessProfileDraftPublish');
  publishGoogleBusinessProfileDraft = this.unimplemented<
    RestaurantService['publishGoogleBusinessProfileDraft']
  >('publishGoogleBusinessProfileDraft');
  retryGoogleBusinessProfileDraftGooglePush = this.unimplemented<
    RestaurantService['retryGoogleBusinessProfileDraftGooglePush']
  >('retryGoogleBusinessProfileDraftGooglePush');
  linkGoogleBusinessProfileLocation = this.unimplemented<
    RestaurantService['linkGoogleBusinessProfileLocation']
  >('linkGoogleBusinessProfileLocation');
  syncGoogleBusinessProfileBusinessInfo = this.unimplemented<
    RestaurantService['syncGoogleBusinessProfileBusinessInfo']
  >('syncGoogleBusinessProfileBusinessInfo');
  disconnectGoogleBusinessProfileConnection = this.unimplemented<
    RestaurantService['disconnectGoogleBusinessProfileConnection']
  >('disconnectGoogleBusinessProfileConnection');
}

export function createDevRestaurantService(): RestaurantService {
  return new DevRestaurantService();
}
