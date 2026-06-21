import { describe, expect, it } from 'vitest';

import {
  DEFAULT_OPS_EMAIL_DELIVERY_SORT_STATE,
  getNextOpsEmailDeliverySortState,
  sortOpsEmailDeliveryTableRows,
} from '@/components/features/email-delivery/opsEmailDeliveryTableDomain';

import type { OpsEmailDeliveryTableRowViewModel } from '@/components/features/email-delivery/opsEmailDeliveryTypes';

describe('opsEmailDeliveryTableDomain', () => {
  it('toggles current sort direction and starts new columns ascending', () => {
    expect(
      getNextOpsEmailDeliverySortState(DEFAULT_OPS_EMAIL_DELIVERY_SORT_STATE, 'sentAt'),
    ).toEqual({
      column: 'sentAt',
      direction: 'asc',
    });
    expect(
      getNextOpsEmailDeliverySortState(DEFAULT_OPS_EMAIL_DELIVERY_SORT_STATE, 'status'),
    ).toEqual({
      column: 'status',
      direction: 'asc',
    });
  });

  it('sorts by sent time with message id tie-breakers', () => {
    expect(
      sortOpsEmailDeliveryTableRows({
        rows: [row('b', 200, 'delivered'), row('a', 100, 'failed'), row('c', 200, 'sent')],
        sortState: { column: 'sentAt', direction: 'desc' },
      }).map((item) => item.attempt.messageId),
    ).toEqual(['c', 'b', 'a']);

    expect(
      sortOpsEmailDeliveryTableRows({
        rows: [row('b', 200, 'delivered'), row('a', 100, 'failed'), row('c', 200, 'sent')],
        sortState: { column: 'sentAt', direction: 'asc' },
      }).map((item) => item.attempt.messageId),
    ).toEqual(['a', 'b', 'c']);
  });

  it('sorts by status and falls back to recent sent time then message id', () => {
    expect(
      sortOpsEmailDeliveryTableRows({
        rows: [row('b', 200, 'failed'), row('a', 100, 'delivered'), row('c', 300, 'failed')],
        sortState: { column: 'status', direction: 'asc' },
      }).map((item) => item.attempt.messageId),
    ).toEqual(['a', 'c', 'b']);
  });
});

function row(
  messageId: string,
  sentAtMs: number,
  statusSortValue: string,
): OpsEmailDeliveryTableRowViewModel {
  return {
    attempt: {
      booking: null,
      bookingId: null,
      currentOccurredAt: new Date(sentAtMs).toISOString(),
      currentStatus: 'delivered',
      emailType: 'created',
      events: [],
      messageId,
      provider: 'resend',
      recipientEmail: `${messageId}@example.com`,
      templateType: 'booking_confirmation',
    },
    attemptKey: messageId,
    bookingReference: null,
    canRetry: false,
    currentStatusLabel: statusSortValue,
    customerName: null,
    emailType: null,
    recipientEmail: `${messageId}@example.com`,
    sentAtLabel: null,
    sentAtMs,
    statusSortValue,
    subject: messageId,
  };
}
