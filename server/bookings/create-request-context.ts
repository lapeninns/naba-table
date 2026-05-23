import { randomUUID } from 'crypto';

import { coerceUuid, normalizeIdempotencyKey } from '@/server/bookings/idempotency';

import type { Json } from '@/types/supabase';

export type BookingCreateRequestContext = {
  headerIdempotencyKey: string | null;
  clientRequestId: string;
  opsEmailProvidedHeader: boolean;
  isOpsWalkIn: boolean;
  requestSource: 'ops.walkin' | 'api.bookings';
  bookingSource: 'ops.walkin' | 'api';
  bookingDetails: Json | null;
};

export function buildBookingCreateRequestContext(
  headers: Pick<Headers, 'get'>,
  options: { generateRequestId?: () => string } = {},
): BookingCreateRequestContext {
  const generateRequestId = options.generateRequestId ?? randomUUID;
  const headerIdempotencyKey = normalizeIdempotencyKey(headers.get('Idempotency-Key'));
  const clientRequestId = coerceUuid(headerIdempotencyKey) ?? generateRequestId();
  const opsEmailProvidedHeader = headers.get('x-ops-email-provided') === 'true';
  const isOpsWalkIn = headers.get('x-ops-walk-in') === 'true';
  const requestSource = isOpsWalkIn ? 'ops.walkin' : 'api.bookings';
  const bookingSource = isOpsWalkIn ? 'ops.walkin' : 'api';
  const bookingDetails = isOpsWalkIn
    ? ({
        channel: bookingSource,
        created_by: 'ops.walkin',
        staff_request_id: clientRequestId,
      } satisfies Json)
    : null;

  return {
    headerIdempotencyKey,
    clientRequestId,
    opsEmailProvidedHeader,
    isOpsWalkIn,
    requestSource,
    bookingSource,
    bookingDetails,
  };
}
