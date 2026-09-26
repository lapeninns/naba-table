'use client';

import { createContext, useContext, useMemo, type ReactNode } from 'react';

import { useRestaurantService } from '@/contexts/ops-services';
import {
  createRestaurantServiceAvailability,
  httpAvailabilityService,
  type AvailabilityService,
} from '@/services/ops/availability';

/**
 * The Availability page's snapshot read and save command. Without a provider the hooks use the
 * HTTP client (`/api/ops/restaurants/[id]/availability`), which is what the app ships.
 */
const AvailabilityServiceContext = createContext<AvailabilityService | null>(null);

export function AvailabilityServiceProvider({
  service,
  children,
}: {
  service: AvailabilityService;
  children: ReactNode;
}) {
  return (
    <AvailabilityServiceContext.Provider value={service}>
      {children}
    </AvailabilityServiceContext.Provider>
  );
}

/**
 * For the dev harness (in-memory `RestaurantService` from `OpsServicesProvider`): serves the
 * Availability snapshot and save from that service, so mock-mode QA never reaches the real route.
 * Render it inside `OpsServicesProvider`.
 */
export function RestaurantServiceAvailabilityBridge({ children }: { children: ReactNode }) {
  const restaurantService = useRestaurantService();
  const service = useMemo(
    () => createRestaurantServiceAvailability(restaurantService),
    [restaurantService],
  );
  return <AvailabilityServiceProvider service={service}>{children}</AvailabilityServiceProvider>;
}

export function useAvailabilityService(): AvailabilityService {
  return useContext(AvailabilityServiceContext) ?? httpAvailabilityService;
}
