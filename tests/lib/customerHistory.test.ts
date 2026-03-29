import { describe, expect, it, vi } from 'vitest';

import {
  buildCustomerHistoryRecords,
  filterCustomerHistoryRecords,
  isCustomerHistoryBookingStatus,
  sortCustomerHistoryRecords,
  summarizeCustomerHistoryRecords,
  type CustomerBookingRecord,
  type CustomerHistoryRecord,
  type CustomerIdentityRecord,
} from '@/lib/ops/customer-history';

function makeCustomer(overrides: Partial<CustomerIdentityRecord> = {}): CustomerIdentityRecord {
  return {
    id: 'cust-1',
    restaurantId: 'rest-1',
    name: 'Alex Guest',
    email: 'alex@example.com',
    phone: '+447700900123',
    marketingOptIn: true,
    createdAt: '2026-01-01T10:00:00Z',
    updatedAt: '2026-03-01T10:00:00Z',
    ...overrides,
  };
}

function makeBooking(overrides: Partial<CustomerBookingRecord> = {}): CustomerBookingRecord {
  return {
    id: 'booking-1',
    customerId: 'cust-1',
    restaurantId: 'rest-1',
    status: 'completed',
    partySize: 2,
    createdAt: '2026-03-01T10:00:00Z',
    startAt: '2026-03-10T19:00:00Z',
    ...overrides,
  };
}

