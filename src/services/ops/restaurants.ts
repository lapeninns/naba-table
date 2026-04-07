import { fetchJson } from '@/lib/http/fetchJson';
import { DEFAULT_RESERVATION_LIFECYCLE_GRACE_MINUTES } from '@/lib/restaurants/defaults';
import { DEFAULT_RESERVATION_INTERVAL_MINUTES } from '@reserve/shared/config/reservations';

import type { RestaurantRole } from '@/lib/owner/auth/roles';
import type { RestaurantBookingEmailTemplateKey, RestaurantEmailTemplateVariant } from '@/lib/restaurants/email-templates';
import type { OpsRestaurantOption, OpsServiceError } from '@/types/ops';
import type { OccasionKey } from '@reserve/shared/occasions';

export const OPS_RESTAURANTS_BASE = '/api/ops/restaurants';

type RestaurantsListResponse = {
  items: Array<{
    id: string;
    name: string | null;
    slug: string | null;
    isActive?: boolean;
    timezone: string | null;
    capacity: number | null;
    contactEmail: string | null;
    contactPhone: string | null;
    address: string | null;
    googleMapUrl: string | null;
    googleReviewUrl: string | null;
    bookingPolicy: string | null;
    createdAt: string;
    updatedAt: string;
    role: RestaurantRole;
  }>;
  pageInfo: {
    page: number;
    pageSize: number;
    total: number;
    hasNext: boolean;
  };
};

type RestaurantResponse = {
  restaurant: {
    id: string;
    name: string | null;
    slug: string | null;
    isActive?: boolean;
    timezone: string | null;
    capacity: number | null;
    contactEmail: string | null;
    contactPhone: string | null;
    address: string | null;
    googleMapUrl: string | null;
    googleReviewUrl: string | null;
    bookingPolicy: string | null;
    logoUrl: string | null;
    emailSendReminder24h: boolean;
    emailSendReminderShort: boolean;
    emailSendReviewRequest: boolean;
    reservationIntervalMinutes: number | null;
    reservationDefaultDurationMinutes: number | null;
    reservationLastSeatingBufferMinutes: number | null;
    reservationLifecycleGraceMinutes: number | null;
    createdAt: string;
    updatedAt: string;
    role: RestaurantRole;
  };
};

type ServicePeriodsResponse = {
  restaurantId: string;
  periods: ServicePeriodRow[];
};

type TurnBandsResponse = {
  restaurantId: string;
  bands: TurnBandsPayload;
  defaults: TurnBandsPayload;
};

type EmailTemplatesResponse = {
  restaurantId: string;
  canEdit: boolean;
  groups: RestaurantEmailTemplateGroup[];
};

type EmailTemplateResponse = {
  restaurantId: string;
  canEdit: boolean;
  template: RestaurantEmailTemplate;
};

type EmailTemplatePreviewResponse = {
  restaurantId: string;
  preview: RestaurantEmailTemplatePreview;
};

export type SendTestEmailTemplateResponse = {
  ok: true;
  restaurantId: string;
  provider: 'resend' | 'mock';
  messageId: string;
  preview: RestaurantEmailTemplatePreview;
};

export type RestaurantProfile = {
  id: string;
  name: string;
  slug: string | null;
  isActive?: boolean;
  timezone: string | null;
  capacity: number | null;
  contactEmail: string | null;
  contactPhone: string | null;
  address: string | null;
  googleMapUrl: string | null;
  googleReviewUrl: string | null;
  bookingPolicy: string | null;
  logoUrl: string | null;
  emailSendReminder24h: boolean;
  emailSendReminderShort: boolean;
  emailSendReviewRequest: boolean;
  reservationIntervalMinutes: number;
  reservationDefaultDurationMinutes: number;
  reservationLastSeatingBufferMinutes: number;
  reservationLifecycleGraceMinutes: number;
};

export type OperatingHoursRow = {
  dayOfWeek: number;
  opensAt: string | null;
  closesAt: string | null;
  isClosed: boolean;
  notes: string | null;
  reservationIntervalMinutes?: number | null;
  reservationSlotTimes?: string[] | null;
};

