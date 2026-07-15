import { DevBookingEmailOperations } from './devBookingEmailOperations';

import type { BookingService } from '@/services/ops/bookings';

export class DevBookingService extends DevBookingEmailOperations implements BookingService {}

export function createDevBookingService(): BookingService {
  return new DevBookingService();
}
