import { beforeEach, describe, expect, it, vi } from 'vitest';

const processNextDualSyncJobMock = vi.hoisted(() => vi.fn());
const recordObservabilityEventMock = vi.hoisted(() => vi.fn());
const getServiceSupabaseClientMock = vi.hoisted(() => vi.fn());
const loggerErrorMock = vi.hoisted(() => vi.fn());
const captureServerExceptionMock = vi.hoisted(() => vi.fn());

vi.mock('@/server/dual-sync/queue', () => ({ processNextDualSyncJob: processNextDualSyncJobMock }));
vi.mock('@/server/observability', () => ({
  recordObservabilityEvent: recordObservabilityEventMock,
}));
vi.mock('@/server/supabase', () => ({ getServiceSupabaseClient: getServiceSupabaseClientMock }));
vi.mock('@/lib/logger', () => ({ logger: { error: loggerErrorMock } }));
vi.mock('@/lib/posthog/server', () => ({ captureServerException: captureServerExceptionMock }));
vi.mock('@/src/instrumentation', () => ({ flushPosthogLogsAfterResponse: vi.fn() }));
vi.mock('@/server/security/cron-auth', async () => {
  return {
    requireCronAuthAndRun: async (
      _request: Request,
      jobName: string,
      work: (auth: { readonly jobName: string; readonly runId: string }) => Promise<Response>,
    ) => work({ jobName, runId: 'run-queue-1' }),
  };
});

import { GET } from '@/src/app/api/cron/dual-sync/queue/route';

describe('dual-sync queue cron route logging', () => {
  beforeEach(() => {
    processNextDualSyncJobMock.mockReset();
    recordObservabilityEventMock.mockReset();
    getServiceSupabaseClientMock.mockReset();
    loggerErrorMock.mockReset();
    captureServerExceptionMock.mockReset();
    recordObservabilityEventMock.mockResolvedValue(undefined);
    getServiceSupabaseClientMock.mockReturnValue({ client: 'service' });
  });

  it('records safe telemetry without changing the terminal queue response', async () => {
    // Given
    const secret = 'Bearer provider-secret guest@example.com';
    processNextDualSyncJobMock.mockRejectedValue(new Error(secret));

    // When
    const response = await GET(new Request('https://example.com/api/cron/dual-sync/queue'));

    // Then
    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: 'Dual-sync queue cron failed.' });
    expect(loggerErrorMock).toHaveBeenCalledWith('Dual-sync queue cron failed.', {
      source: 'cron.dual-sync.queue',
      runId: 'run-queue-1',
      errorKind: 'error',
    });
    expect(recordObservabilityEventMock).toHaveBeenLastCalledWith(
      expect.objectContaining({
        eventType: 'drain.failed',
        context: expect.objectContaining({ errorKind: 'error' }),
      }),
    );
    expect(JSON.stringify(recordObservabilityEventMock.mock.calls)).not.toContain(secret);
    expect(captureServerExceptionMock).toHaveBeenCalledTimes(1);
  });
});
