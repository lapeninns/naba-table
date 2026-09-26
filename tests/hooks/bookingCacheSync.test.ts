import { createTestQueryClient } from '@tests/utils/reactQuery';
import { describe, expect, it } from 'vitest';

import { queryKeys } from '@/lib/query/keys';
import {
  buildTableAssignments,
  listAcceptsStatus,
  patchBookingCaches,
  restoreBookingCaches,
  snapshotBookingCaches,
} from '@src/hooks/ops/bookingCacheSync';

import {
  RESTAURANT_ID,
  makeBundle,
  makeInfiniteList,
  makeListItem,
  makeRow,
  makeSummary,
  summaryKey,
} from './__helpers__/opsBookingFixtures';

import type { OpsBookingDialogBundle } from '@/services/ops/bookings';
import type { OpsBookingsPage, OpsTodayBookingsSummary } from '@/types/ops';
import type { InfiniteData } from '@tanstack/react-query';

describe('listAcceptsStatus', () => {
  it('@contract follows the list endpoint status filters', () => {
    const key = (params: Record<string, unknown>) => queryKeys.opsBookings.list(params);
    expect(listAcceptsStatus(key({}), 'cancelled')).toBe(true);
    expect(listAcceptsStatus(key({ status: 'all' }), 'cancelled')).toBe(true);
    expect(listAcceptsStatus(key({ status: 'confirmed' }), 'checked_in')).toBe(false);
    expect(listAcceptsStatus(key({ statuses: 'pending,confirmed,checked_in' }), 'checked_in')).toBe(
      true,
    );
    expect(listAcceptsStatus(key({ statuses: 'cancelled' }), 'confirmed')).toBe(false);
  });
});

describe('patchBookingCaches / restoreBookingCaches', () => {
  function seed() {
    const queryClient = createTestQueryClient();
    queryClient.setQueryData(
      summaryKey(),
      makeSummary([makeRow({ id: 'b1' }), makeRow({ id: 'b2' })]),
    );
    queryClient.setQueryData(
      queryKeys.opsDashboard.summary('rest-2', null),
      makeSummary([makeRow({ id: 'b1' })]),
    );
    const listKey = queryKeys.opsBookings.list({
      restaurantId: RESTAURANT_ID,
      status: 'confirmed',
    });
    queryClient.setQueryData(
      listKey,
      makeInfiniteList([makeListItem({ id: 'b1' }), makeListItem({ id: 'b2' })]),
    );
    queryClient.setQueryData(
      queryKeys.opsBookings.dialog('b1'),
      makeBundle(makeListItem({ id: 'b1' })),
    );
    return { queryClient, listKey };
  }

  it('@contract patches one booking everywhere, scoped to the restaurant, and prunes filtered lists', () => {
    const { queryClient, listKey } = seed();

    patchBookingCaches(
      queryClient,
      'b1',
      { status: 'cancelled' },
      { restaurantId: RESTAURANT_ID, pruneLists: true },
    );

    const own = queryClient.getQueryData<OpsTodayBookingsSummary>(summaryKey());
    expect(own?.bookings.map((b) => b.status)).toEqual(['cancelled', 'confirmed']);
    expect(own?.totals.cancelled).toBe(1);
    const other = queryClient.getQueryData<OpsTodayBookingsSummary>(
      queryKeys.opsDashboard.summary('rest-2', null),
    );
    expect(other?.bookings[0].status).toBe('confirmed');
    const list = queryClient.getQueryData<InfiniteData<OpsBookingsPage>>(listKey);
    expect(list?.pages[0].items.map((i) => i.id)).toEqual(['b2']);
    expect(
      queryClient.getQueryData<OpsBookingDialogBundle>(queryKeys.opsBookings.dialog('b1'))?.booking
        .status,
    ).toBe('cancelled');
  });

  it('@contract restores only the snapshotted booking', () => {
    const { queryClient, listKey } = seed();
    const snapshot = snapshotBookingCaches(queryClient, 'b1');

    patchBookingCaches(queryClient, 'b1', { status: 'checked_in', checkedInAt: 'x' });
    patchBookingCaches(queryClient, 'b2', { status: 'no_show' });
    restoreBookingCaches(queryClient, snapshot);

    const rows = queryClient.getQueryData<OpsTodayBookingsSummary>(summaryKey())?.bookings;
    expect(rows?.find((b) => b.id === 'b1')).toMatchObject({
      status: 'confirmed',
      checkedInAt: null,
    });
    expect(rows?.find((b) => b.id === 'b2')?.status).toBe('no_show');
    const list = queryClient.getQueryData<InfiniteData<OpsBookingsPage>>(listKey);
    expect(list?.pages[0].items.find((i) => i.id === 'b1')?.status).toBe('confirmed');
  });

  it('@contract table assignments update the dialog assignment context', () => {
    const { queryClient } = seed();
    const { groups, complete } = buildTableAssignments(queryClient, RESTAURANT_ID, 'b1', ['t1']);
    expect(complete).toBe(true);
    expect(groups[0].members[0]).toMatchObject({ tableId: 't1', tableNumber: 'T1', capacity: 4 });

    patchBookingCaches(queryClient, 'b1', { tableAssignments: groups });

    const bundle = queryClient.getQueryData<OpsBookingDialogBundle>(
      queryKeys.opsBookings.dialog('b1'),
    );
    expect(bundle?.assignmentContext.bookingAssignments).toEqual(['t1']);
    expect(
      queryClient.getQueryData<OpsTodayBookingsSummary>(summaryKey())?.bookings[0]
        .requiresTableAssignment,
    ).toBe(false);
    expect(buildTableAssignments(queryClient, RESTAURANT_ID, 'b1', ['unknown']).complete).toBe(
      false,
    );
  });
});
