import {
  generateUniqueBookingReference,
  insertBookingRecord,
  type BookingRecord,
} from '@/server/bookings';
import {
  buildBookingCreateInsertFallbackObservabilityEvent,
  buildBookingCreateRecoveredObservabilityEvent,
} from '@/server/bookings/create-observability-events';
import {
  buildFallbackInsertBookingPayload,
  type BookingCreatePayloadBase,
} from '@/server/bookings/create-payloads';
import { stringifyError } from '@/server/bookings/error-formatting';
import { recordObservabilityEvent } from '@/server/observability';

type BookingRecoveryQuery = {
  eq(column: string, value: string): BookingRecoveryQuery;
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
};

export async function recoverBookingRecord(
  client: BookingRecoveryClient,
  args: RecoverBookingRecordArgs,
): Promise<BookingRecord | null> {
  if (args.idempotencyKey) {
    const idempotencyQuery = client.from('bookings') as BookingRecoveryTableQuery;
    const { data, error } = await idempotencyQuery
      .select('*')
      .eq('restaurant_id', args.restaurantId)
      .eq('customer_id', args.customerId)
      .eq('idempotency_key', args.idempotencyKey)
      .maybeSingle();

    if (!error && data) {
      return data as BookingRecord;
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
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!sigError && sigData) {
    return sigData as BookingRecord;
  }

  return null;
}

type BookingCreateRecordClient = Parameters<typeof insertBookingRecord>[0] & BookingRecoveryClient;

export type BookingReferenceGenerator = (
  client: Parameters<typeof generateUniqueBookingReference>[0],
) => Promise<string>;

export type BookingFallbackInserter = (
  client: Parameters<typeof insertBookingRecord>[0],
  payload: ReturnType<typeof buildFallbackInsertBookingPayload>,
) => Promise<BookingRecord>;

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
  inserter = insertBookingRecord,
  observabilityRecorder = recordObservabilityEvent,
  referenceGenerator = generateUniqueBookingReference,
  recoverer = recoverBookingRecord,
  resolveArgs,
}: {
  client: BookingCreateRecordClient;
  inserter?: BookingFallbackInserter;
  observabilityRecorder?: BookingCreateObservabilityRecorder;
  referenceGenerator?: BookingReferenceGenerator;
  recoverer?: (
    client: BookingRecoveryClient,
    args: RecoverBookingRecordArgs,
  ) => Promise<BookingRecord | null>;
  resolveArgs: MissingBookingCreateRecordArgs;
}): Promise<BookingRecord> {
  const recovered = await recoverer(client, resolveArgs.recovery);

  if (recovered) {
    void observabilityRecorder(
      buildBookingCreateRecoveredObservabilityEvent({
        source: resolveArgs.source,
        restaurantId: resolveArgs.restaurantId,
        idempotencyKey: resolveArgs.recovery.idempotencyKey,
      }),
    );
    return recovered;
  }

  try {
    const reference = await referenceGenerator(client);
    const created = await inserter(
      client,
      buildFallbackInsertBookingPayload({
        ...resolveArgs.fallback,
        reference,
      }),
    );

    void observabilityRecorder(
      buildBookingCreateInsertFallbackObservabilityEvent({
        source: resolveArgs.source,
        restaurantId: resolveArgs.restaurantId,
        idempotencyKey: resolveArgs.recovery.idempotencyKey,
      }),
    );

    return created;
  } catch (createFallbackError) {
    throw new Error(
      `Booking creation succeeded but booking record could not be retrieved or created: ${stringifyError(
        createFallbackError,
      )}`,
    );
  }
}
