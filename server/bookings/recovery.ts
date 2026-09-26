import { type BookingRecord } from '@/server/bookings';
import { buildBookingCreateRecoveredObservabilityEvent } from '@/server/bookings/create-observability-events';
import { type BookingCreatePayloadBase } from '@/server/bookings/create-payloads';
import { hashIdempotencyKey } from '@/server/bookings/idempotency';
import { recordObservabilityEvent } from '@/server/observability';

type BookingRecoveryQuery = {
  eq(column: string, value: string | number): BookingRecoveryQuery;
  not(column: string, operator: string, value: string): BookingRecoveryQuery;
  order(column: string, options: { ascending: boolean }): BookingRecoveryQuery;
  limit(count: number): BookingRecoveryQuery;
  maybeSingle(): Promise<{ data: unknown; error: unknown }>;
};

type BookingRecoveryTableQuery = {
  select(columns: string): BookingRecoveryQuery;
};

export type BookingRecoveryClient = {
  from(table: 'bookings'): unknown;
};

export type RecoverBookingRecordArgs = {
  restaurantId: string;
  idempotencyKey: string | null;
  customerId: string;
  bookingDate: string;
  startTime: string;
  endTime: string;
  partySize: number;
};

export type BookingRecoveryMethod = 'idempotency_key' | 'signature';

export type RecoveredBookingRecord = {
  booking: BookingRecord;
  method: BookingRecoveryMethod;
};

/**
 * Statuses that end a booking's claim on its slot. A guest who cancelled (or was marked as a
 * no-show) and books the same slot again must get a new booking, not the finished one.
 */
export const SIGNATURE_RECOVERY_EXCLUDED_STATUS_FILTER = '(cancelled,no_show)';

/**
 * Looks a create key up in the scope of the unique (restaurant_id, idempotency_key) index.
 * Callers compare the payload before treating the row as a replay.
 */
export async function findBookingByIdempotencyKey(
  client: BookingRecoveryClient,
  args: { restaurantId: string; idempotencyKey: string },
): Promise<BookingRecord | null> {
  const query = client.from('bookings') as BookingRecoveryTableQuery;
  const { data, error } = await query
    .select('*')
    .eq('restaurant_id', args.restaurantId)
    .eq('idempotency_key', args.idempotencyKey)
    .maybeSingle();

  return !error && data ? (data as BookingRecord) : null;
}

export async function recoverBookingRecordWithMethod(
  client: BookingRecoveryClient,
  args: RecoverBookingRecordArgs,
): Promise<RecoveredBookingRecord | null> {
  if (args.idempotencyKey) {
    const idempotencyQuery = client.from('bookings') as BookingRecoveryTableQuery;
    const { data, error } = await idempotencyQuery
      .select('*')
      .eq('restaurant_id', args.restaurantId)
      .eq('customer_id', args.customerId)
      .eq('idempotency_key', args.idempotencyKey)
      .not('status', 'in', SIGNATURE_RECOVERY_EXCLUDED_STATUS_FILTER)
      .maybeSingle();

    if (!error && data) {
      return { booking: data as BookingRecord, method: 'idempotency_key' };
    }
  }

  const signatureQuery = client.from('bookings') as BookingRecoveryTableQuery;
  const { data: sigData, error: sigError } = await signatureQuery
    .select('*')
    .eq('restaurant_id', args.restaurantId)
    .eq('customer_id', args.customerId)
    .eq('booking_date', args.bookingDate)
    .eq('start_time', args.startTime)
    .eq('end_time', args.endTime)
    .eq('party_size', args.partySize)
    .not('status', 'in', SIGNATURE_RECOVERY_EXCLUDED_STATUS_FILTER)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!sigError && sigData) {
    return { booking: sigData as BookingRecord, method: 'signature' };
  }

  return null;
}

export async function recoverBookingRecord(
  client: BookingRecoveryClient,
  args: RecoverBookingRecordArgs,
): Promise<BookingRecord | null> {
  const recovered = await recoverBookingRecordWithMethod(client, args);
  return recovered?.booking ?? null;
}

type BookingCreateRecordClient = BookingRecoveryClient;

export type BookingCreateObservabilityRecorder = (
  event: Parameters<typeof recordObservabilityEvent>[0],
) => ReturnType<typeof recordObservabilityEvent>;

export type MissingBookingCreateRecordArgs = {
  fallback: BookingCreatePayloadBase;
  recovery: RecoverBookingRecordArgs;
  restaurantId: string;
  source: string;
};

export async function resolveMissingBookingCreateRecord({
  client,
  observabilityRecorder = recordObservabilityEvent,
  recoverer = recoverBookingRecordWithMethod,
  resolveArgs,
}: {
  client: BookingCreateRecordClient;
  observabilityRecorder?: BookingCreateObservabilityRecorder;
  recoverer?: (
    client: BookingRecoveryClient,
    args: RecoverBookingRecordArgs,
  ) => Promise<RecoveredBookingRecord | null>;
  resolveArgs: MissingBookingCreateRecordArgs;
}): Promise<BookingRecord | null> {
  const recovered = await recoverer(client, resolveArgs.recovery);

  if (recovered) {
    void observabilityRecorder(
      buildBookingCreateRecoveredObservabilityEvent({
        source: resolveArgs.source,
        restaurantId: resolveArgs.restaurantId,
        idempotencyKey: resolveArgs.recovery.idempotencyKey,
        method: recovered.method,
      }),
    );
    return recovered.booking;
  }

  void observabilityRecorder({
    source: resolveArgs.source,
    eventType: 'booking.create.recovery_failed',
    severity: 'error',
    context: {
      restaurantId: resolveArgs.restaurantId,
      keyHash: hashIdempotencyKey(resolveArgs.recovery.idempotencyKey),
    },
  });

  return null;
}
