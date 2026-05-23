import {
  enqueueBookingCreatedSideEffects,
  safeBookingPayload,
  type BookingCreatedSideEffectsPayload,
} from '@/server/jobs/booking-side-effects';

import { retryWithBackoff } from './retry';

import type { BookingRecord } from '@/server/bookings';

type BookingCreatedSideEffectsOptions = NonNullable<
  Parameters<typeof enqueueBookingCreatedSideEffects>[1]
>;

export type BookingCreatedSideEffectsClient = BookingCreatedSideEffectsOptions['supabase'];

export type BookingCreatedSideEffectsDispatcher = (
  payload: BookingCreatedSideEffectsPayload,
  options?: BookingCreatedSideEffectsOptions,
) => Promise<unknown>;

export function buildBookingCreatedSideEffectsPayload(params: {
  booking: BookingRecord;
  idempotencyKey: string | null;
  restaurantId: string;
  isOpsWalkIn: boolean;
  opsEmailProvidedHeader: boolean;
}): BookingCreatedSideEffectsPayload {
  return {
    booking: safeBookingPayload(params.booking),
    idempotencyKey: params.idempotencyKey,
    restaurantId: params.restaurantId,
    emailProvided: params.isOpsWalkIn ? params.opsEmailProvidedHeader : true,
  };
}

export async function dispatchBookingCreatedSideEffects({
  booking,
  client,
  dispatcher = enqueueBookingCreatedSideEffects,
  idempotencyKey,
  isOpsWalkIn,
  opsEmailProvidedHeader,
  restaurantId,
}: {
  booking: BookingRecord;
  client: BookingCreatedSideEffectsClient;
  dispatcher?: BookingCreatedSideEffectsDispatcher;
  idempotencyKey: string | null;
  isOpsWalkIn: boolean;
  opsEmailProvidedHeader: boolean;
  restaurantId: string;
}): Promise<void> {
  const sideEffectPayload = buildBookingCreatedSideEffectsPayload({
    booking,
    idempotencyKey,
    restaurantId,
    isOpsWalkIn,
    opsEmailProvidedHeader,
  });

  await retryWithBackoff(() => dispatcher(sideEffectPayload, { supabase: client }), {
    attempts: 3,
    initialDelayMs: 200,
    multiplier: 2,
  });
}
