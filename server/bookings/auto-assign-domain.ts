import type { BookingRecord } from '@/server/bookings';
import type { InlineAutoAssignOptions } from '@/services/inline-auto-assign';

export type BookingInlineAutoAssignRequest = {
  bookingId: string;
  restaurantId: string;
  timeoutMs: number;
  createdBy: 'api-booking';
  historyReason: 'api_inline_auto_assign';
  observabilitySource: 'bookings.inline_auto_assign';
};

export function buildBookingInlineAutoAssignRequest({
  bookingId,
  restaurantId,
  timeoutMs,
}: {
  bookingId: string;
  restaurantId: string;
  timeoutMs: number;
}): BookingInlineAutoAssignRequest {
  return {
    bookingId,
    restaurantId,
    timeoutMs,
    createdBy: 'api-booking',
    historyReason: 'api_inline_auto_assign',
    observabilitySource: 'bookings.inline_auto_assign',
  };
}

export type BookingCreateInlineAutoAssignRunner = (
  request: InlineAutoAssignOptions,
) => Promise<BookingRecord | null>;

export async function runBookingCreateInlineAutoAssign({
  autoAssignEnabled,
  bookingId,
  client,
  restaurantId,
  runner = runWithInlineAutoAssignService,
  timeoutMs = 4000,
}: {
  autoAssignEnabled: boolean;
  bookingId: string;
  client: InlineAutoAssignOptions['client'];
  restaurantId: string;
  runner?: BookingCreateInlineAutoAssignRunner;
  timeoutMs?: number;
}): Promise<BookingRecord | null> {
  if (!autoAssignEnabled) {
    return null;
  }

  return runner({
    ...buildBookingInlineAutoAssignRequest({
      bookingId,
      restaurantId,
      timeoutMs,
    }),
    client,
  });
}

export function shouldScheduleBookingAutoAssignRetry({
  autoAssignEnabled,
  bookingStatus,
}: {
  autoAssignEnabled: boolean;
  bookingStatus: string | null | undefined;
}): boolean {
  return autoAssignEnabled && bookingStatus !== 'confirmed';
}

export type BookingCreateAutoAssignRetryScheduler = (bookingId: string) => void | Promise<void>;

export async function scheduleBookingCreateAutoAssignRetry({
  autoAssignEnabled,
  bookingId,
  bookingStatus,
  scheduler = scheduleWithAutoAssignJob,
}: {
  autoAssignEnabled: boolean;
  bookingId: string;
  bookingStatus: string | null | undefined;
  scheduler?: BookingCreateAutoAssignRetryScheduler;
}): Promise<boolean> {
  if (
    !shouldScheduleBookingAutoAssignRetry({
      autoAssignEnabled,
      bookingStatus,
    })
  ) {
    return false;
  }

  await scheduler(bookingId);
  return true;
}

async function scheduleWithAutoAssignJob(bookingId: string): Promise<void> {
  const { autoAssignAndConfirmIfPossible } = await import('@/server/jobs/auto-assign');
  void autoAssignAndConfirmIfPossible(bookingId);
}

async function runWithInlineAutoAssignService(
  request: InlineAutoAssignOptions,
): Promise<BookingRecord | null> {
  const { runInlineAutoAssign } = await import('@/services/inline-auto-assign');
  return runInlineAutoAssign(request);
}
