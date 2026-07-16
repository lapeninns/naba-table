export type DailyBookingSummaryDurableState = {
  sentAt: string | null;
  providerMessageId: string | null;
  channel: 'whatsapp' | 'sms' | null;
  callbackToken: string | null;
  recipient: string | null;
  message: string | null;
  lockUntil: string | null;
  fallbackLockUntil: string | null;
  fallbackWhatsappMessageId: string | null;
  fallbackSentAt: string | null;
  fallbackProviderMessageId: string | null;
  expiresAt: string | null;
};

export const EMPTY_DAILY_BOOKING_SUMMARY_STATE: DailyBookingSummaryDurableState = {
  sentAt: null,
  providerMessageId: null,
  channel: null,
  callbackToken: null,
  recipient: null,
  message: null,
  lockUntil: null,
  fallbackLockUntil: null,
  fallbackWhatsappMessageId: null,
  fallbackSentAt: null,
  fallbackProviderMessageId: null,
  expiresAt: null,
};

export function readRequiredStateString(
  body: Record<string, unknown> | null,
  key: string,
): string | null {
  const value = body?.[key];
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}
