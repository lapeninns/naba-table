import { dehydrate, QueryClient, type Query } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { queryKeys } from '@/lib/query/keys';
import {
  buildQueryStorageKey,
  clearPersistedQueryCache,
  configureQueryPersistence,
  isPiiQueryKey,
  isVolatileOpsIntegrationQueryKey,
  shouldPersistQuery,
} from '@/lib/query/persist';

function queryWithKey(queryKey: Query['queryKey'], meta?: Query['meta']): Query {
  return { queryKey, meta } as Query;
}

describe('query persistence filter', () => {
  it.each(
    [
      queryKeys.opsRestaurants.googleBusinessProfile('rest-1'),
      queryKeys.opsRestaurants.googleBusinessProfileLocations('rest-1'),
      ['dual-sync-state', 'rest-1'],
      ['dual-sync-operations', 'rest-1', 50, null, null, null],
      ['dual-sync-publish-jobs', 'rest-1', 25, null, null],
      ['dual-sync-publish-job-detail', 'rest-1', 'job-1'],
      ['ops', 'food-menus', 'rest-1', 'import-reviews'],
      queryKeys.opsSmsDelivery.restaurantFeed({
        restaurantId: 'rest-1',
        range: '7d',
        page: 1,
        pageSize: 50,
        statuses: ['queued', 'sent'],
      }),
      queryKeys.opsSmsDelivery.bookingLog('booking-1', 20),
      ['ops', 'bookings', 'booking-1', 'sms-delivery', 20],
    ].map((queryKey) => [queryKey] as const),
  )('excludes volatile ops integration query %#', (queryKey) => {
    expect(isVolatileOpsIntegrationQueryKey(queryKey)).toBe(true);
    expect(shouldPersistQuery(queryWithKey(queryKey))).toBe(false);
  });

  it.each(
    [
      queryKeys.team.invitations('rest-1', 'pending'),
      queryKeys.team.invitations('rest-1', 'all'),
      queryKeys.opsRestaurants.detail('rest-1'),
      queryKeys.opsRestaurants.emailTemplates('rest-1'),
      queryKeys.opsCustomers.list({ restaurantId: 'rest-1' }),
    ].map((queryKey) => [queryKey] as const),
  )('excludes staff, invitee, template and customer query %# even without meta', (queryKey) => {
    expect(isPiiQueryKey(queryKey)).toBe(true);
    expect(isVolatileOpsIntegrationQueryKey(queryKey)).toBe(false);
    expect(shouldPersistQuery(queryWithKey(queryKey))).toBe(false);
  });

  it.each(
    [
      // BookingDTO: customerName, customerEmail, customerPhone (guest and ops flows).
      queryKeys.bookings.detail('booking-1'),
      queryKeys.bookings.list({ page: 1 }),
      // OpsBookingListItem / OpsBookingsPage: customerName, customerEmail, customerPhone.
      queryKeys.opsBookings.detail('booking-1'),
      queryKeys.opsBookings.list({ restaurantId: 'rest-1' }),
      ['ops', 'bookings', 'list'],
      // OpsBookingDialogBundle.booking is an OpsBookingListItem.
      ['ops', 'bookings', 'dialog', 'booking-1'],
      // EmailDeliveryEventDTO.recipientEmail.
      ['ops', 'bookings', 'booking-1', 'email-delivery', 20],
      // OpsDashboardData.bookings[]: customerName, customerEmail, customerPhone.
      queryKeys.opsDashboard.summary('rest-1', null),
      queryKeys.opsDashboard.summary('rest-1', '2026-09-25'),
      // RestaurantDTO: contactEmail, contactPhone, managerName, managerNotificationPhone.
      queryKeys.opsRestaurants.list(),
      queryKeys.opsRestaurants.list({ page: 1, search: 'x' }),
      // TableTimelineSegment.booking: customerName, customerEmail, customerPhone, notes.
      queryKeys.opsTables.timeline('rest-1', { service: 'all', includeSummary: true }),
      queryKeys.opsTables.timeline('rest-1'),
      // OpsEmailDeliveryAttemptDTO: recipientEmail and booking.customerName; the key embeds search terms.
      ['ops', 'email-delivery', 'rest-1', '7d', 1, 25, 'all', 'guest@example.com'],
      // Email queue rows: customerName and customerEmail.
      ['ops', 'email-queue', 'rest-1', 1],
      // Manual assignment holds: createdByName and createdByEmail (staff).
      queryKeys.manualAssign.context('booking-1'),
    ].map((queryKey) => [queryKey] as const),
  )('excludes guest booking and restaurant list query %# even without meta', (queryKey) => {
    expect(isPiiQueryKey(queryKey)).toBe(true);
    expect(shouldPersistQuery(queryWithKey(queryKey))).toBe(false);
  });

  it('allows stable unrelated query keys to persist', () => {
    // The restaurant detail record and booking detail used to be examples here; both carry
    // phone numbers/emails, so they are now in the PII deny-list above.
    expect(shouldPersistQuery(queryWithKey(queryKeys.opsRestaurants.hours('rest-1')))).toBe(true);
    expect(shouldPersistQuery(queryWithKey(queryKeys.team.memberships()))).toBe(true);
    // Assignment context carries booking times, party size and tables only.
    expect(
      shouldPersistQuery(queryWithKey(queryKeys.opsBookings.assignmentContext('booking-1'))),
    ).toBe(true);
    expect(
      shouldPersistQuery(queryWithKey(queryKeys.opsDashboard.heatmap('rest-1', 'a', 'b'))),
    ).toBe(true);
  });

  it('honors explicit persist false metadata', () => {
    expect(
      shouldPersistQuery(
        queryWithKey(queryKeys.opsRestaurants.hours('rest-1'), { persist: false }),
      ),
    ).toBe(false);
  });
});

