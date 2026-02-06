'use client';

import { createDevBookingService } from './devBookingService';
import { createDevCustomerService } from './devCustomerService';
import { createDevOccasionService } from './devOccasionService';
import { createDevRestaurantService } from './devRestaurantService';
import { createDevTeamService } from './devTeamService';
import { createDevTablesState, DevTableInventoryService, DevZoneService } from './devZonesAndTables';

import type { BookingServiceFactory } from '@/services/ops/bookings';
import type { CustomerServiceFactory } from '@/services/ops/customers';
import type { OccasionServiceFactory } from '@/services/ops/occasions';
import type { RestaurantServiceFactory } from '@/services/ops/restaurants';
import type { TableInventoryServiceFactory } from '@/services/ops/tables';
import type { TeamServiceFactory } from '@/services/ops/team';
import type ZoneService from '@/services/ops/zones';

type OpsDevServiceFactories = {
  bookingService: BookingServiceFactory;
  restaurantService: RestaurantServiceFactory;
  teamService: TeamServiceFactory;
  customerService: CustomerServiceFactory;
  tableInventoryService: TableInventoryServiceFactory;
  occasionService: OccasionServiceFactory;
  zoneService: () => ZoneService;
};

/**
 * A cohesive set of in-memory Ops services for dev harness pages.
 * Factories share state where necessary (zones/tables).
 */
export function createOpsDevServiceFactories(): Partial<OpsDevServiceFactories> {
  const tablesState = createDevTablesState();

  return {
    bookingService: () => createDevBookingService(),
    restaurantService: () => createDevRestaurantService(),
    customerService: () => createDevCustomerService(),
    tableInventoryService: () => new DevTableInventoryService(tablesState),
    occasionService: () => createDevOccasionService(),
    teamService: () => createDevTeamService(),
    zoneService: () => new DevZoneService(tablesState),
  };
}
