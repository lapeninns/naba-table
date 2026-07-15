import { DevRestaurantState } from './devRestaurantState';
import { createUnimplementedServiceMethod } from './devUnimplemented';

import type {
  OperatingHoursSnapshot,
  RestaurantProfile,
  RestaurantService,
  ServicePeriodRow,
  TurnBandsPayload,
} from '@/services/ops/restaurants';

export class DevRestaurantSettings extends DevRestaurantState {
  listRestaurants: RestaurantService['listRestaurants'] = async () =>
    Object.values(this.restaurants).map(({ profile }, index) => ({
      id: profile.id,
      name: profile.name,
      slug: profile.slug,
      timezone: profile.timezone,
      address: profile.address,
      role: index === 0 ? ('owner' as const) : ('manager' as const),
    }));

  async getProfile(restaurantId: string) {
    return this.getRestaurantSnapshot(restaurantId).profile;
  }

  async updateProfile(restaurantId: string, profile: Partial<RestaurantProfile>) {
    const snapshot = this.getRestaurantSnapshot(restaurantId);
    snapshot.profile = { ...snapshot.profile, ...profile };
    return snapshot.profile;
  }

  getBusinessContext = createUnimplementedServiceMethod<RestaurantService['getBusinessContext']>(
    'restaurantService',
    'getBusinessContext',
  );
  updateBusinessContext = createUnimplementedServiceMethod<
    RestaurantService['updateBusinessContext']
  >('restaurantService', 'updateBusinessContext');
  syncProfileWithGoogleBusinessProfile = createUnimplementedServiceMethod<
    RestaurantService['syncProfileWithGoogleBusinessProfile']
  >('restaurantService', 'syncProfileWithGoogleBusinessProfile');

  async getOperatingHours(restaurantId: string) {
    return this.getRestaurantSnapshot(restaurantId).hours;
  }

  async updateOperatingHours(restaurantId: string, snapshot: OperatingHoursSnapshot) {
    const restaurant = this.getRestaurantSnapshot(restaurantId);
    restaurant.hours = snapshot;
    return restaurant.hours;
  }

  syncOperatingHoursWithGoogleBusinessProfile = createUnimplementedServiceMethod<
    RestaurantService['syncOperatingHoursWithGoogleBusinessProfile']
  >('restaurantService', 'syncOperatingHoursWithGoogleBusinessProfile');

  async getServicePeriods(restaurantId: string) {
    return this.getRestaurantSnapshot(restaurantId).servicePeriods;
  }

  async updateServicePeriods(restaurantId: string, rows: ServicePeriodRow[]) {
    const restaurant = this.getRestaurantSnapshot(restaurantId);
    restaurant.servicePeriods = rows;
    return restaurant.servicePeriods;
  }

  syncServicePeriodsWithGoogleBusinessProfile = createUnimplementedServiceMethod<
    RestaurantService['syncServicePeriodsWithGoogleBusinessProfile']
  >('restaurantService', 'syncServicePeriodsWithGoogleBusinessProfile');

  async getTurnBands(restaurantId: string) {
    return this.getRestaurantSnapshot(restaurantId).turnBands;
  }

  async updateTurnBands(restaurantId: string, payload: TurnBandsPayload) {
    const restaurant = this.getRestaurantSnapshot(restaurantId);
    restaurant.turnBands = {
      restaurantId,
      bands: payload,
      defaults: restaurant.turnBands.defaults,
    };
    return restaurant.turnBands;
  }
}
