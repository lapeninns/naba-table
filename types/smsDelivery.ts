export type SmsDeliveryStatus = 'queued' | 'sent' | 'delivered' | 'undelivered' | 'failed';

export const SMS_DELIVERY_STATUS_VALUES = [
  'queued',
  'sent',
  'delivered',
  'undelivered',
  'failed',
] as const satisfies ReadonlyArray<SmsDeliveryStatus>;

export type SmsDeliveryProvider = 'twilio' | 'mock';

export type SmsDeliveryChannel = 'whatsapp' | 'sms';

/** Channel filter accepted by ops message-delivery reads. `all` applies no filter. */
export type SmsDeliveryChannelFilter = 'all' | SmsDeliveryChannel;

export const OPS_SMS_DELIVERY_CHANNEL_VALUES = [
  'all',
  'whatsapp',
  'sms',
] as const satisfies ReadonlyArray<SmsDeliveryChannelFilter>;

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
  /** Present for mobile ledger rows and tagged SMS log events. */
  channel?: SmsDeliveryChannel;
  fallbackForAttemptId?: string | null;
  logicalNotificationId?: string | null;
  /**
   * Raw provider/ledger status before normalization into {@link SmsDeliveryStatus}.
   * WhatsApp ledger rows can be `claimed`, `accepted`, or `read`, which the
   * normalized `status` collapses into `queued`/`delivered` for filtering.
   * Kept optional so legacy SMS-only rows can omit it without a migration.
   */
  providerStatus?: string | null;
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

export const OPS_SMS_DELIVERY_RANGE_VALUES = [
  '24h',
  '7d',
  '30d',
] as const satisfies ReadonlyArray<OpsSmsDeliveryRange>;

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
  channel?: 'whatsapp' | 'sms';
  logicalNotificationId?: string | null;
  fallbackForAttemptId?: string | null;
  /** Raw provider/ledger status for the current attempt. See {@link SmsDeliveryEventDTO.providerStatus}. */
  currentProviderStatus?: string | null;
  /**
   * True when the attempt is still in a non-terminal state (queued / sent)
   * after the stale threshold has passed. Derived on the read path; not
   * persisted.
   */
  isStale?: boolean;
  /** Age of the most recent event in milliseconds, when `isStale` is true. */
  stuckForMs?: number | null;
};

/**
 * Hours an SMS attempt can remain in a non-terminal Twilio state before we
 * flag it as stale. Twilio's delivery-logging guidance recommends polling by
 * Message SID when a message has not reached `delivered` or `undelivered`
 * within 12 hours because a status callback may have been missed.
 */
export const SMS_DELIVERY_STALE_THRESHOLD_HOURS = 12;
export const SMS_DELIVERY_STALE_THRESHOLD_MINUTES = SMS_DELIVERY_STALE_THRESHOLD_HOURS * 60;

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
  /** Attempts sent (or attempted) over the WhatsApp channel. */
  whatsappCount?: number;
  /** Attempts sent over the plain SMS channel, including WhatsApp fallbacks. */
  smsCount?: number;
  /** SMS attempts claimed as a fallback after a failed WhatsApp attempt. */
  fallbackCount?: number;
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
