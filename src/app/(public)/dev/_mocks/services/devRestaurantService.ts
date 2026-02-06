import { DEV_RESTAURANT_ID } from '../devIds';


import type {
  OperatingHoursSnapshot,
  RestaurantProfile,
  RestaurantService,
  ServicePeriodRow,
  TurnBandsPayload,
  TurnBandsSnapshot,
} from '@/services/ops/restaurants';


type MutableState = {
  profile: RestaurantProfile;
  hours: OperatingHoursSnapshot;
  servicePeriods: ServicePeriodRow[];
  turnBands: TurnBandsSnapshot;
};

function buildInitialState(): MutableState {
  const profile: RestaurantProfile = {
    id: DEV_RESTAURANT_ID,
    name: 'Dev Restaurant (Ops Harness)',
    slug: 'dev-restaurant',
    timezone: 'Europe/London',
    capacity: 90,
    contactEmail: 'ops@example.com',
    contactPhone: '+44 7700 900123',
    address: '1 Example Street, London',
    googleMapUrl: null,
    googleReviewUrl: null,
    bookingPolicy:
      'Please arrive on time. Late arrivals may lose their table after a short grace period.',
    logoUrl: null,
    emailSendReminder24h: true,
    emailSendReminderShort: true,
    emailSendReviewRequest: true,
    reservationIntervalMinutes: 15,
    reservationDefaultDurationMinutes: 90,
    reservationLastSeatingBufferMinutes: 15,
    reservationLifecycleGraceMinutes: 15,
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
    restaurantId: DEV_RESTAURANT_ID,
    bands: payload,
    defaults: payload,
  };

  return { profile, hours, servicePeriods, turnBands };
}

export class DevRestaurantService implements RestaurantService {
  private state: MutableState;

  constructor() {
    this.state = buildInitialState();
  }

  listRestaurants: RestaurantService['listRestaurants'] = async () => [
    {
      id: this.state.profile.id,
      name: this.state.profile.name,
      slug: this.state.profile.slug,
      timezone: this.state.profile.timezone,
      address: this.state.profile.address,
      role: 'owner',
    },
  ];

  async getProfile(restaurantId: string) {
    if (restaurantId !== this.state.profile.id) {
      throw new Error('[dev][restaurantService] unknown restaurant');
    }
    return this.state.profile;
  }

  async updateProfile(restaurantId: string, profile: Partial<RestaurantProfile>) {
    if (restaurantId !== this.state.profile.id) {
      throw new Error('[dev][restaurantService] unknown restaurant');
    }
    this.state.profile = { ...this.state.profile, ...profile };
    return this.state.profile;
  }

  async getOperatingHours(restaurantId: string) {
    if (restaurantId !== this.state.profile.id) {
      throw new Error('[dev][restaurantService] unknown restaurant');
    }
    return this.state.hours;
  }

  async updateOperatingHours(restaurantId: string, snapshot: OperatingHoursSnapshot) {
    if (restaurantId !== this.state.profile.id) {
      throw new Error('[dev][restaurantService] unknown restaurant');
    }
    this.state.hours = snapshot;
    return this.state.hours;
  }

  async getServicePeriods(restaurantId: string) {
    if (restaurantId !== this.state.profile.id) {
      throw new Error('[dev][restaurantService] unknown restaurant');
    }
    return this.state.servicePeriods;
  }

  async updateServicePeriods(restaurantId: string, rows: ServicePeriodRow[]) {
    if (restaurantId !== this.state.profile.id) {
      throw new Error('[dev][restaurantService] unknown restaurant');
    }
    this.state.servicePeriods = rows;
    return this.state.servicePeriods;
  }

  async getTurnBands(restaurantId: string) {
    if (restaurantId !== this.state.profile.id) {
      throw new Error('[dev][restaurantService] unknown restaurant');
    }
    return this.state.turnBands;
  }

  async updateTurnBands(restaurantId: string, payload: TurnBandsPayload) {
    if (restaurantId !== this.state.profile.id) {
      throw new Error('[dev][restaurantService] unknown restaurant');
    }
    this.state.turnBands = {
      restaurantId,
      bands: payload,
      defaults: this.state.turnBands.defaults,
    };
    return this.state.turnBands;
  }
}

export function createDevRestaurantService(): RestaurantService {
  return new DevRestaurantService();
}
