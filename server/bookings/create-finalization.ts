import {
  runBookingCreateInlineAutoAssign,
  scheduleBookingCreateAutoAssignRetry,
} from '@/server/bookings/auto-assign-domain';
import { dispatchBookingCreatedAuditEvent } from '@/server/bookings/create-payloads';
import { dispatchBookingCreatedSideEffects } from '@/server/bookings/created-side-effects-payload';

import type { BookingRecord } from '@/server/bookings';

type AuditDispatcher = typeof dispatchBookingCreatedAuditEvent;
type InlineAutoAssignRunner = typeof runBookingCreateInlineAutoAssign;
type SideEffectsDispatcher = typeof dispatchBookingCreatedSideEffects;
type AutoAssignRetryScheduler = typeof scheduleBookingCreateAutoAssignRetry;

type FinalizationClient = Parameters<AuditDispatcher>[0]['client'] &
  Parameters<InlineAutoAssignRunner>[0]['client'] &
  Parameters<SideEffectsDispatcher>[0]['client'];

export async function finalizeBookingCreateCommit({
  actor,
  autoAssignEnabled,
  booking,
  client,
  customer,
  idempotencyKey,
  inlineAutoAssignRunner = runBookingCreateInlineAutoAssign,
  inlineAutoAssignTimeoutMs = 4000,
  isOpsWalkIn,
  onAutoAssignError,
  onInlineAutoAssignError,
  onSideEffectsError,
  opsEmailProvidedHeader,
  restaurantId,
  reusedExisting,
  auditDispatcher = dispatchBookingCreatedAuditEvent,
  sideEffectsDispatcher = dispatchBookingCreatedSideEffects,
  autoAssignRetryScheduler = scheduleBookingCreateAutoAssignRetry,
}: {
  actor: string;
  auditDispatcher?: AuditDispatcher;
  autoAssignEnabled: boolean;
  autoAssignRetryScheduler?: AutoAssignRetryScheduler;
  booking: BookingRecord;
  client: FinalizationClient;
  customer: { id: string };
  idempotencyKey: string | null;
  inlineAutoAssignRunner?: InlineAutoAssignRunner;
  inlineAutoAssignTimeoutMs?: number;
  isOpsWalkIn: boolean;
  onAutoAssignError?: (error: unknown) => void;
  onInlineAutoAssignError?: (error: unknown) => void;
  onSideEffectsError?: (error: unknown) => void;
  opsEmailProvidedHeader: boolean;
  restaurantId: string;
  reusedExisting: boolean;
  sideEffectsDispatcher?: SideEffectsDispatcher;
}): Promise<{ booking: BookingRecord }> {
  let finalBooking = booking;

  if (reusedExisting) {
    return { booking: finalBooking };
  }

  await auditDispatcher({
    actor,
    booking: finalBooking,
    client,
    customer,
    restaurantId,
  });

  try {
    const updatedBooking = await inlineAutoAssignRunner({
      autoAssignEnabled,
      bookingId: finalBooking.id,
      client,
      restaurantId,
      timeoutMs: inlineAutoAssignTimeoutMs,
    });

    if (updatedBooking) {
      finalBooking = updatedBooking;
    }
  } catch (error) {
    onInlineAutoAssignError?.(error);
  }

  try {
    await sideEffectsDispatcher({
      booking: finalBooking,
      client,
      idempotencyKey,
      isOpsWalkIn,
      opsEmailProvidedHeader,
      restaurantId,
    });
  } catch (error) {
    onSideEffectsError?.(error);
  }

  try {
    await autoAssignRetryScheduler({
      autoAssignEnabled,
      bookingId: finalBooking.id,
      bookingStatus: finalBooking.status,
    });
  } catch (error) {
    onAutoAssignError?.(error);
  }

  return { booking: finalBooking };
}
