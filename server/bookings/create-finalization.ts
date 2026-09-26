import { logger } from '@/lib/logger';
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

/** Statuses that mean the booking is still waiting for a table. */
const REPLAY_AUTO_ASSIGN_STATUSES: ReadonlySet<string> = new Set(['pending', 'pending_allocation']);

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
    // Idempotent replay: the booking committed on an earlier request, whose side
    // effects may have failed or never run. Re-ensure them; they are keyed per
    // booking and effect type, so nothing is sent twice. Audit and the inline
    // auto-assign belong to the original request and are not repeated.
    try {
      await sideEffectsDispatcher({
        booking: finalBooking,
        client,
        idempotencyKey,
        isOpsWalkIn,
        opsEmailProvidedHeader,
        replay: true,
        restaurantId,
      });
    } catch (error) {
      onSideEffectsError?.(error);
    }

    // If the original process died after the insert, its background auto-assign
    // never ran and the booking would stay unallocated. The replay reads the
    // current row, so a booking that is still awaiting allocation gets the
    // background job again. The job re-reads the booking before every attempt
    // and exits once it is confirmed with tables (or cancelled), so a second
    // run alongside a still-live original cannot double-assign.
    if (REPLAY_AUTO_ASSIGN_STATUSES.has(String(finalBooking.status))) {
      try {
        await autoAssignRetryScheduler({
          autoAssignEnabled,
          bookingId: finalBooking.id,
          bookingStatus: finalBooking.status,
        });
      } catch (error) {
        onAutoAssignError?.(error);
      }
    }
    return { booking: finalBooking };
  }

  // The booking is committed. An audit_logs failure is logged and never turns
  // it into a 500: the guest still gets the 201, the creator cookie and the
  // confirmation side effects below.
  try {
    await auditDispatcher({
      actor,
      booking: finalBooking,
      client,
      customer,
      restaurantId,
    });
  } catch (error) {
    logger.error('bookings.create.audit_failed', {
      bookingId: finalBooking.id,
      restaurantId,
      errorName: error instanceof Error ? error.name : typeof error,
    });
  }

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
