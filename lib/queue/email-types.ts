export const EMAIL_JOB_TYPES = [
  'request_received',
  'confirmation',
  'updated',
  'cancelled',
  'reminder_24h',
  'reminder_short',
  'review_request',
  'booking_rejected',
  'restaurant_cancellation',
] as const;

export type EmailJobType = (typeof EMAIL_JOB_TYPES)[number];