describe('throttled query persistence', () => {
  const storageKey = buildQueryStorageKey('user-throttle');
  let queryClient: QueryClient;
  let unsubscribe: () => void;
  let setItemSpy: ReturnType<typeof vi.spyOn>;

  function writesFor(key: string): number {
    return setItemSpy.mock.calls.filter(([calledKey]) => calledKey === key).length;
  }

  function setVisibility(state: DocumentVisibilityState): void {
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => state });
  }

  beforeEach(async () => {
    vi.useFakeTimers();
    window.localStorage.clear();
    setItemSpy = vi.spyOn(Storage.prototype, 'setItem');
    queryClient = new QueryClient();
    unsubscribe = configureQueryPersistence(queryClient, { storageKey });
    // Let the async restore resolve so cache subscriptions are attached.
    await vi.advanceTimersByTimeAsync(0);
    setItemSpy.mockClear();
  });

  afterEach(() => {
    unsubscribe();
    queryClient.clear();
    setItemSpy.mockRestore();
    setVisibility('visible');
    window.localStorage.clear();
    vi.useRealTimers();
  });

  it('coalesces a burst of cache events into one trailing write per second', async () => {
    for (let index = 0; index < 50; index += 1) {
      queryClient.setQueryData(['restaurants', `r-${index}`], { index });
    }
    expect(writesFor(storageKey)).toBe(0);

    await vi.advanceTimersByTimeAsync(999);
    expect(writesFor(storageKey)).toBe(0);

    await vi.advanceTimersByTimeAsync(1);
    expect(writesFor(storageKey)).toBe(1);

    const stored = JSON.parse(window.localStorage.getItem(storageKey) ?? '{}') as {
      clientState: { queries: unknown[] };
    };
    expect(stored.clientState.queries).toHaveLength(50);

    // Continuous updates over three seconds stay at <= 1 write per second.
    for (let tick = 0; tick < 30; tick += 1) {
      queryClient.setQueryData(['restaurants', 'hot'], { tick });
      await vi.advanceTimersByTimeAsync(100);
    }
    await vi.advanceTimersByTimeAsync(1000);
    expect(writesFor(storageKey)).toBeLessThanOrEqual(1 + 4);
    expect(writesFor(storageKey)).toBeGreaterThanOrEqual(1 + 3);
  });

  it('skips writes when the persisted state is unchanged', async () => {
    queryClient.setQueryData(['restaurants', 'r-1'], { name: 'A' });
    await vi.advanceTimersByTimeAsync(1000);
    expect(writesFor(storageKey)).toBe(1);

    // Non-persistent (PII) query churn fires cache events but does not change what is stored.
    queryClient.setQueryDefaults(['bookings'], { meta: { persist: false } });
    queryClient.setQueryData(['bookings', 'list'], { guest: 'secret' });
    queryClient.setQueryData(['bookings', 'list'], { guest: 'secret-2' });
    await vi.advanceTimersByTimeAsync(1000);

    const stored = window.localStorage.getItem(storageKey) ?? '';
    expect(stored).not.toContain('secret');
    expect(writesFor(storageKey)).toBe(1);
  });

  it('flushes a pending write immediately on pagehide', async () => {
    queryClient.setQueryData(['restaurants', 'r-1'], { name: 'A' });
    expect(writesFor(storageKey)).toBe(0);

    window.dispatchEvent(new Event('pagehide'));
    expect(writesFor(storageKey)).toBe(1);
    expect(window.localStorage.getItem(storageKey)).toContain('"r-1"');

    await vi.advanceTimersByTimeAsync(2000);
    expect(writesFor(storageKey)).toBe(1);
  });

  it('flushes a pending write when the document becomes hidden', () => {
    queryClient.setQueryData(['restaurants', 'r-1'], { name: 'A' });

    setVisibility('visible');
    document.dispatchEvent(new Event('visibilitychange'));
    expect(writesFor(storageKey)).toBe(0);

    setVisibility('hidden');
    document.dispatchEvent(new Event('visibilitychange'));
    expect(writesFor(storageKey)).toBe(1);
  });

  it('drops pending writes and removes listeners on unsubscribe', async () => {
    queryClient.setQueryData(['restaurants', 'r-1'], { name: 'A' });
    unsubscribe();

    window.dispatchEvent(new Event('pagehide'));
    await vi.advanceTimersByTimeAsync(2000);
    expect(writesFor(storageKey)).toBe(0);
    expect(window.localStorage.getItem(storageKey)).toBeNull();
  });

  it('never resurrects a cleared key from a pending write', async () => {
    queryClient.setQueryData(['restaurants', 'r-1'], { name: 'A' });
    await vi.advanceTimersByTimeAsync(1000);
    expect(window.localStorage.getItem(storageKey)).not.toBeNull();

    queryClient.setQueryData(['restaurants', 'r-2'], { name: 'B' });
    clearPersistedQueryCache(storageKey);
    expect(window.localStorage.getItem(storageKey)).toBeNull();

    await vi.advanceTimersByTimeAsync(2000);
    window.dispatchEvent(new Event('pagehide'));
    expect(window.localStorage.getItem(storageKey)).toBeNull();
    expect(writesFor(storageKey)).toBe(1);

    // A genuinely new change after the clear is persisted again.
    queryClient.setQueryData(['restaurants', 'r-3'], { name: 'C' });
    await vi.advanceTimersByTimeAsync(1000);
    expect(window.localStorage.getItem(storageKey)).toContain('"r-3"');
  });
});

