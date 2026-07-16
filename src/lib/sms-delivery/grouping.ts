import type { SmsDeliveryEventDTO, SmsDeliveryStatus } from '@/types/smsDelivery';

export type SmsDeliveryGroup = {
  messageSid: string;
  recipientPhone: string;
  smsType: string | null;
  currentStatus: SmsDeliveryStatus;
  currentOccurredAt: string | null;
  events: SmsDeliveryEventDTO[];
  channel?: SmsDeliveryEventDTO['channel'];
  fallbackForAttemptId?: string | null;
  logicalNotificationId?: string | null;
};

function parseIsoMs(value: string): number | null {
  const ms = Date.parse(value);
  return Number.isFinite(ms) ? ms : null;
}

function sortByOccurredAtAsc(a: SmsDeliveryEventDTO, b: SmsDeliveryEventDTO): number {
  const aMs = a.occurredAt ? parseIsoMs(a.occurredAt) : null;
  const bMs = b.occurredAt ? parseIsoMs(b.occurredAt) : null;
  if (aMs === null && bMs === null) return 0;
  if (aMs === null) return 1;
  if (bMs === null) return -1;
  return aMs - bMs;
}

function sortByOccurredAtDesc(a: SmsDeliveryEventDTO, b: SmsDeliveryEventDTO): number {
  const aMs = a.occurredAt ? parseIsoMs(a.occurredAt) : null;
  const bMs = b.occurredAt ? parseIsoMs(b.occurredAt) : null;
  if (aMs === null && bMs === null) return 0;
  if (aMs === null) return 1;
  if (bMs === null) return -1;
  return bMs - aMs;
}

export function groupSmsDeliveryEvents(events: readonly SmsDeliveryEventDTO[]): SmsDeliveryGroup[] {
  const buckets = new Map<string, SmsDeliveryEventDTO[]>();

  for (const event of events) {
    const messageSid = event.messageSid?.trim();
    const recipient = event.recipientPhone?.trim();
    if (!messageSid || !recipient) continue;
    const key = `${messageSid}__${recipient}`;
    const existing = buckets.get(key);
    if (existing) {
      existing.push(event);
    } else {
      buckets.set(key, [event]);
    }
  }

  const groups: SmsDeliveryGroup[] = [];
  for (const groupEvents of buckets.values()) {
    const sortedDesc = [...groupEvents].sort(sortByOccurredAtDesc);
    const sortedAsc = [...groupEvents].sort(sortByOccurredAtAsc);
    const current = sortedDesc[0];
    if (!current) continue;

    groups.push({
      messageSid: current.messageSid,
      recipientPhone: current.recipientPhone,
      smsType: current.smsType ?? null,
      currentStatus: current.status,
      currentOccurredAt: current.occurredAt ?? null,
      events: sortedAsc,
      channel: current.channel,
      fallbackForAttemptId: current.fallbackForAttemptId ?? null,
      logicalNotificationId: current.logicalNotificationId ?? null,
    });
  }

  groups.sort((a, b) => {
    const aMs = a.currentOccurredAt ? parseIsoMs(a.currentOccurredAt) : null;
    const bMs = b.currentOccurredAt ? parseIsoMs(b.currentOccurredAt) : null;
    if (aMs === null && bMs === null) return 0;
    if (aMs === null) return 1;
    if (bMs === null) return -1;
    return bMs - aMs;
  });

  return groups;
}
