import { describe, expect, it } from 'vitest';

import {
  buildDefaultsFromProps,
  buildOpsEmailDeliveryQueryString,
  buildOpsEmailDeliverySubmittedSearch,
  buildOpsEmailDeliveryTableRows,
  parseOpsEmailDeliveryQuery,
  parseOpsEmailDeliveryUuid,
  resolveOpsEmailDeliveryAttemptSubject,
  toggleOpsEmailDeliveryStatusFilter,
} from '@/components/features/email-delivery/opsEmailDeliverySelectors';
import { DEFAULT_OPS_EMAIL_DELIVERY_FILTER_STATE } from '@/components/features/email-delivery/opsEmailDeliveryTypes';

import type { OpsEmailDeliveryAttemptDTO } from '@/types/emailDelivery';

const defaults = DEFAULT_OPS_EMAIL_DELIVERY_FILTER_STATE;

describe('opsEmailDeliverySelectors', () => {
  it('parses uuid restaurant ids and ignores invalid ones', () => {
    expect(parseOpsEmailDeliveryUuid('11111111-1111-4111-8111-111111111111')).toBe(
      '11111111-1111-4111-8111-111111111111',
    );
    expect(parseOpsEmailDeliveryUuid('rest-1')).toBeNull();
    expect(parseOpsEmailDeliveryUuid('')).toBeNull();
  });

  it('parses query state with tab, range, status, and search filters', () => {
    const parsed = parseOpsEmailDeliveryQuery(
      'restaurantId=11111111-1111-4111-8111-111111111111&tab=queue&range=24h&page=2&pageSize=25&status=failed,bounced&recipientEmail=ops%40example.com&refresh=30s&templateType=confirmation&emailType=created',
      defaults,
    );

    expect(parsed).toMatchObject({
      restaurantId: '11111111-1111-4111-8111-111111111111',
      tab: 'queue',
      range: '24h',
      page: 2,
      pageSize: 25,
      refresh: '30s',
      statuses: ['failed', 'bounced'],
      recipientEmail: 'ops@example.com',
      templateType: 'confirmation',
      emailType: 'created',
      searchField: 'recipientEmail',
      searchValue: 'ops@example.com',
    });
  });

  it('falls back to defaults and initial restaurant when params are missing', () => {
    const fromProps = buildDefaultsFromProps({
      initialTab: 'analytics',
      initialRange: '30d',
      initialPage: 3,
      initialPageSize: 100,
      initialStatuses: ['failed'],
      initialBookingRef: 'abc123',
    });
    const parsed = parseOpsEmailDeliveryQuery('', fromProps, '11111111-1111-4111-8111-111111111111');

    expect(parsed.tab).toBe('analytics');
    expect(parsed.range).toBe('30d');
    expect(parsed.page).toBe(3);
    expect(parsed.pageSize).toBe(100);
    expect(parsed.statuses).toEqual(['failed']);
    expect(parsed.bookingRef).toBe('ABC123');
    expect(parsed.searchField).toBe('bookingRef');
    expect(parsed.restaurantId).toBe('11111111-1111-4111-8111-111111111111');
  });

  it('builds query strings and drops harness params', () => {
    const next = buildOpsEmailDeliveryQueryString({
      currentSearch:
        'restaurantId=rest-1&tab=delivery-log&fixture=x&queueFixture=loading&simulateEmailDeliveryError=1&simulateRetryMutationError=1',
      current: defaults,
      defaults,
      effectiveRestaurantId: 'rest-1',
      next: { tab: 'queue', range: '24h', page: 2 },
    });

    const params = new URLSearchParams(next);
    expect(params.get('tab')).toBe('queue');
    expect(params.get('range')).toBe('24h');
    expect(params.get('page')).toBe('2');
    expect(params.get('restaurantId')).toBe('rest-1');
    expect(params.has('fixture')).toBe(false);
    expect(params.has('queueFixture')).toBe(false);
    expect(params.has('simulateEmailDeliveryError')).toBe(false);
    expect(params.has('simulateRetryMutationError')).toBe(false);
  });

  it('omits delivery-log tab from the query string', () => {
    const next = buildOpsEmailDeliveryQueryString({
      currentSearch: 'restaurantId=rest-1&tab=queue',
      current: { ...defaults, tab: 'queue' },
      defaults,
      effectiveRestaurantId: 'rest-1',
      next: { tab: 'delivery-log' },
    });
    expect(new URLSearchParams(next).has('tab')).toBe(false);
  });

  it('builds submitted search patches per field', () => {
    expect(
      buildOpsEmailDeliverySubmittedSearch({
        searchField: 'recipientEmail',
        searchValue: '  Ops@Example.com ',
      }),
    ).toEqual({
      recipientEmail: 'ops@example.com',
      messageId: null,
      bookingRef: null,
      page: 1,
    });
    expect(
      buildOpsEmailDeliverySubmittedSearch({
        searchField: 'bookingRef',
        searchValue: 'abc123',
      }),
    ).toEqual({
      recipientEmail: null,
      messageId: null,
      bookingRef: 'ABC123',
      page: 1,
    });
  });

  it('toggles status filters', () => {
    expect(
      toggleOpsEmailDeliveryStatusFilter({
        enabled: true,
        status: 'failed',
        statuses: ['bounced'],
      }),
    ).toEqual(['bounced', 'failed']);
    expect(
      toggleOpsEmailDeliveryStatusFilter({
        enabled: false,
        status: 'failed',
        statuses: ['failed', 'bounced'],
      }),
    ).toEqual(['bounced']);
  });

  it('builds row view models with retry eligibility and subject resolution', () => {
    const attempts: OpsEmailDeliveryAttemptDTO[] = [
      {
        id: 'log-1',
        messageId: 'msg-1',
        recipientEmail: 'failed@example.com',
        bookingId: 'booking-1',
        emailType: 'created',
        templateType: 'booking_confirmation',
        provider: 'resend',
        currentStatus: 'failed',
        currentOccurredAt: '2026-03-20T15:00:00Z',
        events: [
          {
            id: 'evt-1',
            bookingId: 'booking-1',
            restaurantId: 'rest-1',
            emailType: 'created',
            templateType: 'booking_confirmation',
            recipientEmail: 'failed@example.com',
            messageId: 'msg-1',
            status: 'failed',
            provider: 'resend',
            occurredAt: '2026-03-20T15:00:00Z',
            error: 'Mailbox unavailable',
            metadata: { subject: 'Your booking confirmation' },
          },
        ],
        booking: {
          id: 'booking-1',
          reference: 'REF001',
          bookingDate: '2026-03-20',
          startTime: '19:00',
          endTime: '20:30',
          customerName: 'Alex',
          partySize: 2,
        },
      },
      {
        messageId: 'msg-2',
        recipientEmail: 'ok@example.com',
        bookingId: null,
        emailType: 'updated',
        templateType: null,
        provider: 'resend',
        currentStatus: 'delivered',
        currentOccurredAt: '2026-03-20T14:00:00Z',
        events: [],
        booking: null,
      },
    ];

    const rows = buildOpsEmailDeliveryTableRows({ attempts, timezone: 'UTC' });
    expect(rows[0]?.canRetry).toBe(true);
    expect(rows[0]?.subject).toBe('Your booking confirmation');
    expect(rows[0]?.bookingReference).toBe('REF001');
    expect(rows[1]?.canRetry).toBe(false);
    expect(resolveOpsEmailDeliveryAttemptSubject(attempts[1]!)).toBe('updated');
  });
});
