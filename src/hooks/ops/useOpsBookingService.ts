'use client';

import { useOpsServices } from '@/contexts/ops-services';

export function useOpsBookingService() {
  return useOpsServices().bookingService;
}
