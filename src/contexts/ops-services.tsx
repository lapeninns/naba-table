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

export type OpsServices = {
  bookingService: BookingService;
  restaurantService: RestaurantService;
  teamService: TeamService;
  customerService: CustomerService;
};

type OpsServiceFactories = {
  bookingService?: BookingServiceFactory;
  restaurantService?: RestaurantServiceFactory;
  teamService?: TeamServiceFactory;
  customerService?: CustomerServiceFactory;
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
    }),
    [factories?.bookingService, factories?.restaurantService, factories?.teamService, factories?.customerService],
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