export type OperatingHoursOverride = {
  id?: string;
  effectiveDate: string;
  opensAt: string | null;
  closesAt: string | null;
  isClosed: boolean;
  notes: string | null;
  reservationIntervalMinutes?: number | null;
  reservationSlotTimes?: string[] | null;
};

export type OperatingHoursSnapshot = {
  weekly: OperatingHoursRow[];
  overrides: OperatingHoursOverride[];
};

export type ServicePeriodRow = {
  id?: string;
  name: string;
  dayOfWeek: number | null;
  startTime: string;
  endTime: string;
  bookingOption: OccasionKey;
};

export type TurnBandInput = {
  maxPartySize: number;
  durationMinutes: number;
};

export type TurnBandsPayload = Record<string, TurnBandInput[]>;

export type TurnBandsSnapshot = {
  restaurantId: string;
  bands: TurnBandsPayload;
  defaults: TurnBandsPayload;
};

export type RestaurantEmailTemplate = {
  key: RestaurantBookingEmailTemplateKey;
  title: string;
  description: string;
  groupKey: string;
  supportsCtaLabel: boolean;
  availableVariables: string[];
  recommendedVariables: string[];
  authoringHints: string[];
  status: 'default' | 'custom';
  activeVariantCount: number;
  variants: RestaurantEmailTemplateVariant[];
  defaultVariants: RestaurantEmailTemplateVariant[];
};

export type RestaurantEmailTemplateGroup = {
  key: string;
  title: string;
  description: string;
  templates: RestaurantEmailTemplate[];
};

export type RestaurantEmailTemplatesSnapshot = {
  restaurantId: string;
  canEdit: boolean;
  groups: RestaurantEmailTemplateGroup[];
};

export type RestaurantEmailTemplatePreview = {
  templateKey: RestaurantBookingEmailTemplateKey;
  selectedVariantId: string;
  selectedVariantName: string;
  preheader: string;
  headline: string;
  intro: string;
  cue: string;
  ask: string;
  ctaLabel: string;
  ctaUrl: string;
  subject: string;
  html: string;
  text: string;
};

export type PreviewEmailTemplateInput = {
  preferredVariantId?: string;
  variants?: RestaurantEmailTemplateVariant[];
};

export type SendTestEmailTemplateInput = PreviewEmailTemplateInput & {
  toEmail: string;
};

export interface RestaurantService {
  listRestaurants(): Promise<Array<OpsRestaurantOption & { role: RestaurantRole }>>;
  getProfile(restaurantId: string): Promise<RestaurantProfile>;
  updateProfile(restaurantId: string, profile: Partial<RestaurantProfile>): Promise<RestaurantProfile>;
  getOperatingHours(restaurantId: string): Promise<OperatingHoursSnapshot>;
  updateOperatingHours(restaurantId: string, snapshot: OperatingHoursSnapshot): Promise<OperatingHoursSnapshot>;
  getServicePeriods(restaurantId: string): Promise<ServicePeriodRow[]>;
  updateServicePeriods(restaurantId: string, rows: ServicePeriodRow[]): Promise<ServicePeriodRow[]>;
  getTurnBands(restaurantId: string): Promise<TurnBandsSnapshot>;
  updateTurnBands(restaurantId: string, payload: TurnBandsPayload): Promise<TurnBandsSnapshot>;
  getEmailTemplates(restaurantId: string): Promise<RestaurantEmailTemplatesSnapshot>;
  updateEmailTemplate(
    restaurantId: string,
    templateKey: RestaurantBookingEmailTemplateKey,
    payload: { variants: RestaurantEmailTemplateVariant[] },
  ): Promise<RestaurantEmailTemplate>;
  resetEmailTemplate(
    restaurantId: string,
    templateKey: RestaurantBookingEmailTemplateKey,
  ): Promise<RestaurantEmailTemplate>;
  previewEmailTemplate(
    restaurantId: string,
    templateKey: RestaurantBookingEmailTemplateKey,
    payload?: PreviewEmailTemplateInput,
  ): Promise<RestaurantEmailTemplatePreview>;
  sendTestEmailTemplate(
    restaurantId: string,
    templateKey: RestaurantBookingEmailTemplateKey,
    payload: SendTestEmailTemplateInput,
  ): Promise<SendTestEmailTemplateResponse>;
}

