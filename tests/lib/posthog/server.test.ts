import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  captureRestaurantServerEvent,
  captureServerEvent,
  captureServerException,
  getPosthogServerConfig,
  getPosthogServerClient,
  resetPosthogServerClientForTests,
} from '@/lib/posthog/server';

describe('server PostHog helpers', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    resetPosthogServerClientForTests();
  });

  it('stays disabled without PostHog env vars', async () => {
    vi.stubEnv('NEXT_PUBLIC_POSTHOG_KEY', '');
    vi.stubEnv('NEXT_PUBLIC_POSTHOG_HOST', '');

    expect(getPosthogServerConfig()).toMatchObject({ enabled: false });
    expect(getPosthogServerClient()).toBeNull();
    expect(captureServerEvent('booking_created', { bookingId: 'booking-1' })).toBe(false);
    expect(captureServerException(new Error('boom'))).toBe(false);
  });

  it('captures sanitized server events and exceptions when a client is available', () => {
    const capture = vi.fn();
    const captureException = vi.fn();
    resetPosthogServerClientForTests({
      capture,
      captureException,
      flush: vi.fn(),
      shutdown: vi.fn(),
    });

    expect(
      captureServerEvent('booking_created', {
        bookingId: 'booking-1',
        email: 'guest@example.com',
        path: '/reserve?token=secret',
      }),
    ).toBe(true);
    expect(capture).toHaveBeenCalledWith({
      distinctId: 'server:test',
      event: 'booking_created',
      groups: undefined,
      properties: {
        bookingId: 'booking-1',
        path: '/reserve',
      },
    });

    const error = new Error('capacity failed');
    expect(
      captureServerException(error, {
        distinctId: 'user-1',
        groups: { restaurant: 'restaurant-1' },
        properties: { path: '/api/bookings?code=secret', email: 'guest@example.com' },
      }),
    ).toBe(true);
    expect(captureException).toHaveBeenCalledWith(error, 'user-1', {
      $groups: { restaurant: 'restaurant-1' },
      path: '/api/bookings',
    });
  });

  it('sanitizes new events and forwards the restaurant group', () => {
    const capture = vi.fn();
    resetPosthogServerClientForTests({
      capture,
      captureException: vi.fn(),
      flush: vi.fn(),
      shutdown: vi.fn(),
    });

    expect(
      captureServerEvent('booking_create_failed', {
        restaurantId: 'restaurant-1',
        code: 'CAPACITY_EXCEEDED',
        email: 'guest@example.com',
        path: '/api/bookings?token=secret',
      }),
    ).toBe(true);
    expect(capture).toHaveBeenCalledWith({
      distinctId: 'server:test',
      event: 'booking_create_failed',
      groups: undefined,
      properties: {
        restaurantId: 'restaurant-1',
        code: 'CAPACITY_EXCEEDED',
        path: '/api/bookings',
      },
    });

    capture.mockClear();
    expect(
      captureRestaurantServerEvent('table_assignment_completed', {
        restaurantId: 'restaurant-2',
        distinctId: 'user-9',
        props: { bookingId: 'booking-2', assignedCount: 2, email: 'drop@example.com' },
      }),
    ).toBe(true);
    expect(capture).toHaveBeenCalledWith({
      distinctId: 'user-9',
      event: 'table_assignment_completed',
      groups: { restaurant: 'restaurant-2' },
      properties: {
        restaurantId: 'restaurant-2',
        bookingId: 'booking-2',
        assignedCount: 2,
      },
    });
  });
});
