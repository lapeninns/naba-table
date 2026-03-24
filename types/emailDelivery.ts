export type EmailDeliveryStatus =
  | "sent"
  | "delivered"
  | "delivery_delayed"
  | "bounced"
  | "complained"
  | "failed";

export const EMAIL_DELIVERY_STATUS_VALUES = [
  "sent",
  "delivered",
  "delivery_delayed",
  "bounced",
  "complained",
  "failed",
] as const satisfies ReadonlyArray<EmailDeliveryStatus>;

export type EmailDeliveryProvider = "resend" | "mock";

export type EmailDeliveryEventDTO = {
  id: string;
  bookingId: string | null;
  restaurantId: string | null;
  emailType: string | null;
  templateType: string | null;
  recipientEmail: string;
  messageId: string;
  status: EmailDeliveryStatus;
  provider: EmailDeliveryProvider | null;
  occurredAt: string; // ISO
  error: string | null;
  metadata: unknown | null; // jsonb
};

export type BookingEmailDeliveryResponse =
  | { ok: true; bookingId: string; events: EmailDeliveryEventDTO[] }
  | {
      ok: false;
      code:
        | "UNAUTHENTICATED"
        | "FORBIDDEN"
        | "BOOKING_NOT_FOUND"
        | "DELIVERY_LOG_UNAVAILABLE"
        | "INTERNAL";
      error: string;
      // Keep `message` as a duplicate field so `fetchJson` can normalize errors consistently.
      message?: string;
    };

export type OpsEmailDeliveryRange = "24h" | "7d" | "30d";

export const OPS_EMAIL_DELIVERY_RANGE_VALUES = ["24h", "7d", "30d"] as const satisfies ReadonlyArray<OpsEmailDeliveryRange>;

export type OpsEmailDeliveryBookingDTO = {
  id: string;
  reference: string;
  bookingDate: string; // YYYY-MM-DD
  startTime: string; // HH:mm:ss or HH:mm
  endTime: string;
  customerName: string;
  partySize: number;
};

export type OpsEmailDeliveryAttemptDTO = {
  messageId: string;
  recipientEmail: string;
  bookingId: string | null;
  emailType: string | null;
  templateType: string | null;
  provider: EmailDeliveryProvider | null;
  currentStatus: EmailDeliveryStatus;
  currentOccurredAt: string | null; // ISO
  events: EmailDeliveryEventDTO[];
  booking: OpsEmailDeliveryBookingDTO | null;
};

export type OpsEmailDeliveryTopTemplateEntry = {
  templateType: string;
  count: number;
};

export type OpsEmailDeliveryTopEmailTypeEntry = {
  emailType: string;
  count: number;
};

export type OpsEmailDeliverySummary = {
  total: number;
  sent: number;
  delivered: number;
  deliveryDelayed: number;
  bounced: number;
  complained: number;
  failed: number;
  deliveredRate: number; // 0..1
  failureRate: number; // 0..1
  uniqueRecipients: number;
  uniqueBookings: number;
  p50DeliverySeconds: number | null;
  p95DeliverySeconds: number | null;
  topFailedTemplates: OpsEmailDeliveryTopTemplateEntry[];
  topFailedEmailTypes: OpsEmailDeliveryTopEmailTypeEntry[];
};

export type OpsEmailDeliveryFeedResponse =
  | {
      ok: true;
      restaurantId: string;
      range: OpsEmailDeliveryRange;
      pageInfo: { page: number; pageSize: number; hasNext: boolean };
      attempts: OpsEmailDeliveryAttemptDTO[];
      summary?: OpsEmailDeliverySummary;
    }
  | {
      ok: false;
      code:
        | "UNAUTHENTICATED"
        | "FORBIDDEN"
        | "DELIVERY_LOG_UNAVAILABLE"
        | "FORCED_ERROR"
        | "INTERNAL";
      error: string;
      message?: string;
    };

export type OpsEmailDeliverySummaryResponse =
  | {
      ok: true;
      restaurantId: string;
      range: OpsEmailDeliveryRange;
      summary: OpsEmailDeliverySummary;
    }
  | {
      ok: false;
      code:
        | "UNAUTHENTICATED"
        | "FORBIDDEN"
        | "DELIVERY_LOG_UNAVAILABLE"
        | "FORCED_ERROR"
        | "INTERNAL";
      error: string;
      message?: string;
    };
