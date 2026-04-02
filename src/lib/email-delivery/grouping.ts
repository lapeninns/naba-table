import type { EmailDeliveryEventDTO, EmailDeliveryStatus } from "@/types/emailDelivery";

export type EmailDeliveryGroup = {
  messageId: string;
  recipientEmail: string;
  emailType: string | null;
  templateType: string | null;
  subject: string | null;
  variantName: string | null;
  currentStatus: EmailDeliveryStatus;
  currentOccurredAt: string | null;
  events: EmailDeliveryEventDTO[];
};

function parseIsoMs(value: string): number | null {
  const ms = Date.parse(value);
  return Number.isFinite(ms) ? ms : null;
}

function resolveSubject(events: EmailDeliveryEventDTO[]): string | null {
  for (const event of events) {
    const meta = event.metadata;
    if (!meta || typeof meta !== "object") continue;
    const subject = (meta as { subject?: unknown }).subject;
    if (typeof subject === "string" && subject.trim().length > 0) {
      return subject.trim();
    }
  }
  return null;
}

function resolveVariantName(events: EmailDeliveryEventDTO[]): string | null {
  for (const event of events) {
    const meta = event.metadata;
    if (!meta || typeof meta !== 'object') continue;

    const variantName = (meta as { variantName?: unknown }).variantName;
    if (typeof variantName === 'string' && variantName.trim().length > 0) {
      return variantName.trim();
    }

    const variantId = (meta as { variantId?: unknown }).variantId;
    if (typeof variantId === 'string' && variantId.trim().length > 0) {
      return variantId.trim();
    }
  }
  return null;
}

function sortByOccurredAtAsc(a: EmailDeliveryEventDTO, b: EmailDeliveryEventDTO): number {
  const aMs = a.occurredAt ? parseIsoMs(a.occurredAt) : null;
  const bMs = b.occurredAt ? parseIsoMs(b.occurredAt) : null;
  if (aMs === null && bMs === null) return 0;
  if (aMs === null) return 1;
  if (bMs === null) return -1;
  return aMs - bMs;
}

function sortByOccurredAtDesc(a: EmailDeliveryEventDTO, b: EmailDeliveryEventDTO): number {
  // Descending (latest first), but keep invalid/unknown timestamps at the end.
  const aMs = a.occurredAt ? parseIsoMs(a.occurredAt) : null;
  const bMs = b.occurredAt ? parseIsoMs(b.occurredAt) : null;
  if (aMs === null && bMs === null) return 0;
  if (aMs === null) return 1;
  if (bMs === null) return -1;
  return bMs - aMs;
}

export function groupEmailDeliveryEvents(
  events: readonly EmailDeliveryEventDTO[],
): EmailDeliveryGroup[] {
  const buckets = new Map<string, EmailDeliveryEventDTO[]>();

  for (const event of events) {
    const messageId = event.messageId?.trim();
    const recipient = event.recipientEmail?.trim();
    if (!messageId || !recipient) continue;
    const key = `${messageId}__${recipient.toLowerCase()}`;
    const existing = buckets.get(key);
    if (existing) {
      existing.push(event);
    } else {
      buckets.set(key, [event]);
    }
  }

  const groups: EmailDeliveryGroup[] = [];
  for (const groupEvents of buckets.values()) {
    const sortedDesc = [...groupEvents].sort(sortByOccurredAtDesc);
    const sortedAsc = [...groupEvents].sort(sortByOccurredAtAsc);

    const current = sortedDesc[0];
    if (!current) continue;

    groups.push({
      messageId: current.messageId,
      recipientEmail: current.recipientEmail,
      emailType: current.emailType ?? null,
      templateType: current.templateType ?? null,
      subject: resolveSubject(sortedDesc),
      variantName: resolveVariantName(sortedDesc),
      currentStatus: current.status,
      currentOccurredAt: current.occurredAt ?? null,
      events: sortedAsc,
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
