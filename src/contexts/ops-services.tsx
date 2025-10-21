'use client';

import { createContext, useContext, useMemo, type ReactNode } from 'react';

import {
  createBookingService,
  type BookingService,
  type BookingServiceFactory,
} from '@/services/ops/bookings';
import {
  createRestaurantService,
  type RestaurantService,
  type RestaurantServiceFactory,
} from '@/services/ops/restaurants';
import { createTeamService, type TeamService, type TeamServiceFactory } from '@/services/ops/team';
import {
  createCustomerService,
  type CustomerService,
  type CustomerServiceFactory,
} from '@/services/ops/customers';
import {
  createTableInventoryService,
  type TableInventoryService,
  type TableInventoryServiceFactory,
} from '@/services/ops/tables';
import ZoneService from '@/services/ops/zones';
import {
  createOccasionService,
  type OccasionService,
  type OccasionServiceFactory,
} from '@/services/ops/occasions';

export type OpsServices = {
  bookingService: BookingService;
  restaurantService: RestaurantService;
  teamService: TeamService;
  customerService: CustomerService;
  tableInventoryService: TableInventoryService;
  occasionService: OccasionService;
  zoneService: ZoneService;
};

type OpsServiceFactories = {
  bookingService?: BookingServiceFactory;
  restaurantService?: RestaurantServiceFactory;
  teamService?: TeamServiceFactory;
  customerService?: CustomerServiceFactory;
  tableInventoryService?: TableInventoryServiceFactory;
  occasionService?: OccasionServiceFactory;
  zoneService?: () => ZoneService;
};

type OpsServicesProviderProps = {
  factories?: OpsServiceFactories;
  children: ReactNode;
};

const OpsServicesContext = createContext<OpsServices | null>(null);

export function OpsServicesProvider({ factories, children }: OpsServicesProviderProps) {
  const services = useMemo<OpsServices>(
    () => ({
      bookingService: createBookingService(factories?.bookingService),
      restaurantService: createRestaurantService(factories?.restaurantService),
      teamService: createTeamService(factories?.teamService),
      customerService: createCustomerService(factories?.customerService),
      tableInventoryService: createTableInventoryService(factories?.tableInventoryService),
      occasionService: createOccasionService(factories?.occasionService),
      zoneService: factories?.zoneService ? factories.zoneService() : new ZoneService(),
    }),
    [
      factories?.bookingService,
      factories?.restaurantService,
      factories?.teamService,
      factories?.customerService,
      factories?.tableInventoryService,
      factories?.occasionService,
      factories?.zoneService,
    ],
  );

  return <OpsServicesContext.Provider value={services}>{children}</OpsServicesContext.Provider>;
}

export function useOpsServices(): OpsServices {
  const context = useContext(OpsServicesContext);
  if (!context) {
    throw new Error('useOpsServices must be used within an OpsServicesProvider');
  }
  return context;
}

export function useBookingService(): BookingService {
  return useOpsServices().bookingService;
}

export function useRestaurantService(): RestaurantService {
  return useOpsServices().restaurantService;
}

export function useTeamService(): TeamService {
  return useOpsServices().teamService;
}

export function useCustomerService(): CustomerService {
  return useOpsServices().customerService;
}

export function useTableInventoryService(): TableInventoryService {
  return useOpsServices().tableInventoryService;
}

export function useOccasionService(): OccasionService {
  return useOpsServices().occasionService;
}

export function useZoneService(): ZoneService {
  return useOpsServices().zoneService;
}
