import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const FLUSH_INTERVAL = 5_000;

const beaconResult: { sent: boolean; blob?: Blob } = { sent: false };

const originalFetch = global.fetch;
const originalSendBeacon = window.navigator.sendBeacon;
const originalCrypto = global.crypto;

function createSupabaseMock(email: string | null) {
  return {
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: email ? { email } : null } }),
    },
  };
}

describe('analytics emitter', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.useFakeTimers();
    beaconResult.sent = false;
    beaconResult.blob = undefined;
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  async function setup({ email = 'User@Example.com', sendBeacon = false } = {}) {
    const supabaseMock = createSupabaseMock(email);

    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    // @ts-expect-error - jsdom global override for test
    global.fetch = fetchMock;

    const sendBeaconMock = sendBeacon
      ? vi.fn().mockImplementation((_url: string, blob: Blob) => {
          beaconResult.sent = true;
          beaconResult.blob = blob;
          return true;
        })
      : undefined;

    const cryptoMock = {
      randomUUID: vi.fn().mockReturnValue('anon-123'),
      subtle: {
        digest: vi.fn().mockResolvedValue(new Uint8Array([0xde, 0xad, 0xbe, 0xef]).buffer),
      },
    } satisfies Partial<Crypto>;

    Object.defineProperty(global, 'crypto', {
      value: cryptoMock,
      writable: true,
    });

    Object.defineProperty(window, 'crypto', {
      value: cryptoMock,
      writable: true,
    });

    Object.defineProperty(window.navigator, 'sendBeacon', {
      value: sendBeaconMock,
      configurable: true,
      writable: true,
    });

    window.localStorage.clear();
    window.history.pushState(null, '', '/dashboard');

    await vi.doMock('@/lib/supabase/browser', () => ({
      getSupabaseBrowserClient: vi.fn(() => supabaseMock),
    }));

    const mod = await import('@/lib/analytics/emit');

    // Allow pending microtasks (identity warm-up) to resolve before assertions.
    await Promise.resolve();

    return {
      emit: mod.emit,
      flushPendingEvents: mod.flushPendingEvents,
      fetchMock,
      sendBeaconMock,
      supabaseMock,
    };
  }

  it('queues events and flushes via fetch on timer', async () => {
    const { emit, flushPendingEvents, fetchMock } = await setup();

    await emit('booking_edit_submitted', { bookingId: 'booking-42', ignored: undefined });

    expect(fetchMock).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(FLUSH_INTERVAL);
    await Promise.resolve();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('/api/events');
    expect(init?.keepalive).toBe(true);
    expect(init?.method).toBe('POST');

    const body = JSON.parse(String(init?.body));
    expect(Array.isArray(body.events)).toBe(true);
    expect(body.events).toHaveLength(1);
    const event = body.events[0];
    expect(event).toMatchObject({
      name: 'booking_edit_submitted',
      user: { anonId: 'anon-123' },
      context: { route: '/dashboard' },
      props: { bookingId: 'booking-42' },
    });
    expect(event.user.emailHash).toBe('deadbeef');

    await flushPendingEvents();
  });

  it('prefers sendBeacon when available', async () => {
    const { emit, flushPendingEvents, fetchMock, sendBeaconMock } = await setup({
      sendBeacon: true,
    });

    await emit('booking_cancelled', { bookingId: 'booking-99' });

    await flushPendingEvents();
    await Promise.resolve();

    expect(sendBeaconMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(beaconResult.sent).toBe(true);
    expect(beaconResult.blob).toBeInstanceOf(Blob);
  });

  it('reuses resolved identity across emits', async () => {
    const { emit, supabaseMock, flushPendingEvents } = await setup();

    await emit('booking_cancelled', { bookingId: 'booking-123' });
    await emit('filter_changed');

    expect(supabaseMock.auth.getUser).toHaveBeenCalledTimes(1);

    await flushPendingEvents();
  });
});

afterEach(() => {
  global.fetch = originalFetch;
  Object.defineProperty(window.navigator, 'sendBeacon', {
    value: originalSendBeacon,
    configurable: true,
    writable: true,
  });
  Object.defineProperty(window, 'crypto', {
    value: originalCrypto,
    configurable: true,
    writable: true,
  });
  Object.defineProperty(global, 'crypto', {
    value: originalCrypto,
    configurable: true,
    writable: true,
  });
});