describe('customer-history helpers', () => {
  it('derives guest history from bookings and ignores future or cancelled bookings for last visit', () => {
    const records = buildCustomerHistoryRecords(
      [makeCustomer()],
      [
        makeBooking({
          id: 'booking-past',
          status: 'completed',
          partySize: 2,
          startAt: '2026-03-10T19:00:00Z',
        }),
        makeBooking({
          id: 'booking-cancelled',
          status: 'cancelled',
          partySize: 4,
          startAt: '2026-03-20T19:00:00Z',
        }),
        makeBooking({
          id: 'booking-future',
          status: 'confirmed',
          partySize: 6,
          startAt: '2026-04-05T19:00:00Z',
        }),
        makeBooking({
          id: 'booking-waitlist',
          status: 'PRIORITY_WAITLIST',
          partySize: 8,
          startAt: '2026-03-15T19:00:00Z',
        }),
      ],
      new Date('2026-03-29T12:00:00Z'),
    );

    expect(records).toHaveLength(1);
    expect(records[0]).toMatchObject({
      totalBookings: 3,
      totalCovers: 12,
      totalCancellations: 1,
      firstBookingAt: '2026-03-10T19:00:00.000Z',
      lastVisitAt: '2026-03-10T19:00:00.000Z',
    });
  });

  it('marks guests with only cancelled bookings as never visited', () => {
    const [record] = buildCustomerHistoryRecords(
      [makeCustomer({ id: 'cust-2', name: 'Never Arrived' })],
      [
        makeBooking({
          id: 'booking-cancelled',
          customerId: 'cust-2',
          status: 'cancelled',
          partySize: 2,
          startAt: '2026-03-08T19:00:00Z',
        }),
      ],
      new Date('2026-03-29T12:00:00Z'),
    );

    expect(record.totalBookings).toBe(1);
    expect(record.totalCancellations).toBe(1);
    expect(record.lastVisitAt).toBeNull();
  });

  it('filters by last visit windows and minimum bookings', () => {
    const records: CustomerHistoryRecord[] = [
      {
        ...makeCustomer({ id: 'cust-1', name: 'Recent Guest' }),
        firstBookingAt: '2026-03-01T19:00:00.000Z',
        lastVisitAt: '2026-03-20T19:00:00.000Z',
        totalBookings: 4,
        totalCovers: 8,
        totalCancellations: 0,
      },
      {
        ...makeCustomer({ id: 'cust-2', name: 'Old Guest' }),
        firstBookingAt: '2025-10-01T19:00:00.000Z',
        lastVisitAt: '2025-10-20T19:00:00.000Z',
        totalBookings: 6,
        totalCovers: 12,
        totalCancellations: 1,
      },
      {
        ...makeCustomer({ id: 'cust-3', name: 'Never Guest' }),
        firstBookingAt: null,
        lastVisitAt: null,
        totalBookings: 0,
        totalCovers: 0,
        totalCancellations: 0,
      },
    ];

    const now = new Date('2026-03-29T12:00:00Z');

    expect(
      filterCustomerHistoryRecords(records, { lastVisit: '30d', minBookings: 3 }, now).map(
        (record) => record.id,
      ),
    ).toEqual(['cust-1']);

    expect(
      filterCustomerHistoryRecords(records, { lastVisit: 'never', minBookings: 0 }, now).map(
        (record) => record.id,
      ),
    ).toEqual(['cust-3']);
  });

  it('sorts bookings and last-visit views with null visits last', () => {
    const records: CustomerHistoryRecord[] = [
      {
        ...makeCustomer({ id: 'cust-a', name: 'Alpha' }),
        firstBookingAt: '2026-01-01T19:00:00.000Z',
        lastVisitAt: null,
        totalBookings: 1,
        totalCovers: 2,
        totalCancellations: 0,
      },
      {
        ...makeCustomer({ id: 'cust-b', name: 'Bravo' }),
        firstBookingAt: '2026-01-01T19:00:00.000Z',
        lastVisitAt: '2026-03-28T19:00:00.000Z',
        totalBookings: 7,
        totalCovers: 14,
        totalCancellations: 1,
      },
      {
        ...makeCustomer({ id: 'cust-c', name: 'Charlie' }),
        firstBookingAt: '2026-01-01T19:00:00.000Z',
        lastVisitAt: '2026-03-10T19:00:00.000Z',
        totalBookings: 3,
        totalCovers: 6,
        totalCancellations: 0,
      },
    ];

    expect(sortCustomerHistoryRecords(records, 'bookings', 'desc').map((record) => record.id)).toEqual([
      'cust-b',
      'cust-c',
      'cust-a',
    ]);

    expect(sortCustomerHistoryRecords(records, 'last_visit', 'desc').map((record) => record.id)).toEqual([
      'cust-b',
      'cust-c',
      'cust-a',
    ]);
  });

  it('summarizes VIP, returning, marketing, and never-visited segments', () => {
    const summary = summarizeCustomerHistoryRecords([
      {
        ...makeCustomer({ id: 'cust-1', marketingOptIn: true }),
        firstBookingAt: '2026-01-01T19:00:00.000Z',
        lastVisitAt: '2026-03-20T19:00:00.000Z',
        totalBookings: 6,
        totalCovers: 12,
        totalCancellations: 0,
      },
      {
        ...makeCustomer({ id: 'cust-2', marketingOptIn: false }),
        firstBookingAt: '2026-01-01T19:00:00.000Z',
        lastVisitAt: '2026-03-15T19:00:00.000Z',
        totalBookings: 2,
        totalCovers: 4,
        totalCancellations: 1,
      },
      {
        ...makeCustomer({ id: 'cust-3', marketingOptIn: false }),
        firstBookingAt: null,
        lastVisitAt: null,
        totalBookings: 0,
        totalCovers: 0,
        totalCancellations: 0,
      },
    ]);

    expect(summary).toEqual({
      total: 3,
      optedIn: 1,
      optedOut: 2,
      returning: 2,
      vip: 1,
      neverVisited: 1,
    });
  });

  it('uses booking createdAt when startAt is missing', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-29T12:00:00Z'));

    const [record] = buildCustomerHistoryRecords(
      [makeCustomer()],
      [
        makeBooking({
          id: 'booking-created-only',
          createdAt: '2026-03-18T10:00:00Z',
          startAt: null,
        }),
      ],
      new Date(),
    );

    expect(record.firstBookingAt).toBe('2026-03-18T10:00:00.000Z');
    expect(record.lastVisitAt).toBe('2026-03-18T10:00:00.000Z');

    vi.useRealTimers();
  });

  it('accepts only supported booking history statuses', () => {
    expect(isCustomerHistoryBookingStatus('completed')).toBe(true);
    expect(isCustomerHistoryBookingStatus('cancelled')).toBe(true);
    expect(isCustomerHistoryBookingStatus('archived')).toBe(false);
  });
});