export class NotImplementedRestaurantService implements RestaurantService {
  private error(message: string): never {
    throw new Error(`[ops][restaurantService] ${message}`);
  }

  listRestaurants(): Promise<Array<OpsRestaurantOption & { role: RestaurantRole }>> {
    this.error('listRestaurants not implemented');
  }

  getProfile(): Promise<RestaurantProfile> {
    this.error('getProfile not implemented');
  }

  updateProfile(): Promise<RestaurantProfile> {
    this.error('updateProfile not implemented');
  }

  getOperatingHours(): Promise<OperatingHoursSnapshot> {
    this.error('getOperatingHours not implemented');
  }

  updateOperatingHours(): Promise<OperatingHoursSnapshot> {
    this.error('updateOperatingHours not implemented');
  }

  getServicePeriods(): Promise<ServicePeriodRow[]> {
    this.error('getServicePeriods not implemented');
  }

  updateServicePeriods(): Promise<ServicePeriodRow[]> {
    this.error('updateServicePeriods not implemented');
  }

  getTurnBands(): Promise<TurnBandsSnapshot> {
    this.error('getTurnBands not implemented');
  }

  updateTurnBands(): Promise<TurnBandsSnapshot> {
    this.error('updateTurnBands not implemented');
  }

  getEmailTemplates(): Promise<RestaurantEmailTemplatesSnapshot> {
    this.error('getEmailTemplates not implemented');
  }

  updateEmailTemplate(): Promise<RestaurantEmailTemplate> {
    this.error('updateEmailTemplate not implemented');
  }

  resetEmailTemplate(): Promise<RestaurantEmailTemplate> {
    this.error('resetEmailTemplate not implemented');
  }

  previewEmailTemplate(): Promise<RestaurantEmailTemplatePreview> {
    this.error('previewEmailTemplate not implemented');
  }

  sendTestEmailTemplate(): Promise<SendTestEmailTemplateResponse> {
    this.error('sendTestEmailTemplate not implemented');
  }
}

export type RestaurantServiceFactory = () => RestaurantService;

export function createRestaurantService(factory?: RestaurantServiceFactory): RestaurantService {
  try {
    return factory ? factory() : createBrowserRestaurantService();
  } catch (error) {
    if (error instanceof Error) {
      console.error('[ops][restaurantService] failed to instantiate', error.message);
    }
    return new NotImplementedRestaurantService();
  }
}

export type RestaurantServiceError = OpsServiceError | Error;

function mapRestaurant(dto: RestaurantResponse['restaurant']): RestaurantProfile {
  return {
    id: dto.id,
    name: dto.name ?? 'Restaurant',
    slug: dto.slug ?? null,
    isActive: dto.isActive ?? true,
    timezone: dto.timezone ?? 'UTC',
    capacity: dto.capacity ?? null,
    contactEmail: dto.contactEmail ?? null,
    contactPhone: dto.contactPhone ?? null,
    address: dto.address ?? null,
    googleMapUrl: dto.googleMapUrl ?? null,
    googleReviewUrl: dto.googleReviewUrl ?? null,
    bookingPolicy: dto.bookingPolicy ?? null,
    logoUrl: dto.logoUrl ?? null,
    emailSendReminder24h: dto.emailSendReminder24h ?? true,
    emailSendReminderShort: dto.emailSendReminderShort ?? true,
    emailSendReviewRequest: dto.emailSendReviewRequest ?? true,
    reservationIntervalMinutes:
      dto.reservationIntervalMinutes ?? DEFAULT_RESERVATION_INTERVAL_MINUTES,
    reservationDefaultDurationMinutes: dto.reservationDefaultDurationMinutes ?? 90,
    reservationLastSeatingBufferMinutes: dto.reservationLastSeatingBufferMinutes ?? 15,
    reservationLifecycleGraceMinutes:
      dto.reservationLifecycleGraceMinutes ?? DEFAULT_RESERVATION_LIFECYCLE_GRACE_MINUTES,
  };
}

