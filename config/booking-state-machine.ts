import type { OpsBookingStatus } from '@/types/ops';

/**
 * Shared lifecycle transition configuration consumed by both server and client code.
 * Keep this object in sync with Supabase `bookings.status` values.
 */
export const BOOKING_STATE_TRANSITIONS = {
  pending: ['pending', 'pending_allocation', 'confirmed', 'cancelled'],
  pending_allocation: ['pending_allocation', 'confirmed', 'cancelled'],
  confirmed: ['confirmed', 'checked_in', 'cancelled', 'no_show'],
  PRIORITY_WAITLIST: ['PRIORITY_WAITLIST', 'checked_in', 'cancelled', 'no_show'],
  checked_in: ['checked_in', 'completed', 'no_show'],
  completed: ['completed'],
  cancelled: ['cancelled'],
  no_show: ['no_show', 'confirmed'],
} as const satisfies Record<OpsBookingStatus, readonly OpsBookingStatus[]>;

export type BookingLifecycleStatus = keyof typeof BOOKING_STATE_TRANSITIONS;

