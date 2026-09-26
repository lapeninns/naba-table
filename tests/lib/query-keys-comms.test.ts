import { describe, expect, it } from 'vitest';

import { queryKeys } from '@/lib/query/keys';

function startsWith(key: readonly unknown[], prefix: readonly unknown[]) {
  return prefix.every((part, index) => key[index] === part);
}

describe('comms query key prefixes', () => {
  it('feed and summary prefixes cover every filter of one restaurant only', () => {
    const feed = queryKeys.opsEmailDelivery.feed({
      restaurantId: 'r1',
      range: '7d',
      page: 2,
      pageSize: 25,
      statusKey: 'failed',
      recipientEmail: 'guest@example.com',
    });
    const summary = queryKeys.opsEmailDelivery.summary({ restaurantId: 'r1', range: '30d' });

    expect(startsWith(feed, queryKeys.opsEmailDelivery.feedPrefix('r1'))).toBe(true);
    expect(startsWith(feed, queryKeys.opsEmailDelivery.feedPrefix('r2'))).toBe(false);
    expect(startsWith(summary, queryKeys.opsEmailDelivery.summaryPrefix('r1'))).toBe(true);
    expect(startsWith(summary, queryKeys.opsEmailDelivery.feedPrefix('r1'))).toBe(false);
  });

  it('the booking log prefix matches every page size of that booking', () => {
    expect(
      startsWith(
        queryKeys.opsBookings.emailDeliveryLog('b1', 20),
        queryKeys.opsEmailDelivery.bookingLogPrefix('b1'),
      ),
    ).toBe(true);
    expect(
      startsWith(
        queryKeys.opsBookings.emailDeliveryLog('b2', 20),
        queryKeys.opsEmailDelivery.bookingLogPrefix('b1'),
      ),
    ).toBe(false);
  });

  it('the queue prefix matches every page and status of one restaurant', () => {
    const feed = queryKeys.opsEmailQueue.feed({
      restaurantId: 'r1',
      page: 1,
      pageSize: 10,
      status: 'failed',
    });
    expect(startsWith(feed, queryKeys.opsEmailQueue.feedPrefix('r1'))).toBe(true);
  });

  it('template previews are keyed by restaurant, template and draft hash', () => {
    expect(queryKeys.opsEmailTemplates.preview('r1', 'confirmation', 'abc')).toEqual([
      'ops',
      'email-template-preview',
      'r1',
      'confirmation',
      'abc',
    ]);
  });
});
