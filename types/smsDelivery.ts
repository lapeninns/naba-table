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
