import type {
  SmsDeliveryChannel,
  SmsDeliveryEventDTO,
  SmsDeliveryProvider,
  SmsDeliveryStatus,
} from '@/types/smsDelivery';

export type SmsDeliveryAttemptAggregate = {
  readonly bookingId: string | null;
  readonly channel: SmsDeliveryChannel;
  readonly currentEventId: string;
  readonly currentOccurredAt: string | null;
  readonly currentProviderStatus: string | null;
  readonly currentStatus: SmsDeliveryStatus;
  readonly events: readonly SmsDeliveryEventDTO[];
  readonly fallbackForAttemptId: string | null;
  readonly logicalNotificationId: string | null;
  readonly messageSid: string;
  readonly provider: SmsDeliveryProvider | null;
  readonly recipientPhone: string;
  readonly smsType: string | null;
};

export type MobileDeliveryAttemptCandidate = {
  readonly aggregate: SmsDeliveryAttemptAggregate;
  readonly attemptId: string;
  readonly providerMessageId: string | null;
};

function parseIsoMs(value: string | null | undefined): number {
  if (!value) return 0;
  const milliseconds = new Date(value).getTime();
  return Number.isFinite(milliseconds) ? milliseconds : 0;
}

function isNewerEvent(
  candidate: SmsDeliveryEventDTO,
  current: SmsDeliveryAttemptAggregate,
): boolean {
  const candidateMs = parseIsoMs(candidate.occurredAt);
  const currentMs = parseIsoMs(current.currentOccurredAt);
  if (candidateMs !== currentMs) return candidateMs > currentMs;
  return candidate.id > current.currentEventId;
}

function providerMessageKey(
  provider: SmsDeliveryProvider | null,
  messageSid: string | null,
): string | null {
  if (!provider || !messageSid?.trim()) return null;
  return `${provider}:${messageSid.trim()}`;
}

function withLineage(
  event: SmsDeliveryEventDTO,
  candidate: MobileDeliveryAttemptCandidate,
): SmsDeliveryEventDTO {
  return {
    ...event,
    fallbackForAttemptId: candidate.aggregate.fallbackForAttemptId,
    logicalNotificationId: candidate.aggregate.logicalNotificationId,
  };
}

function mergeMobileSmsLineage(
  current: SmsDeliveryAttemptAggregate,
  candidate: MobileDeliveryAttemptCandidate,
): SmsDeliveryAttemptAggregate {
  return {
    ...current,
    bookingId: current.bookingId ?? candidate.aggregate.bookingId,
    events: current.events.map((event) => withLineage(event, candidate)),
    fallbackForAttemptId: candidate.aggregate.fallbackForAttemptId,
    logicalNotificationId: candidate.aggregate.logicalNotificationId,
    provider: current.provider ?? candidate.aggregate.provider,
    smsType: current.smsType ?? candidate.aggregate.smsType,
  };
}

export function aggregateSmsDeliveryAttempts(input: {
  readonly mobileAttempts: readonly MobileDeliveryAttemptCandidate[];
  readonly smsLogEvents: readonly SmsDeliveryEventDTO[];
}): SmsDeliveryAttemptAggregate[] {
  const buckets = new Map<string, SmsDeliveryAttemptAggregate>();
  const providerBuckets = new Map<string, string>();

  for (const event of input.smsLogEvents) {
    const providerKey = providerMessageKey(event.provider, event.messageSid);
    const bucketKey = providerKey ?? `legacy:${event.messageSid}:${event.recipientPhone}`;
    const current = buckets.get(bucketKey);

    if (!current) {
      buckets.set(bucketKey, {
        bookingId: event.bookingId,
        channel: 'sms',
        currentEventId: event.id,
        currentOccurredAt: event.occurredAt,
        currentProviderStatus: event.providerStatus ?? event.status,
        currentStatus: event.status,
        events: [event],
        fallbackForAttemptId: null,
        logicalNotificationId: null,
        messageSid: event.messageSid,
        provider: event.provider,
        recipientPhone: event.recipientPhone,
        smsType: event.smsType,
      });
      if (providerKey) providerBuckets.set(providerKey, bucketKey);
      continue;
    }

    const events = [...current.events, event];
    buckets.set(
      bucketKey,
      isNewerEvent(event, current)
        ? {
            ...current,
            bookingId: event.bookingId ?? current.bookingId,
            currentEventId: event.id,
            currentOccurredAt: event.occurredAt,
            currentProviderStatus: event.providerStatus ?? event.status,
            currentStatus: event.status,
            events,
            provider: event.provider ?? current.provider,
            smsType: event.smsType ?? current.smsType,
          }
        : { ...current, events },
    );
  }

  for (const candidate of input.mobileAttempts) {
    const providerKey = providerMessageKey(
      candidate.aggregate.provider,
      candidate.providerMessageId,
    );
    const matchingBucket =
      candidate.aggregate.channel === 'sms' && providerKey
        ? providerBuckets.get(providerKey)
        : undefined;

    if (matchingBucket) {
      const current = buckets.get(matchingBucket);
      if (current) {
        buckets.set(matchingBucket, mergeMobileSmsLineage(current, candidate));
      }
      continue;
    }

    buckets.set(`mobile:${candidate.attemptId}`, candidate.aggregate);
  }

  return Array.from(buckets.values());
}
