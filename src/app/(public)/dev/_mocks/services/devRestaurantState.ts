import { normalizeRestaurantEmailTemplatesDocument } from '@/lib/restaurants/email-templates';

import { DEV_RESTAURANT_ID } from '../devIds';

import type {
  OperatingHoursSnapshot,
  RestaurantProfile,
  ServicePeriodRow,
  TurnBandsPayload,
  TurnBandsSnapshot,
} from '@/services/ops/restaurants';

const SECOND_DEV_RESTAURANT_ID = '22222222-2222-4222-8222-222222222222';

export type RestaurantSnapshot = {
  profile: RestaurantProfile;
  hours: OperatingHoursSnapshot;
  servicePeriods: ServicePeriodRow[];
  turnBands: TurnBandsSnapshot;
  emailTemplates: ReturnType<typeof normalizeRestaurantEmailTemplatesDocument>;
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
    sundayRoastEnabled: overrides.sundayRoastEnabled ?? false,
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

  return {
    profile,
    hours,
    servicePeriods,
    turnBands: { restaurantId: profile.id, bands: payload, defaults: payload },
    emailTemplates: null,
  };
}

export class DevRestaurantState {
  protected readonly restaurants: Record<string, RestaurantSnapshot>;

  constructor() {
    const primary = buildRestaurantSnapshot({
      id: DEV_RESTAURANT_ID,
      name: 'Dev Restaurant (Ops Harness)',
      slug: 'dev-restaurant',
      timezone: 'Europe/London',
    });
    const secondary = buildRestaurantSnapshot({
      id: SECOND_DEV_RESTAURANT_ID,
      name: 'Second Dev Restaurant',
      slug: 'second-dev-restaurant',
      timezone: 'America/New_York',
      address: '2 Example Street, New York',
      contactEmail: 'second.ops@example.com',
    });
    this.restaurants = {
      [primary.profile.id]: {
        ...primary,
        emailTemplates: normalizeRestaurantEmailTemplatesDocument(null),
      },
      [secondary.profile.id]: secondary,
    };
  }

  protected getRestaurantSnapshot(restaurantId: string): RestaurantSnapshot {
    const snapshot = this.restaurants[restaurantId];
    if (!snapshot) {
      throw new Error('[dev][restaurantService] unknown restaurant');
    }
    return snapshot;
  }
}
