import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  buildDefaultNotificationPort,
  combineNotificationPorts,
  createConsoleNotificationPort,
  createWebhookNotificationPort,
} from '@/server/dual-sync/notifications';

import type {
  DualSyncNotificationEvent,
  DualSyncNotificationPort,
} from '@/server/dual-sync/notifications';

function makeEvent(over: Partial<DualSyncNotificationEvent> = {}): DualSyncNotificationEvent {
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
  let logger: {
    info: ReturnType<typeof vi.fn>;
    warn: ReturnType<typeof vi.fn>;
    error: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    logger = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };
  });

  it('routes errors to logger.error and stamps occurredAt', async () => {
    const port = createConsoleNotificationPort({ logger });
    await expect(port.emit(makeEvent())).resolves.toEqual({ outcome: 'confirmed_success' });
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

  it('reports an ambiguous failure when the underlying logger explodes', async () => {
    logger.error = vi.fn(() => {
      throw new Error('logger broken');
    });
    const port = createConsoleNotificationPort({ logger });
    await expect(port.emit(makeEvent())).resolves.toEqual({
      outcome: 'ambiguous_failure',
      safeErrorCode: 'console_delivery_failed',
    });
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
    await expect(port.emit(makeEvent())).resolves.toEqual({ outcome: 'confirmed_success' });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const [url, init] = fetchImpl.mock.calls[0]!;
    expect(url).toBe('https://hook.example/dual-sync');
    expect((init as RequestInit).method).toBe('POST');
    const headers = (init as RequestInit).headers as Record<string, string>;
    expect(headers['content-type']).toBe('application/json');
    expect(headers['authorization']).toBe('Bearer xyz');
    expect(headers['idempotency-key']).toBeUndefined();
    const body = JSON.parse((init as RequestInit).body as string);
    expect(body.kind).toBe('tenant_run_failed');
    expect(typeof body.occurredAt).toBe('string');
  });

  it('returns a definitive rejection for an unambiguously rejected request', async () => {
    fetchImpl = vi.fn(async () => ({ ok: false, status: 400 }) as Response);
    const port = createWebhookNotificationPort({
      url: 'https://hook.example/dual-sync',
      fetchImpl,
      onError,
    });
    await expect(port.emit(makeEvent())).resolves.toEqual({
      outcome: 'definitive_rejection',
      retryable: false,
      safeErrorCode: 'webhook_rejected_400',
    });
    expect(onError).toHaveBeenCalledTimes(1);
    const err = onError.mock.calls[0]![0] as Error;
    expect(err).toBeInstanceOf(Error);
    expect(err.message).toContain('400');
  });

  it('returns an ambiguous failure for a server response', async () => {
    fetchImpl = vi.fn(async () => ({ ok: false, status: 503 }) as Response);
    const port = createWebhookNotificationPort({
      url: 'https://hook.example/dual-sync',
      fetchImpl,
      onError,
    });
    await expect(port.emit(makeEvent())).resolves.toEqual({
      outcome: 'ambiguous_failure',
      safeErrorCode: 'webhook_delivery_ambiguous',
    });
    expect(onError).toHaveBeenCalledTimes(1);
  });

  it('classifies a rate-limit rejection as definitively retryable', async () => {
    fetchImpl = vi.fn(async () => ({ ok: false, status: 429 }) as Response);
    const port = createWebhookNotificationPort({
      url: 'https://hook.example/dual-sync',
      fetchImpl,
      onError,
    });
    await expect(port.emit(makeEvent())).resolves.toEqual({
      outcome: 'definitive_rejection',
      retryable: true,
      safeErrorCode: 'webhook_retryable_429',
    });
  });

  it('returns an ambiguous failure for a thrown transport error', async () => {
    fetchImpl = vi.fn(async () => {
      throw new Error('network down');
    });
    const port = createWebhookNotificationPort({
      url: 'https://hook.example/dual-sync',
      fetchImpl,
      onError,
    });
    await expect(port.emit(makeEvent())).resolves.toEqual({
      outcome: 'ambiguous_failure',
      safeErrorCode: 'webhook_delivery_ambiguous',
    });
    expect(onError).toHaveBeenCalledTimes(1);
    expect((onError.mock.calls[0]![0] as Error).message).toContain('network down');
  });

  it('reports an unavailable transport instead of silently succeeding', async () => {
    const originalFetch = globalThis.fetch;
    try {
      // Simulate an environment where neither override nor global is a function.
      (globalThis as { fetch?: unknown }).fetch = undefined;
      const port = createWebhookNotificationPort({
        url: 'https://hook.example/dual-sync',
        fetchImpl: undefined as unknown as typeof fetch,
        onError,
      });
      await expect(port.emit(makeEvent())).resolves.toEqual({
        outcome: 'definitive_rejection',
        retryable: false,
        safeErrorCode: 'webhook_transport_unavailable',
      });
    } finally {
      (globalThis as { fetch?: unknown }).fetch = originalFetch;
    }
  });
});

describe('combineNotificationPorts', () => {
  it('fails definitively for an empty operational channel list', async () => {
    const port = combineNotificationPorts([]);
    await expect(port.emit(makeEvent())).resolves.toEqual({
      outcome: 'definitive_rejection',
      retryable: false,
      safeErrorCode: 'notification_transport_unavailable',
    });
  });

  it('returns the single port unchanged', async () => {
    const single: DualSyncNotificationPort = {
      emit: vi.fn(async () => ({ outcome: 'confirmed_success' as const })),
    };
    expect(combineNotificationPorts([single])).toBe(single);
  });

  it('fans out and preserves the most uncertain transport result', async () => {
    const ok: DualSyncNotificationPort = {
      emit: vi.fn(async () => ({ outcome: 'confirmed_success' as const })),
    };
    const broken: DualSyncNotificationPort = {
      emit: vi.fn(async () => {
        throw new Error('downstream uncertain');
      }),
    };
    const port = combineNotificationPorts([ok, broken]);
    await expect(port.emit(makeEvent())).resolves.toEqual({
      outcome: 'ambiguous_failure',
      safeErrorCode: 'notification_delivery_ambiguous',
    });
    expect(ok.emit).toHaveBeenCalledTimes(1);
    expect(broken.emit).toHaveBeenCalledTimes(1);
  });
});

describe('buildDefaultNotificationPort', () => {
  it('routes webhook transport failures through the console notification port without provider text', async () => {
    // Given
    const secret = 'Bearer provider-secret guest@example.com';
    const consolePort: DualSyncNotificationPort = {
      emit: vi.fn(async () => ({ outcome: 'confirmed_success' as const })),
    };
    const originalFetch = globalThis.fetch;
    const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    globalThis.fetch = vi.fn(async () => {
      throw new Error(secret);
    });

    try {
      const port = buildDefaultNotificationPort({
        webhookUrl: 'https://hook.example/dual-sync',
        consolePort,
      });

      // When
      await expect(port.emit(makeEvent())).resolves.toEqual({
        outcome: 'ambiguous_failure',
        safeErrorCode: 'webhook_delivery_ambiguous',
      });
      await Promise.resolve();

      // Then
      expect(consolePort.emit).toHaveBeenCalledWith({
        kind: 'cron_run_failed',
        severity: 'error',
        summary: 'Dual-sync webhook notification transport failed.',
        errorCode: 'webhook_transport_failed',
      });
      expect(JSON.stringify(consolePort.emit.mock.calls)).not.toContain(secret);
      expect(consoleWarnSpy).not.toHaveBeenCalled();
    } finally {
      globalThis.fetch = originalFetch;
      consoleWarnSpy.mockRestore();
    }
  });
});