export function createBrowserRestaurantService(): RestaurantService {
  return {
    async listRestaurants() {
      const response = await fetchJson<RestaurantsListResponse>(`${OPS_RESTAURANTS_BASE}?page=1&pageSize=50`);
      return response.items.map((restaurant) => ({
        id: restaurant.id,
        name: restaurant.name ?? 'Restaurant',
        slug: restaurant.slug ?? null,
        isActive: restaurant.isActive ?? true,
        timezone: restaurant.timezone ?? 'UTC',
        address: restaurant.address ?? null,
        role: restaurant.role,
      }));
    },

    async getProfile(restaurantId: string) {
      const { restaurant } = await fetchJson<RestaurantResponse>(`${OPS_RESTAURANTS_BASE}/${restaurantId}`);
      return mapRestaurant(restaurant);
    },

    async updateProfile(restaurantId: string, profile: Partial<RestaurantProfile>) {
      const { restaurant } = await fetchJson<RestaurantResponse>(`${OPS_RESTAURANTS_BASE}/${restaurantId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(profile),
      });
      return mapRestaurant(restaurant);
    },

    async getOperatingHours(restaurantId: string) {
      return fetchJson<OperatingHoursSnapshot>(`${OPS_RESTAURANTS_BASE}/${restaurantId}/hours`);
    },

    async updateOperatingHours(restaurantId: string, snapshot: OperatingHoursSnapshot) {
      return fetchJson<OperatingHoursSnapshot>(`${OPS_RESTAURANTS_BASE}/${restaurantId}/hours`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(snapshot),
      });
    },

    async getServicePeriods(restaurantId: string) {
      const response = await fetchJson<ServicePeriodsResponse>(`${OPS_RESTAURANTS_BASE}/${restaurantId}/service-periods`);
      return response.periods;
    },

    async updateServicePeriods(restaurantId: string, rows: ServicePeriodRow[]) {
      const response = await fetchJson<ServicePeriodsResponse>(`${OPS_RESTAURANTS_BASE}/${restaurantId}/service-periods`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(rows),
      });
      return response.periods;
    },

    async getTurnBands(restaurantId: string) {
      return fetchJson<TurnBandsResponse>(`${OPS_RESTAURANTS_BASE}/${restaurantId}/turn-bands`);
    },

    async updateTurnBands(restaurantId: string, payload: TurnBandsPayload) {
      return fetchJson<TurnBandsResponse>(`${OPS_RESTAURANTS_BASE}/${restaurantId}/turn-bands`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
    },

    async getEmailTemplates(restaurantId: string) {
      return fetchJson<EmailTemplatesResponse>(`${OPS_RESTAURANTS_BASE}/${restaurantId}/email-templates`);
    },

    async updateEmailTemplate(restaurantId: string, templateKey: RestaurantBookingEmailTemplateKey, payload: { variants: RestaurantEmailTemplateVariant[] }) {
      const response = await fetchJson<EmailTemplateResponse>(
        `${OPS_RESTAURANTS_BASE}/${restaurantId}/email-templates/${templateKey}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        },
      );
      return response.template;
    },

    async resetEmailTemplate(restaurantId: string, templateKey: RestaurantBookingEmailTemplateKey) {
      const response = await fetchJson<EmailTemplateResponse>(
        `${OPS_RESTAURANTS_BASE}/${restaurantId}/email-templates/${templateKey}`,
        {
          method: 'DELETE',
        },
      );
      return response.template;
    },

    async previewEmailTemplate(
      restaurantId: string,
      templateKey: RestaurantBookingEmailTemplateKey,
      payload: PreviewEmailTemplateInput = {},
    ) {
      const response = await fetchJson<EmailTemplatePreviewResponse>(
        `${OPS_RESTAURANTS_BASE}/${restaurantId}/email-templates/${templateKey}/preview`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        },
      );
      return response.preview;
    },

    async sendTestEmailTemplate(
      restaurantId: string,
      templateKey: RestaurantBookingEmailTemplateKey,
      payload: SendTestEmailTemplateInput,
    ) {
      return fetchJson<SendTestEmailTemplateResponse>(
        `${OPS_RESTAURANTS_BASE}/${restaurantId}/email-templates/${templateKey}/test-send`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        },
      );
    },
  } satisfies RestaurantService;
}
