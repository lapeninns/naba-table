import { beforeEach, describe, expect, it, vi } from 'vitest';

const runAutoExportForAllTenantsMock = vi.hoisted(() => vi.fn());
const isDualSyncAutoCandidatesEnabledMock = vi.hoisted(() => vi.fn());
const getServiceSupabaseClientMock = vi.hoisted(() => vi.fn());
const loggerErrorMock = vi.hoisted(() => vi.fn());
const captureServerExceptionMock = vi.hoisted(() => vi.fn());

vi.mock('@/server/dual-sync/scheduling/auto-export', () => ({
  runAutoExportForAllTenants: runAutoExportForAllTenantsMock,
}));
vi.mock('@/server/dual-sync/runtime-controls', () => ({
  isDualSyncAutoCandidatesEnabled: isDualSyncAutoCandidatesEnabledMock,
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
    ) => work({ jobName, runId: 'run-auto-export-1' }),
  };
});

import { GET } from '@/src/app/api/cron/dual-sync/auto-export/route';

describe('dual-sync auto-export cron route logging', () => {
  beforeEach(() => {
    runAutoExportForAllTenantsMock.mockReset();
    isDualSyncAutoCandidatesEnabledMock.mockReset();
    getServiceSupabaseClientMock.mockReset();
    loggerErrorMock.mockReset();
    captureServerExceptionMock.mockReset();
    isDualSyncAutoCandidatesEnabledMock.mockReturnValue(true);
    getServiceSupabaseClientMock.mockReturnValue({ client: 'service' });
  });

  it('records a safe structured failure while preserving the terminal response', async () => {
    // Given
    const secret = 'Bearer provider-secret guest@example.com';
    runAutoExportForAllTenantsMock.mockRejectedValue(new Error(secret));

    // When
    const response = await GET(new Request('https://example.com/api/cron/dual-sync/auto-export'));

    // Then
    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: 'Dual-sync auto-export cron failed.' });
    expect(loggerErrorMock).toHaveBeenCalledWith('Dual-sync auto-export cron failed.', {
      source: 'cron.dual-sync.auto-export',
      runId: 'run-auto-export-1',
      errorKind: 'error',
    });
    expect(JSON.stringify(loggerErrorMock.mock.calls)).not.toContain(secret);
    expect(captureServerExceptionMock).toHaveBeenCalledTimes(1);
  });
});
