import { beforeEach, describe, expect, it, vi } from 'vitest';

const { runMock, censusMock, enabledMock } = vi.hoisted(() => ({
  runMock: vi.fn(),
  censusMock: vi.fn(),
  enabledMock: vi.fn(),
}));
const loggerErrorMock = vi.hoisted(() => vi.fn());
const captureServerExceptionMock = vi.hoisted(() => vi.fn());

vi.mock('@/server/dual-sync/core-outbox/runtime', () => ({
  runDefaultCoreOutbox: runMock,
  censusDefaultCoreOutbox: censusMock,
}));
vi.mock('@/server/dual-sync/runtime-controls', () => ({
  isDualSyncAutoCandidatesEnabled: enabledMock,
}));
vi.mock('@/lib/logger', () => ({ logger: { error: loggerErrorMock } }));
vi.mock('@/lib/posthog/server', () => ({ captureServerException: captureServerExceptionMock }));
vi.mock('@/src/instrumentation', () => ({ flushPosthogLogsAfterResponse: vi.fn() }));
vi.mock('@/server/security/cron-auth', async () => {
  const { NextResponse } = await import('next/server');
  return {
    requireCronAuthAndRun: async (
      request: Request,
      jobName: string,
      work: (auth: { readonly jobName: string; readonly runId: string }) => Promise<Response>,
    ) => {
      if (request.headers.get('authorization') !== 'Bearer test-secret') {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
      return work({ jobName, runId: '00000000-0000-4000-8000-000000000099' });
    },
  };
});

import { GET } from '@/src/app/api/cron/dual-sync/core-outbox/route';

describe('core outbox cron route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.CRON_SECRET = 'test-secret';
    enabledMock.mockReturnValue(true);
    runMock.mockResolvedValue({ claimed: 1, completed: 1, retried: 0, deadLettered: 0 });
    censusMock.mockResolvedValue({ pending: 3, claimed: 1, retryable: 1, deadLetter: 0 });
    loggerErrorMock.mockReset();
    captureServerExceptionMock.mockReset();
  });

  it('requires cron auth and returns no-store', async () => {
    // Given
    const request = new Request('http://localhost/api/cron/dual-sync/core-outbox');

    // When
    const response = await GET(request);

    // Then
    expect(response.status).toBe(401);
    expect(response.headers.get('cache-control')).toContain('no-store');
    expect(runMock).not.toHaveBeenCalled();
  });

  it('performs a read-only census for dry-run', async () => {
    // Given
    const request = new Request(
      'http://localhost/api/cron/dual-sync/core-outbox?dryRun=1&maxJobs=999',
      { headers: { authorization: 'Bearer test-secret' } },
    );

    // When
    const response = await GET(request);

    // Then
    expect(response.status).toBe(200);
    expect(censusMock).toHaveBeenCalledWith({ limit: 100 });
    expect(runMock).not.toHaveBeenCalled();
    expect(await response.json()).toEqual(
      expect.objectContaining({ dryRun: true, maxJobs: 100, census: expect.any(Object) }),
    );
  });

  it('does not claim when candidate discovery is disabled', async () => {
    // Given
    enabledMock.mockReturnValue(false);
    const request = new Request('http://localhost/api/cron/dual-sync/core-outbox', {
      headers: { authorization: 'Bearer test-secret' },
    });

    // When
    const response = await GET(request);

    // Then
    expect(response.status).toBe(409);
    expect(runMock).not.toHaveBeenCalled();
  });

  it('records a safe structured failure while preserving the terminal response', async () => {
    // Given
    const secret = 'Bearer provider-secret guest@example.com';
    runMock.mockRejectedValue(new Error(secret));
    const request = new Request('http://localhost/api/cron/dual-sync/core-outbox', {
      headers: { authorization: 'Bearer test-secret' },
    });

    // When
    const response = await GET(request);

    // Then
    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({
      error: 'Core-change outbox processing failed.',
      code: 'core_outbox_processing_failed',
    });
    expect(loggerErrorMock).toHaveBeenCalledWith('Dual-sync core outbox cron failed.', {
      source: 'cron.dual-sync.core-outbox',
      runId: '00000000-0000-4000-8000-000000000099',
      errorKind: 'error',
    });
    expect(JSON.stringify(loggerErrorMock.mock.calls)).not.toContain(secret);
    expect(captureServerExceptionMock).toHaveBeenCalledTimes(1);
  });
});
