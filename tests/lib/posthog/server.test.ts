import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  captureRestaurantServerEvent,
  captureServerEvent,
  captureServerException,
  flushPosthogServerAfterResponse,
  getPosthogServerConfig,
  getPosthogServerClient,
  getPosthogServerReleaseMetadata,
  resetPosthogServerClientForTests,
  sanitizeExceptionForCapture,
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
    expect(captureException).toHaveBeenCalledTimes(1);
    const [capturedError, capturedDistinctId, capturedProps] = captureException.mock.calls[0]!;
    expect(capturedError).toBeInstanceOf(Error);
    expect((capturedError as Error).message).toBe('capacity failed');
    expect(capturedDistinctId).toBe('user-1');
    expect(capturedProps).toMatchObject({
      $groups: { restaurant: 'restaurant-1' },
      path: '/api/bookings',
      release: 'nabatable-web',
      deploySha: expect.any(String),
    });
    expect(JSON.stringify(capturedProps)).not.toContain('guest@example.com');
  });

  it('prefers immediate exception delivery when the client supports it', async () => {
    const capture = vi.fn();
    const captureException = vi.fn();
    const captureExceptionImmediate = vi.fn().mockResolvedValue(undefined);
    resetPosthogServerClientForTests({
      capture,
      captureException,
      captureExceptionImmediate,
      flush: vi.fn(),
      shutdown: vi.fn(),
    });

    expect(
      captureServerException(new Error('boom'), {
        correlationId: 'corr-1234567890',
        properties: { path: '/api/bookings', source: 'api' },
      }),
    ).toBe(true);

    expect(captureExceptionImmediate).toHaveBeenCalledTimes(1);
    expect(captureException).not.toHaveBeenCalled();
    const [, distinctId, props] = captureExceptionImmediate.mock.calls[0]!;
    expect(distinctId).toBe('server:test');
    expect(props).toMatchObject({
      path: '/api/bookings',
      source: 'api',
      correlationId: 'corr-1234567890',
      release: 'nabatable-web',
    });
  });

  it('swallows immediate delivery failures without unhandled rejections', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const captureExceptionImmediate = vi.fn().mockRejectedValue(new Error('network down'));
    resetPosthogServerClientForTests({
      capture: vi.fn(),
      captureException: vi.fn(),
      captureExceptionImmediate,
      flush: vi.fn(),
      shutdown: vi.fn(),
    });

    expect(captureServerException(new Error('boom'))).toBe(true);
    // Let the rejected delivery promise settle through the catch handler.
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(warnSpy).toHaveBeenCalledWith(
      '[posthog] server exception delivery failed',
      expect.objectContaining({ error: 'network down' }),
    );
    warnSpy.mockRestore();
  });

  it('sanitizes exception messages and stacks before capture', () => {
    const error = new Error(
      'insert failed for guest@example.com phone +44 7911 123456 token=abc123secret',
    );
    error.stack = [
      'Error: insert failed for guest@example.com',
      '    at createBooking (/var/task/server/bookings.js:10:5)',
      '    at /var/task/src/app/api/bookings/route.js?token=abc123secret:22:3',
    ].join('\n');

    const sanitized = sanitizeExceptionForCapture(error) as Error;
    expect(sanitized).toBeInstanceOf(Error);
    expect(sanitized.name).toBe('Error');
    expect(sanitized.message).not.toContain('guest@example.com');
    expect(sanitized.message).not.toContain('7911');
    expect(sanitized.message).not.toContain('abc123secret');
    expect(sanitized.stack).toContain('createBooking');
    expect(sanitized.stack).not.toContain('guest@example.com');
    expect(sanitized.stack).not.toContain('abc123secret');

    expect(sanitizeExceptionForCapture('contact guest@example.com')).not.toContain(
      'guest@example.com',
    );
    expect(sanitizeExceptionForCapture(42)).toBe(42);
  });

  it('exposes the release metadata used for source-map association', () => {
    expect(getPosthogServerReleaseMetadata()).toEqual({
      release: 'nabatable-web',
      deploySha: expect.any(String),
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

  it('attaches sanitized correlation ids to events', () => {
    const capture = vi.fn();
    resetPosthogServerClientForTests({
      capture,
      captureException: vi.fn(),
      flush: vi.fn(),
      shutdown: vi.fn(),
    });

    captureServerEvent(
      'booking_create_started',
      { restaurantId: 'restaurant-1', source: 'api' },
      { correlationId: 'trace<>-abcdef123456' },
    );
    expect(capture).toHaveBeenCalledWith(
      expect.objectContaining({
        properties: expect.objectContaining({ correlationId: 'trace-abcdef123456' }),
      }),
    );

    capture.mockClear();
    captureServerEvent(
      'booking_create_started',
      { restaurantId: 'restaurant-1' },
      { correlationId: 'x' },
    );
    const props = capture.mock.calls[0]![0].properties as Record<string, unknown>;
    expect('correlationId' in props).toBe(false);
  });

  it('is safe to schedule an after-response flush outside a request scope', () => {
    resetPosthogServerClientForTests({
      capture: vi.fn(),
      captureException: vi.fn(),
      flush: vi.fn(),
      shutdown: vi.fn(),
    });
    expect(() => flushPosthogServerAfterResponse()).not.toThrow();
  });
});
