export const EMAIL_DELIVERY_STATUSES = [
  'sent',
  'delivered',
  'delivery_delayed',
  'bounced',
  'complained',
  'failed',
] as const;

export type EmailDeliveryStatus = (typeof EMAIL_DELIVERY_STATUSES)[number];
