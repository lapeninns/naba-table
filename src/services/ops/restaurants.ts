import { fetchJson } from '@/lib/http/fetchJson';
import type { RestaurantRole } from '@/lib/owner/auth/roles';
import type { OpsRestaurantOption, OpsServiceError } from '@/types/ops';

const OPS_RESTAURANTS_BASE = '/api/ops/restaurants';
const OWNER_RESTAURANTS_BASE = '/api/owner/restaurants';

type RestaurantsListResponse = {
  items: Array<{
    id: string;
    name: string | null;
    slug: string | null;
    timezone: string | null;
    capacity: number | null;
    contactEmail: string | null;
    contactPhone: string | null;
    address: string | null;
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
    timezone: string | null;
    capacity: number | null;
    contactEmail: string | null;
    contactPhone: string | null;
    address: string | null;
    bookingPolicy: string | null;
    createdAt: string;
    updatedAt: string;
    role: RestaurantRole;
  };
};

type ServicePeriodsResponse = {
  restaurantId: string;
  periods: ServicePeriodRow[];
};

export type RestaurantProfile = {
  id: string;
  name: string;
  slug: string | null;
  timezone: string | null;
  capacity: number | null;
  contactEmail: string | null;
  contactPhone: string | null;
  address: string | null;
  bookingPolicy: string | null;
};

export type OperatingHoursRow = {
  dayOfWeek: number;
  opensAt: string | null;
  closesAt: string | null;
  isClosed: boolean;
  notes: string | null;
};

export type OperatingHoursOverride = {
  id?: string;
  effectiveDate: string;
  opensAt: string | null;
  closesAt: string | null;
  isClosed: boolean;
  notes: string | null;
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
  bookingOption: 'lunch' | 'dinner' | 'drinks';
};

export interface RestaurantService {
  listRestaurants(): Promise<Array<OpsRestaurantOption & { role: RestaurantRole }>>;
  getProfile(restaurantId: string): Promise<RestaurantProfile>;
  updateProfile(restaurantId: string, profile: Partial<RestaurantProfile>): Promise<RestaurantProfile>;
  getOperatingHours(restaurantId: string): Promise<OperatingHoursSnapshot>;
  updateOperatingHours(restaurantId: string, snapshot: OperatingHoursSnapshot): Promise<OperatingHoursSnapshot>;
  getServicePeriods(restaurantId: string): Promise<ServicePeriodRow[]>;
  updateServicePeriods(restaurantId: string, rows: ServicePeriodRow[]): Promise<ServicePeriodRow[]>;
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
    timezone: dto.timezone ?? 'UTC',
    capacity: dto.capacity ?? null,
    contactEmail: dto.contactEmail ?? null,
    contactPhone: dto.contactPhone ?? null,
    address: dto.address ?? null,
    bookingPolicy: dto.bookingPolicy ?? null,
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
      return fetchJson<OperatingHoursSnapshot>(`${OWNER_RESTAURANTS_BASE}/${restaurantId}/hours`);
    },

    async updateOperatingHours(restaurantId: string, snapshot: OperatingHoursSnapshot) {
      return fetchJson<OperatingHoursSnapshot>(`${OWNER_RESTAURANTS_BASE}/${restaurantId}/hours`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(snapshot),
      });
    },

    async getServicePeriods(restaurantId: string) {
      const response = await fetchJson<ServicePeriodsResponse>(`${OWNER_RESTAURANTS_BASE}/${restaurantId}/service-periods`);
      return response.periods;
    },

    async updateServicePeriods(restaurantId: string, rows: ServicePeriodRow[]) {
      const response = await fetchJson<ServicePeriodsResponse>(`${OWNER_RESTAURANTS_BASE}/${restaurantId}/service-periods`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(rows),
      });
      return response.periods;
    },
  } satisfies RestaurantService;
}
