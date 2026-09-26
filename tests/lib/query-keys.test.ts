import { describe, expect, it } from 'vitest';

import { queryKeys } from '@/lib/query/keys';

/**
 * The factory entries below replaced inline literals. The persisted cache, prefix
 * invalidation and existing tests match on the exact arrays, so each factory must return
 * the same array the literal produced (the right-hand sides are the former literals).
 */
describe('query key factory matches the former inline literals', () => {
  it('ops booking dialog, list prefix, email delivery log and placeholder keys', () => {
    expect(queryKeys.opsBookings.dialog('booking-1')).toEqual([
      'ops',
      'bookings',
      'dialog',
      'booking-1',
    ]);
    expect(queryKeys.opsBookings.dialog('disabled')).toEqual([
      'ops',
      'bookings',
      'dialog',
      'disabled',
    ]);
    expect(queryKeys.opsBookings.listPrefix()).toEqual(['ops', 'bookings', 'list']);
    expect(queryKeys.opsBookings.detail('disabled')).toEqual([
      'ops',
      'bookings',
      'detail',
      'disabled',
    ]);
    expect(queryKeys.opsBookings.all).toEqual(['ops', 'bookings']);
    expect(queryKeys.opsBookings.emailDeliveryLog('booking-1', 20)).toEqual([
      'ops',
      'bookings',
      'booking-1',
      'email-delivery',
      20,
    ]);
    expect(queryKeys.opsBookings.emailDeliveryLog(null, 20)).toEqual([
      'ops',
      'bookings',
      'disabled',
      'email-delivery',
      20,
    ]);
  });

  it('ops dashboard heatmap prefix and placeholder keys', () => {
    expect(queryKeys.opsDashboard.heatmapPrefix('rest-1')).toEqual([
      'ops',
      'dashboard',
      'rest-1',
      'heatmap',
    ]);
    // The prefix must match every concrete heatmap key for the restaurant.
    expect(queryKeys.opsDashboard.heatmap('rest-1', 'a', 'b').slice(0, 4)).toEqual(
      queryKeys.opsDashboard.heatmapPrefix('rest-1'),
    );
    expect(queryKeys.opsDashboard.summaryDisabled()).toEqual([
      'ops',
      'dashboard',
      'summary',
      'disabled',
    ]);
    expect(queryKeys.opsDashboard.heatmapDisabled()).toEqual([
      'ops',
      'dashboard',
      'heatmap',
      'disabled',
    ]);
  });

  it('ops strategic settings and table timeline placeholders', () => {
    expect(queryKeys.opsSettings.strategicConfig('disabled')).toEqual([
      'ops',
      'settings',
      'strategic-config',
      'disabled',
    ]);
    expect(queryKeys.opsTables.timelineDisabled()).toEqual([
      'ops',
      'tables',
      'timeline',
      'disabled',
    ]);
  });

  it('ops review growth summary', () => {
    expect(queryKeys.opsReviewGrowth.summary('rest-1', '30d')).toEqual([
      'ops',
      'review-growth',
      'rest-1',
      '30d',
    ]);
    expect(queryKeys.opsReviewGrowth.summary(null, '7d')).toEqual([
      'ops',
      'review-growth',
      'disabled',
      '7d',
    ]);
  });

  it('ops email delivery feed with and without filters', () => {
    expect(
      queryKeys.opsEmailDelivery.feed({
        restaurantId: 'rest-1',
        range: '7d',
        page: 2,
        pageSize: 50,
        statusKey: 'all',
      }),
    ).toEqual(['ops', 'email-delivery', 'rest-1', '7d', 2, 50, 'all', '', '', '', '', '', '', '']);

    expect(
      queryKeys.opsEmailDelivery.feed({
        restaurantId: null,
        range: '24h',
        page: 1,
        pageSize: 25,
        statusKey: 'bounced,delivered',
        simulateEmailDeliveryError: true,
        fixture: ' fx ',
        recipientEmail: ' a@b.test ',
        messageId: ' m-1 ',
        bookingRef: ' ab12 ',
        templateType: ' confirmation ',
        emailType: ' transactional ',
      }),
    ).toEqual([
      'ops',
      'email-delivery',
      'disabled',
      '24h',
      1,
      25,
      'bounced,delivered',
      'forced-error',
      'fx',
      'a@b.test',
      'm-1',
      'AB12',
      'confirmation',
      'transactional',
    ]);
  });

  it('ops email delivery summary with and without filters', () => {
    expect(queryKeys.opsEmailDelivery.summary({ restaurantId: 'rest-1', range: '7d' })).toEqual([
      'ops',
      'email-delivery-summary',
      'rest-1',
      '7d',
      '',
      '',
      '',
      '',
      '',
      '',
    ]);
    expect(
      queryKeys.opsEmailDelivery.summary({
        restaurantId: null,
        range: '30d',
        simulateEmailDeliveryError: true,
        recipientEmail: ' a@b.test ',
        messageId: ' m-1 ',
        bookingRef: ' ab12 ',
        templateType: ' t ',
        emailType: ' e ',
      }),
    ).toEqual([
      'ops',
      'email-delivery-summary',
      'disabled',
      '30d',
      'forced-error',
      'a@b.test',
      'm-1',
      'AB12',
      't',
      'e',
    ]);
  });

  it('ops email queue feed', () => {
    expect(queryKeys.opsEmailQueue.feed({ restaurantId: 'rest-1', page: 1, pageSize: 25 })).toEqual(
      ['ops', 'email-queue', 'rest-1', 1, 25, 'all', ''],
    );
    expect(
      queryKeys.opsEmailQueue.feed({
        restaurantId: null,
        page: 3,
        pageSize: 10,
        status: 'dlq',
        fixture: ' fx ',
      }),
    ).toEqual(['ops', 'email-queue', 'disabled', 3, 10, 'dlq', 'fx']);
  });

  it('guest reservation schedule prefix', () => {
    expect(queryKeys.reservations.schedulePrefix()).toEqual(['reservations', 'schedule']);
  });

  it('ops booking status summary', () => {
    expect(
      queryKeys.opsBookings.statusSummary(
        'rest-1',
        '2026-09-01',
        '2026-09-30',
        'cancelled,confirmed',
      ),
    ).toEqual([
      'ops',
      'bookings',
      'status-summary',
      'rest-1',
      '2026-09-01',
      '2026-09-30',
      'cancelled,confirmed',
    ]);
    expect(queryKeys.opsBookings.statusSummary(null, null, null, '')).toEqual([
      'ops',
      'bookings',
      'status-summary',
      'none',
      null,
      null,
      '',
    ]);
  });

  it('owner restaurant placeholder keys reuse the factory with the disabled id', () => {
    expect(queryKeys.ownerRestaurants.hours('disabled')).toEqual([
      'owner',
      'restaurants',
      'disabled',
      'hours',
    ]);
    expect(queryKeys.ownerRestaurants.details('disabled')).toEqual([
      'owner',
      'restaurants',
      'disabled',
      'details',
    ]);
    expect(queryKeys.ownerRestaurants.servicePeriods('disabled')).toEqual([
      'owner',
      'restaurants',
      'disabled',
      'service-periods',
    ]);
  });
});
