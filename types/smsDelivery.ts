export type SmsDeliveryStatus = 'queued' | 'sent' | 'delivered' | 'undelivered' | 'failed';

export const SMS_DELIVERY_STATUS_VALUES = [
  'queued',
  'sent',
  'delivered',
  'undelivered',
  'failed',
] as const satisfies ReadonlyArray<SmsDeliveryStatus>;

export type SmsDeliveryProvider = 'twilio' | 'mock';

export type SmsDeliveryEventDTO = {
  id: string;
  bookingId: string | null;
  restaurantId: string | null;
  smsType: string | null;
  recipientPhone: string;
  messageSid: string;
  status: SmsDeliveryStatus;
  provider: SmsDeliveryProvider | null;
  occurredAt: string;
  error: string | null;
  metadata: unknown | null;
};

export type BookingSmsDeliveryResponse =
  | { ok: true; bookingId: string; events: SmsDeliveryEventDTO[] }
  | {
      ok: false;
      code:
        | 'UNAUTHENTICATED'
        | 'FORBIDDEN'
        | 'BOOKING_NOT_FOUND'
        | 'DELIVERY_LOG_UNAVAILABLE'
        | 'INTERNAL';
      error: string;
      message?: string;
    };

export type OpsSmsDeliveryRange = '24h' | '7d' | '30d';

export const OPS_SMS_DELIVERY_RANGE_VALUES = ['24h', '7d', '30d'] as const satisfies ReadonlyArray<OpsSmsDeliveryRange>;

export type OpsSmsDeliveryBookingDTO = {
  id: string;
  reference: string;
  bookingDate: string;
  startTime: string;
  endTime: string;
  customerName: string;
  partySize: number;
};

export type OpsSmsDeliveryAttemptDTO = {
  messageSid: string;
  recipientPhone: string;
  bookingId: string | null;
  smsType: string | null;
  provider: SmsDeliveryProvider | null;
  currentStatus: SmsDeliveryStatus;
  currentOccurredAt: string | null;
  events: SmsDeliveryEventDTO[];
  booking: OpsSmsDeliveryBookingDTO | null;
  /**
   * True when the attempt is in a non-terminal state (queued / sent) and we
   * have not received a terminal Twilio status callback within the stale
   * threshold. Derived on the read path; not persisted.
   */
  isStale?: boolean;
  /** Age of the most recent event in milliseconds, when `isStale` is true. */
  stuckForMs?: number | null;
};

/**
 * Minutes an SMS attempt can sit in a non-terminal state before we flag it as
 * stuck. Twilio normally emits a terminal callback within a minute or two;
 * anything past 30 minutes is highly suspicious (dropped webhook, carrier
 * black hole, or queued without being dispatched).
 */
export const SMS_DELIVERY_STALE_THRESHOLD_MINUTES = 30;

/** Non-terminal SMS statuses considered "in flight". */
export const SMS_DELIVERY_IN_FLIGHT_STATUSES: ReadonlyArray<SmsDeliveryStatus> = ['queued', 'sent'];

export type OpsSmsDeliverySummary = {
  total: number;
  queued: number;
  sent: number;
  delivered: number;
  undelivered: number;
  failed: number;
  deliveredRate: number;
  failureRate: number;
  uniqueRecipients: number;
  uniqueBookings: number;
  /**
   * Count of in-flight attempts (queued / sent) older than the
   * {@link SMS_DELIVERY_STALE_THRESHOLD_MINUTES} threshold. Derived server-side.
   */
  stuckInFlight?: number;
};

export type OpsSmsDeliveryFeedResponse =
  | {
      ok: true;
      restaurantId: string;
      range: OpsSmsDeliveryRange;
      pageInfo: { page: number; pageSize: number; hasNext: boolean };
      attempts: OpsSmsDeliveryAttemptDTO[];
      summary: OpsSmsDeliverySummary;
    }
  | {
      ok: false;
      code: 'UNAUTHENTICATED' | 'FORBIDDEN' | 'DELIVERY_LOG_UNAVAILABLE' | 'INTERNAL';
      error: string;
      message?: string;
    };
