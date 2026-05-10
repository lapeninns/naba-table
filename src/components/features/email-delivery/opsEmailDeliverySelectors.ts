'use client';

import {
  EMAIL_DELIVERY_STATUS_LABELS,
  formatEmailDeliveryOccurredAt,
} from '@src/lib/email-delivery/presentation';

import type { OpsEmailDeliveryTableRowViewModel } from '@/components/features/email-delivery/opsEmailDeliveryTypes';
import type { EmailDeliveryStatus, OpsEmailDeliveryAttemptDTO } from '@/types/emailDelivery';

function parseIsoMs(value: string | null): number {
  if (!value) return 0;
  const ms = Date.parse(value);
  return Number.isFinite(ms) ? ms : 0;
}

function getStatusSortValue(status: EmailDeliveryStatus): string {
  return (EMAIL_DELIVERY_STATUS_LABELS[status] ?? status).toLowerCase();
}

export function getOpsEmailDeliveryAttemptKey(attempt: OpsEmailDeliveryAttemptDTO): string {
  return `${attempt.messageId}__${attempt.recipientEmail.toLowerCase()}`;
}

export function resolveOpsEmailDeliveryAttemptSubject(attempt: OpsEmailDeliveryAttemptDTO): string {
  for (const event of attempt.events) {
    const meta = event.metadata;
    if (!meta || typeof meta !== 'object') continue;
    const subject = (meta as { subject?: unknown }).subject;
    if (typeof subject === 'string' && subject.trim().length > 0) {
      return subject.trim();
    }
  }

  return attempt.templateType ?? attempt.emailType ?? 'Email';
}

export function buildOpsEmailDeliveryTableRows(params: {
  attempts: OpsEmailDeliveryAttemptDTO[];
  timezone: string;
}): OpsEmailDeliveryTableRowViewModel[] {
  const { attempts, timezone } = params;

  return attempts.map((attempt) => ({
    attemptKey: getOpsEmailDeliveryAttemptKey(attempt),
    attempt,
    currentStatusLabel:
      EMAIL_DELIVERY_STATUS_LABELS[attempt.currentStatus] ?? attempt.currentStatus,
    subject: resolveOpsEmailDeliveryAttemptSubject(attempt),
    recipientEmail: attempt.recipientEmail,
    emailType: attempt.emailType,
    bookingReference: attempt.booking?.reference ?? null,
    customerName: attempt.booking?.customerName ?? null,
    sentAtLabel: formatEmailDeliveryOccurredAt(attempt.currentOccurredAt, timezone),
    sentAtMs: parseIsoMs(attempt.currentOccurredAt),
    statusSortValue: getStatusSortValue(attempt.currentStatus),
    canRetry: attempt.currentStatus === 'failed' || attempt.currentStatus === 'bounced',
  }));
}
