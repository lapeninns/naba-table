import { beforeEach, describe, expect, it, vi } from 'vitest';

const runOutboxWorkerMock = vi.hoisted(() => vi.fn());
const loggerErrorMock = vi.hoisted(() => vi.fn());
const loggerWarnMock = vi.hoisted(() => vi.fn());
const captureServerExceptionMock = vi.hoisted(() => vi.fn());

vi.mock('@/server/jobs/outbox-worker', () => ({ runOutboxWorker: runOutboxWorkerMock }));
vi.mock('@/lib/logger', () => ({ logger: { error: loggerErrorMock, warn: loggerWarnMock } }));
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
      return work({ jobName, runId: '00000000-0000-4000-8000-000000000042' });
    },
  };
});

import { GET } from '@/src/app/api/cron/capacity-outbox/route';

function authed(query = '') {
  return new Request(`http://localhost/api/cron/capacity-outbox${query}`, {
    headers: { authorization: 'Bearer test-secret' },
  });
}

describe('capacity outbox drain cron route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    runOutboxWorkerMock.mockResolvedValue({ processed: 3, failed: 1, dead: 0, batches: 2 });
  });

  it('requires cron auth and never drains without it', async () => {
    const response = await GET(new Request('http://localhost/api/cron/capacity-outbox'));

    expect(response.status).toBe(401);
    expect(response.headers.get('cache-control')).toContain('no-store');
    expect(runOutboxWorkerMock).not.toHaveBeenCalled();
  });

  it('drains the outbox with the default batch size and reports the totals', async () => {
    const response = await GET(authed());

    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toContain('no-store');
    expect(runOutboxWorkerMock).toHaveBeenCalledWith({ limit: 100 });
    await expect(response.json()).resolves.toEqual({
      success: true,
      runId: '00000000-0000-4000-8000-000000000042',
      limit: 100,
      processed: 3,
      failed: 1,
      dead: 0,
      batches: 2,
    });
  });

  it('reports and logs dead-lettered events', async () => {
    runOutboxWorkerMock.mockResolvedValue({ processed: 2, failed: 0, dead: 3, batches: 1 });

    const response = await GET(authed());

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ success: true, dead: 3 });
    expect(loggerWarnMock).toHaveBeenCalledWith('Capacity outbox drain dead-lettered events.', {
      source: 'cron.capacity-outbox',
      runId: '00000000-0000-4000-8000-000000000042',
      dead: 3,
      processed: 2,
      failed: 0,
      batches: 1,
    });
  });

  it('does not warn when nothing was dead-lettered', async () => {
    await GET(authed());
    expect(loggerWarnMock).not.toHaveBeenCalled();
  });

  it('caps a requested batch size and ignores invalid values', async () => {
    await GET(authed('?limit=5000'));
    expect(runOutboxWorkerMock).toHaveBeenLastCalledWith({ limit: 200 });

    await GET(authed('?limit=abc'));
    expect(runOutboxWorkerMock).toHaveBeenLastCalledWith({ limit: 100 });

    await GET(authed('?limit=25'));
    expect(runOutboxWorkerMock).toHaveBeenLastCalledWith({ limit: 25 });
  });

  it('answers 503 with a stable code when the batch claim fails', async () => {
    runOutboxWorkerMock.mockResolvedValue({
      processed: 0,
      failed: 0,
      dead: 0,
      batches: 1,
      error: 'CLAIM_FAILED',
    });

    const response = await GET(authed());
    const body = await response.json();

    expect(response.status).toBe(503);
    expect(body).toMatchObject({ success: false, code: 'OUTBOX_CLAIM_FAILED', retryable: true });
  });

  it('never returns raw error text for an unexpected failure', async () => {
    runOutboxWorkerMock.mockRejectedValue(new Error('SECRET_DB_DETAIL relation capacity_outbox'));

    const response = await GET(authed());
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body).toMatchObject({ code: 'OUTBOX_DRAIN_FAILED' });
    expect(JSON.stringify(body)).not.toContain('SECRET_DB_DETAIL');
    expect(JSON.stringify(loggerErrorMock.mock.calls)).not.toContain('SECRET_DB_DETAIL');
    expect(captureServerExceptionMock).toHaveBeenCalledTimes(1);
  });
});
