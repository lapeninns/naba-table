import { DEV_RESTAURANT_ID } from '../devIds';


import type {
  OperatingHoursSnapshot,
  RestaurantProfile,
  RestaurantService,
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

  return { profile, hours, servicePeriods, turnBands };
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
      [primaryRestaurant.profile.id]: primaryRestaurant,
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
}

export function createDevRestaurantService(): RestaurantService {
  return new DevRestaurantService();
}
