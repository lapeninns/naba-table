import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  combineNotificationPorts,
  createConsoleNotificationPort,
  createWebhookNotificationPort,
} from '@/server/dual-sync/notifications';

import type {
  DualSyncNotificationEvent,
  DualSyncNotificationPort,
} from '@/server/dual-sync/notifications';

function makeEvent(
  over: Partial<DualSyncNotificationEvent> = {},
): DualSyncNotificationEvent {
  return {
    kind: 'tenant_run_failed',
    severity: 'error',
    summary: 'Auto-export run failed.',
    restaurantId: 'rest-1',
    errorMessage: 'boom',
    ...over,
  };
}

describe('createConsoleNotificationPort', () => {
  let logger: { info: ReturnType<typeof vi.fn>; warn: ReturnType<typeof vi.fn>; error: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    logger = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };
  });

  it('routes errors to logger.error and stamps occurredAt', async () => {
    const port = createConsoleNotificationPort({ logger });
    await port.emit(makeEvent());
    expect(logger.error).toHaveBeenCalledTimes(1);
    const [prefix, payload] = logger.error.mock.calls[0]!;
    expect(prefix).toBe('[dual-sync:tenant_run_failed]');
    expect(payload).toMatchObject({
      kind: 'tenant_run_failed',
      severity: 'error',
      restaurantId: 'rest-1',
    });
    expect(typeof (payload as { occurredAt: string }).occurredAt).toBe('string');
  });

  it('routes warnings to logger.warn', async () => {
    const port = createConsoleNotificationPort({ logger });
    await port.emit(makeEvent({ kind: 'tenant_run_partial', severity: 'warning' }));
    expect(logger.warn).toHaveBeenCalledTimes(1);
    expect(logger.error).not.toHaveBeenCalled();
  });

  it('never throws when the underlying logger explodes', async () => {
    logger.error = vi.fn(() => {
      throw new Error('logger broken');
    });
    const port = createConsoleNotificationPort({ logger });
    await expect(port.emit(makeEvent())).resolves.toBeUndefined();
  });
});

describe('createWebhookNotificationPort', () => {
  let fetchImpl: ReturnType<typeof vi.fn>;
  let onError: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchImpl = vi.fn(async () => ({ ok: true, status: 200 }) as Response);
    onError = vi.fn();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('POSTs the event JSON to the configured URL', async () => {
    const port = createWebhookNotificationPort({
      url: 'https://hook.example/dual-sync',
      fetchImpl,
      onError,
      headers: { authorization: 'Bearer xyz' },
    });
    await port.emit(makeEvent());
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const [url, init] = fetchImpl.mock.calls[0]!;
    expect(url).toBe('https://hook.example/dual-sync');
    expect((init as RequestInit).method).toBe('POST');
    const headers = (init as RequestInit).headers as Record<string, string>;
    expect(headers['content-type']).toBe('application/json');
    expect(headers['authorization']).toBe('Bearer xyz');
    const body = JSON.parse((init as RequestInit).body as string);
    expect(body.kind).toBe('tenant_run_failed');
    expect(typeof body.occurredAt).toBe('string');
  });

  it('reports non-2xx responses via onError but does not throw', async () => {
    fetchImpl = vi.fn(async () => ({ ok: false, status: 500 }) as Response);
    const port = createWebhookNotificationPort({
      url: 'https://hook.example/dual-sync',
      fetchImpl,
      onError,
    });
    await expect(port.emit(makeEvent())).resolves.toBeUndefined();
    expect(onError).toHaveBeenCalledTimes(1);
    const err = onError.mock.calls[0]![0] as Error;
    expect(err).toBeInstanceOf(Error);
    expect(err.message).toContain('500');
  });

  it('reports thrown transport errors via onError', async () => {
    fetchImpl = vi.fn(async () => {
      throw new Error('network down');
    });
    const port = createWebhookNotificationPort({
      url: 'https://hook.example/dual-sync',
      fetchImpl,
      onError,
    });
    await expect(port.emit(makeEvent())).resolves.toBeUndefined();
    expect(onError).toHaveBeenCalledTimes(1);
    expect((onError.mock.calls[0]![0] as Error).message).toContain('network down');
  });

  it('no-ops when fetchImpl is unavailable', async () => {
    const originalFetch = globalThis.fetch;
    try {
      // Simulate an environment where neither override nor global is a function.
      (globalThis as { fetch?: unknown }).fetch = undefined;
      const port = createWebhookNotificationPort({
        url: 'https://hook.example/dual-sync',
        fetchImpl: undefined as unknown as typeof fetch,
        onError,
      });
      await expect(port.emit(makeEvent())).resolves.toBeUndefined();
      expect(onError).not.toHaveBeenCalled();
    } finally {
      (globalThis as { fetch?: unknown }).fetch = originalFetch;
    }
  });
});

describe('combineNotificationPorts', () => {
  it('returns a no-op port for an empty list', async () => {
    const port = combineNotificationPorts([]);
    await expect(port.emit(makeEvent())).resolves.toBeUndefined();
  });

  it('returns the single port unchanged', async () => {
    const single: DualSyncNotificationPort = { emit: vi.fn(async () => {}) };
    expect(combineNotificationPorts([single])).toBe(single);
  });

  it('fans out to every port even if one rejects', async () => {
    const ok: DualSyncNotificationPort = { emit: vi.fn(async () => {}) };
    const broken: DualSyncNotificationPort = {
      emit: vi.fn(async () => {
        throw new Error('downstream rejected');
      }),
    };
    const port = combineNotificationPorts([ok, broken]);
    await expect(port.emit(makeEvent())).resolves.toBeUndefined();
    expect(ok.emit).toHaveBeenCalledTimes(1);
    expect(broken.emit).toHaveBeenCalledTimes(1);
  });
});
