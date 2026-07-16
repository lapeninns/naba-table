import { redactSmsRecipientPhone } from '@/lib/sms/phone-redaction';

import type { OpsSmsDeliveryAttemptDTO, SmsDeliveryEventDTO } from '@/types/smsDelivery';

export function maskSmsRecipientPhone(value: string): string {
  return redactSmsRecipientPhone(value);
}

export function sanitizeOpsSmsDeliveryAttempts(
  attempts: readonly OpsSmsDeliveryAttemptDTO[],
): OpsSmsDeliveryAttemptDTO[] {
  return attempts.map((attempt) => ({
    ...attempt,
    recipientPhone: maskSmsRecipientPhone(attempt.recipientPhone),
    events: sanitizeOpsSmsDeliveryEvents(attempt.events),
  }));
}

export function sanitizeOpsSmsDeliveryEvents(
  events: readonly SmsDeliveryEventDTO[],
): SmsDeliveryEventDTO[] {
  return events.map((event) => ({
    ...event,
    recipientPhone: maskSmsRecipientPhone(event.recipientPhone),
    error: null,
    metadata: null,
    channel: event.channel,
    fallbackForAttemptId: event.fallbackForAttemptId ?? null,
    logicalNotificationId: event.logicalNotificationId ?? null,
  }));
}