describe('persisted cache restore', () => {
  const storageKey = buildQueryStorageKey('user-restore');
  const hoursKey = queryKeys.opsRestaurants.hours('rest-1');
  const HOURS = { weekly: [{ dayOfWeek: 1, opensAt: '09:00' }] };

  beforeEach(() => {
    vi.useFakeTimers();
    window.localStorage.clear();
  });

  afterEach(() => {
    window.localStorage.clear();
    vi.useRealTimers();
  });

  /** Writes a cache with the current buster through the real persister. */
  async function persistHoursCache(): Promise<void> {
    const source = new QueryClient();
    const stop = configureQueryPersistence(source, { storageKey });
    await vi.advanceTimersByTimeAsync(0);
    source.setQueryData(hoursKey, HOURS);
    await vi.advanceTimersByTimeAsync(1000);
    stop();
    source.clear();
    expect(window.localStorage.getItem(storageKey)).toContain('"hours"');
  }

  async function restoreInto(queryClient: QueryClient): Promise<() => void> {
    const stop = configureQueryPersistence(queryClient, { storageKey });
    await vi.advanceTimersByTimeAsync(0);
    return stop;
  }

  it('restores a cache written with the current buster', async () => {
    await persistHoursCache();

    const target = new QueryClient();
    const stop = await restoreInto(target);

    expect(target.getQueryData(hoursKey)).toEqual(HOURS);
    stop();
    target.clear();
  });

  it('discards a cache persisted with buster v1, written before the PII deny-list existed', async () => {
    // A v1 cache as it could be written before the deny-list: unfiltered, including the
    // restaurant detail record with manager and contact phone numbers.
    const legacySource = new QueryClient();
    const detailKey = queryKeys.opsRestaurants.detail('rest-1');
    legacySource.setQueryData(hoursKey, HOURS);
    legacySource.setQueryData(detailKey, { managerNotificationPhone: '+44legacy-sentinel' });
    window.localStorage.setItem(
      storageKey,
      JSON.stringify({ buster: 'v1', timestamp: Date.now(), clientState: dehydrate(legacySource) }),
    );
    legacySource.clear();

    const target = new QueryClient();
    const stop = await restoreInto(target);

    expect(target.getQueryData(hoursKey)).toBeUndefined();
    expect(target.getQueryData(detailKey)).toBeUndefined();
    expect(window.localStorage.getItem(storageKey)).toBeNull();
    stop();
    target.clear();
  });
});
