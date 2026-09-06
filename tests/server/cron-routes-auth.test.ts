import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const consumeRateLimitMock = vi.hoisted(() => vi.fn());
const isEmailQueueEnabledMock = vi.hoisted(() => vi.fn());
const isDualSyncAutoCandidatesEnabledMock = vi.hoisted(() => vi.fn());
const isDualSyncScheduledRefreshEnabledMock = vi.hoisted(() => vi.fn());
const recordObservabilityEventMock = vi.hoisted(() => vi.fn());
const reconcileDeliveryAnomaliesMock = vi.hoisted(() => vi.fn());
const triggerEmailQueueDrainMock = vi.hoisted(() => vi.fn());
const drainMobileReviewIntentsMock = vi.hoisted(() => vi.fn());
const processEmailJobsMock = vi.hoisted(() => vi.fn());
const drainReviewSchedulingJobsMock = vi.hoisted(() => vi.fn());
const autoCompletePastBookingsMock = vi.hoisted(() => vi.fn());
const runScheduledRefreshForAllTenantsMock = vi.hoisted(() => vi.fn());
const enqueueScheduledRefreshJobsMock = vi.hoisted(() => vi.fn());
const runAutoExportForAllTenantsMock = vi.hoisted(() => vi.fn());
const runDualSyncOperationalHealthAlertSweepMock = vi.hoisted(() => vi.fn());
const processNextDualSyncJobMock = vi.hoisted(() => vi.fn());
const runContentRetentionMock = vi.hoisted(() => vi.fn());
const createSupabaseContentRetentionPortMock = vi.hoisted(() => vi.fn());
const getServiceSupabaseClientMock = vi.hoisted(() => vi.fn());
const createGrantRecoveryPortMock = vi.hoisted(() => vi.fn());
const recoverStaleGrantsMock = vi.hoisted(() => vi.fn());
const reconcileTerminalNoticesMock = vi.hoisted(() => vi.fn());

vi.mock('@/server/security/rate-limit', () => ({
  consumeRateLimit: consumeRateLimitMock,
}));

vi.mock('@/server/runtime-policy', () => ({
  isEmailQueueEnabled: isEmailQueueEnabledMock,
}));

vi.mock('@/server/dual-sync/runtime-controls', () => ({
  isDualSyncAutoCandidatesEnabled: isDualSyncAutoCandidatesEnabledMock,
  isDualSyncScheduledRefreshEnabled: isDualSyncScheduledRefreshEnabledMock,
}));

vi.mock('@/server/observability', () => ({
  recordObservabilityEvent: recordObservabilityEventMock,
}));

vi.mock('@/server/observability/delivery-reconciler', () => ({
  reconcileDeliveryAnomalies: reconcileDeliveryAnomaliesMock,
}));

vi.mock('@/server/queue/email', async () => {
  const actual = await vi.importActual<Record<string, unknown>>('@/server/queue/email');
  return {
    ...actual,
    triggerEmailQueueDrain: triggerEmailQueueDrainMock,
  };
});

vi.mock('@/server/queue/email-processing', async () => {
  const actual = await vi.importActual<Record<string, unknown>>('@/server/queue/email-processing');
  return {
    ...actual,
    processEmailJobs: processEmailJobsMock,
  };
});

vi.mock('@/server/reviews/scheduling-retry', () => ({
  drainReviewSchedulingJobs: drainReviewSchedulingJobsMock,
}));

vi.mock('@/server/jobs/auto-complete-bookings', () => ({
  autoCompletePastBookings: autoCompletePastBookingsMock,
}));

vi.mock('@/server/queue/mobile-review-intents', async () => {
  const actual = await vi.importActual<Record<string, unknown>>(
    '@/server/queue/mobile-review-intents',
  );
  return {
    ...actual,
    drainMobileReviewIntents: drainMobileReviewIntentsMock,
  };
});

vi.mock('@/server/dual-sync/scheduling', () => ({
  enqueueScheduledRefreshJobs: enqueueScheduledRefreshJobsMock,
  runScheduledRefreshForAllTenants: runScheduledRefreshForAllTenantsMock,
}));

vi.mock('@/server/dual-sync/scheduling/auto-export', () => ({
  runAutoExportForAllTenants: runAutoExportForAllTenantsMock,
}));

vi.mock('@/server/dual-sync/observability', () => ({
  runDualSyncOperationalHealthAlertSweep: runDualSyncOperationalHealthAlertSweepMock,
}));

vi.mock('@/server/dual-sync/queue', () => ({
  processNextDualSyncJob: processNextDualSyncJobMock,
}));

vi.mock('@/server/dual-sync/retention', async () => {
  const actual = await vi.importActual<Record<string, unknown>>('@/server/dual-sync/retention');
  return {
    ...actual,
    createSupabaseContentRetentionPort: createSupabaseContentRetentionPortMock,
    runContentRetention: runContentRetentionMock,
  };
});

vi.mock('@/server/supabase', () => ({
  getServiceSupabaseClient: getServiceSupabaseClientMock,
}));

vi.mock('@/server/dual-sync/health/dispatched-grant-recovery', () => ({
  createSupabaseGbpDispatchedGrantRecoveryPort: createGrantRecoveryPortMock,
  recoverStaleGbpDispatchedGrants: recoverStaleGrantsMock,
}));

vi.mock('@/server/dual-sync/notifications', () => ({
  reconcileGoogleWriteTerminalNotices: reconcileTerminalNoticesMock,
}));

import { GET as autoCompleteGET } from '@/src/app/api/cron/auto-complete-bookings/route';
import { GET as autoExportGET } from '@/src/app/api/cron/dual-sync/auto-export/route';
import { GET as healthGET } from '@/src/app/api/cron/dual-sync/health/route';
import { GET as queueGET } from '@/src/app/api/cron/dual-sync/queue/route';
import { GET as refreshGET } from '@/src/app/api/cron/dual-sync/refresh/route';
import { GET as requestLogRetentionGET } from '@/src/app/api/cron/dual-sync/request-log-retention/route';
import {
  GET as processEmailsGET,
  POST as processEmailsPOST,
} from '@/src/app/api/cron/process-emails/route';

const CURRENT_SECRET = 'current-secret';
const PREVIOUS_SECRET = 'previous-secret';

function setCronEnv(value?: string) {
  if (value === undefined) {
    delete process.env.CRON_SECRET;
  } else {
    process.env.CRON_SECRET = value;
  }
  delete process.env.CRON_SECRET_PREVIOUS;
  delete process.env.CRON_SECRETS;
}

function cronRequest(path: string, secret = CURRENT_SECRET, init: RequestInit = {}) {
  const headers = new Headers(init.headers);
  headers.set('authorization', `Bearer ${secret}`);
  if (init.body && !headers.has('content-type')) {
    headers.set('content-type', 'application/json');
  }
  return new NextRequest(`https://www.nabatable.com${path}`, {
    ...init,
    headers,
  });
}

const cronRoutes = [
  [
    'process-emails GET',
    () => processEmailsGET(new NextRequest('https://www.nabatable.com/api/cron/process-emails')),
  ],
  [
    'process-emails POST',
    () =>
      processEmailsPOST(
        new NextRequest('https://www.nabatable.com/api/cron/process-emails', {
          method: 'POST',
          body: JSON.stringify({ jobs: [] }),
        }),
      ),
  ],
  [
    'auto-complete',
    () =>
      autoCompleteGET(
        new NextRequest('https://www.nabatable.com/api/cron/auto-complete-bookings?dryRun=1'),
      ),
  ],
  [
    'dual-sync refresh',
    () =>
      refreshGET(new NextRequest('https://www.nabatable.com/api/cron/dual-sync/refresh?dryRun=1')),
  ],
  [
    'dual-sync auto-export',
    () =>
      autoExportGET(
        new NextRequest('https://www.nabatable.com/api/cron/dual-sync/auto-export?dryRun=1'),
      ),
  ],
  [
    'dual-sync queue',
    () => queueGET(new NextRequest('https://www.nabatable.com/api/cron/dual-sync/queue?dryRun=1')),
  ],
  [
    'dual-sync health',
    () =>
      healthGET(new NextRequest('https://www.nabatable.com/api/cron/dual-sync/health?dryRun=1')),
  ],
  [
    'dual-sync request-log retention',
    () =>
      requestLogRetentionGET(
        new NextRequest(
          'https://www.nabatable.com/api/cron/dual-sync/request-log-retention?dryRun=1',
        ),
      ),
  ],
] as const;

describe('cron route authentication', () => {
  it('reports retry failures with HTTP 500 and a truthful summary', async () => {
    drainReviewSchedulingJobsMock.mockResolvedValueOnce({ processed: 0, failed: 1 });
    const response = await autoCompleteGET(cronRequest('/api/cron/auto-complete-bookings'));
    expect(response.status).toBe(500);
    expect(await response.json()).toMatchObject({
      success: false,
      reviewScheduling: { failed: 1 },
    });
  });
  it('does not drain scheduling jobs during a dry run', async () => {
    const response = await autoCompleteGET(
      cronRequest('/api/cron/auto-complete-bookings?dryRun=1'),
    );
    expect(response.status).toBe(200);
    expect(drainReviewSchedulingJobsMock).not.toHaveBeenCalled();
  });
  beforeEach(() => {
    vi.clearAllMocks();
    setCronEnv(CURRENT_SECRET);
    consumeRateLimitMock.mockResolvedValue({
      ok: true,
      limit: 20,
      remaining: 19,
      resetAt: Date.now() + 60_000,
      source: 'memory',
    });
    isEmailQueueEnabledMock.mockReturnValue(true);
    isDualSyncAutoCandidatesEnabledMock.mockReturnValue(true);
    isDualSyncScheduledRefreshEnabledMock.mockReturnValue(true);
    recordObservabilityEventMock.mockResolvedValue(undefined);
    reconcileDeliveryAnomaliesMock.mockResolvedValue({ checked: 0 });
    triggerEmailQueueDrainMock.mockResolvedValue({
      success: true,
      processed: 0,
      stats: { sent: 0, skipped: 0, failed: 0 },
      results: [],
    });
    drainMobileReviewIntentsMock.mockResolvedValue({
      processed: 0,
      sent: 0,
      skipped: 0,
      failed: 0,
    });
    processEmailJobsMock.mockResolvedValue({
      processed: 1,
      stats: { sent: 1, skipped: 0, failed: 0 },
      results: [{ jobId: 'job-1', success: true }],
    });
    drainReviewSchedulingJobsMock.mockResolvedValue({ processed: 0, failed: 0 });
    autoCompletePastBookingsMock.mockResolvedValue({
      mode: 'dry-run',
      nowUtc: '2026-05-05T00:00:00.000Z',
      windowMinutes: 30,
      limit: 1,
      restaurantsTotal: 0,
      restaurantsProcessed: 0,
      restaurantsSkippedWindow: 0,
      candidates: 0,
      completed: 0,
      skipped: 0,
      errors: 0,
    });
    runScheduledRefreshForAllTenantsMock.mockResolvedValue({
      restaurantsConsidered: 0,
      restaurantsProcessed: 0,
      restaurantIds: [],
      summaries: [],
      errors: [],
      dryRun: true,
    });
    runAutoExportForAllTenantsMock.mockResolvedValue({
      restaurantsConsidered: 0,
      restaurantsProcessed: 0,
      summaries: [],
      errors: [],
      dryRun: true,
    });
    runDualSyncOperationalHealthAlertSweepMock.mockResolvedValue({
      restaurantsConsidered: 0,
      restaurantsProcessed: 0,
      restaurantIds: [],
      summaries: [],
      alertsEmitted: 0,
      errors: [],
      dryRun: true,
    });
    processNextDualSyncJobMock.mockResolvedValue({ status: 'idle', job: null });
    createSupabaseContentRetentionPortMock.mockReturnValue({ retention: true });
    runContentRetentionMock.mockResolvedValue({
      dryRun: false,
      runAt: '2026-05-10T00:00:00.000Z',
      limit: 1_000,
      totals: { matched: 0, mutated: 0 },
      oldestOutstandingAgeMs: null,
      level: 'healthy',
      moreLikely: false,
      stores: [],
    });
    getServiceSupabaseClientMock.mockReturnValue({ service: true });
    createGrantRecoveryPortMock.mockReturnValue({ recovery: true });
    recoverStaleGrantsMock.mockResolvedValue({
      mode: 'mutated',
      cutoff: '2026-05-09T23:55:00.000Z',
      profilesConsidered: 1,
      profilesProcessed: 1,
      recovered: 1,
      capped: false,
      errors: [],
    });
    reconcileTerminalNoticesMock.mockResolvedValue({
      considered: 1,
      materialized: 1,
      failed: 0,
    });
  });

  it.each(cronRoutes)('%s fails closed when CRON_SECRET is missing', async (_name, callRoute) => {
    setCronEnv(undefined);

    const response = await callRoute();
    const payload = await response.json();

    expect(response.status).toBe(503);
    expect(payload).toEqual({ error: 'Cron authentication is not configured.' });
    expect(triggerEmailQueueDrainMock).not.toHaveBeenCalled();
    expect(processEmailJobsMock).not.toHaveBeenCalled();
    expect(autoCompletePastBookingsMock).not.toHaveBeenCalled();
    expect(runScheduledRefreshForAllTenantsMock).not.toHaveBeenCalled();
    expect(runAutoExportForAllTenantsMock).not.toHaveBeenCalled();
    expect(runDualSyncOperationalHealthAlertSweepMock).not.toHaveBeenCalled();
    expect(processNextDualSyncJobMock).not.toHaveBeenCalled();
    expect(runContentRetentionMock).not.toHaveBeenCalled();
  });

  it.each([
    [
      'process-emails GET',
      () => processEmailsGET(cronRequest('/api/cron/process-emails', 'wrong')),
    ],
    [
      'process-emails POST',
      () =>
        processEmailsPOST(
          cronRequest('/api/cron/process-emails', 'wrong', {
            method: 'POST',
            body: JSON.stringify({ jobs: [] }),
          }),
        ),
    ],
    [
      'auto-complete',
      () => autoCompleteGET(cronRequest('/api/cron/auto-complete-bookings?dryRun=1', 'wrong')),
    ],
    [
      'dual-sync refresh',
      () => refreshGET(cronRequest('/api/cron/dual-sync/refresh?dryRun=1', 'wrong')),
    ],
    [
      'dual-sync auto-export',
      () => autoExportGET(cronRequest('/api/cron/dual-sync/auto-export?dryRun=1', 'wrong')),
    ],
    ['dual-sync queue', () => queueGET(cronRequest('/api/cron/dual-sync/queue?dryRun=1', 'wrong'))],
    [
      'dual-sync health',
      () => healthGET(cronRequest('/api/cron/dual-sync/health?dryRun=1', 'wrong')),
    ],
    [
      'dual-sync request-log retention',
      () =>
        requestLogRetentionGET(
          cronRequest('/api/cron/dual-sync/request-log-retention?dryRun=1', 'wrong'),
        ),
    ],
  ])('%s rejects wrong bearer tokens before work', async (_name, callRoute) => {
    const response = await callRoute();
    const payload = await response.json();

    expect(response.status).toBe(401);
    expect(payload).toEqual({ error: 'Unauthorized' });
    if (_name === 'dual-sync health' || _name === 'dual-sync request-log retention') {
      expect(response.headers.get('cache-control')).toBe('private, no-store, max-age=0');
      expect(response.headers.get('cdn-cache-control')).toBe('no-store');
      expect(response.headers.get('vary')).toBe('Cookie, Authorization');
    }
    expect(triggerEmailQueueDrainMock).not.toHaveBeenCalled();
    expect(processEmailJobsMock).not.toHaveBeenCalled();
    expect(autoCompletePastBookingsMock).not.toHaveBeenCalled();
    expect(runScheduledRefreshForAllTenantsMock).not.toHaveBeenCalled();
    expect(runAutoExportForAllTenantsMock).not.toHaveBeenCalled();
    expect(runDualSyncOperationalHealthAlertSweepMock).not.toHaveBeenCalled();
    expect(processNextDualSyncJobMock).not.toHaveBeenCalled();
    expect(runContentRetentionMock).not.toHaveBeenCalled();
  });

  it('rate limits failed cron authentication before recording security events', async () => {
    consumeRateLimitMock.mockResolvedValueOnce({
      ok: false,
      limit: 10,
      remaining: 0,
      resetAt: Date.now() + 60_000,
      source: 'memory',
    });

    const response = await processEmailsGET(cronRequest('/api/cron/process-emails', 'wrong'));
    const payload = await response.json();

    expect(response.status).toBe(429);
    expect(payload).toEqual({ error: 'Too many cron authentication failures.' });
    expect(recordObservabilityEventMock).not.toHaveBeenCalled();
    expect(triggerEmailQueueDrainMock).not.toHaveBeenCalled();
  });

  it('accepts a rotated previous secret', async () => {
    process.env.CRON_SECRET = CURRENT_SECRET;
    process.env.CRON_SECRET_PREVIOUS = PREVIOUS_SECRET;

    const response = await processEmailsGET(
      cronRequest('/api/cron/process-emails', PREVIOUS_SECRET),
    );

    expect(response.status).toBe(200);
    expect(triggerEmailQueueDrainMock).toHaveBeenCalledOnce();
    expect(drainMobileReviewIntentsMock).toHaveBeenCalledWith({ maxJobs: 100 });
  });

  it('returns per-job results required by the Cloudflare queue consumer @contract', async () => {
    const results = [{ jobId: 'synthetic-skipped-job', success: true, skipped: true }];
    processEmailJobsMock.mockResolvedValue({
      processed: 1,
      stats: { sent: 0, skipped: 1, failed: 0 },
      results,
    });
    const response = await processEmailsPOST(
      cronRequest('/api/cron/process-emails', CURRENT_SECRET, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          jobs: [
            {
              id: 'synthetic-skipped-job',
              payload: {
                bookingId: 'nonexistent-booking',
                restaurantId: null,
                type: 'confirmation',
              },
            },
          ],
        }),
      }),
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      success: true,
      processed: 1,
      stats: { sent: 0, skipped: 1, failed: 0 },
      results,
    });
  });

  it('caps large email drain limits', async () => {
    const response = await processEmailsGET(cronRequest('/api/cron/process-emails?maxJobs=999999'));

    expect(response.status).toBe(200);
    expect(triggerEmailQueueDrainMock).toHaveBeenCalledWith({
      types: null,
      maxJobs: 100,
    });
  });

  it('reports mobile review failure without hiding the completed email drain @contract', async () => {
    // Given
    drainMobileReviewIntentsMock.mockRejectedValue(new Error('mobile claim unavailable'));

    // When
    const response = await processEmailsGET(cronRequest('/api/cron/process-emails'));
    const payload = await response.json();

    // Then
    expect(triggerEmailQueueDrainMock).toHaveBeenCalledOnce();
    expect(response.status).toBe(500);
    expect(payload).toMatchObject({
      success: false,
      channels: {
        email: { success: true, processed: 0 },
        mobileReview: { success: false },
      },
    });
  });

  it('drains mobile reviews even when the email queue is disabled @contract', async () => {
    // Given
    isEmailQueueEnabledMock.mockReturnValue(false);

    // When
    const response = await processEmailsGET(cronRequest('/api/cron/process-emails'));

    // Then
    expect(response.status).toBe(200);
    expect(triggerEmailQueueDrainMock).not.toHaveBeenCalled();
    expect(drainMobileReviewIntentsMock).toHaveBeenCalledOnce();
  });

  it('keeps dryRun behind auth and caps auto-complete limits', async () => {
    const response = await autoCompleteGET(
      cronRequest('/api/cron/auto-complete-bookings?dryRun=1&limit=999999&windowMinutes=999'),
    );

    expect(response.status).toBe(200);
    expect(autoCompletePastBookingsMock).toHaveBeenCalledWith({
      dryRun: true,
      limit: 200,
      windowMinutes: 180,
    });
  });

  it('caps scheduled dual-sync provider fan-out limits', async () => {
    await refreshGET(cronRequest('/api/cron/dual-sync/refresh?dryRun=1&limit=999999'));
    await autoExportGET(
      cronRequest(
        '/api/cron/dual-sync/auto-export?dryRun=1&limit=999999&maxCandidatesPerRestaurant=999999',
      ),
    );
    await healthGET(
      cronRequest(
        '/api/cron/dual-sync/health?dryRun=1&limit=999999&windowHours=999999&metricLimit=999999&onlyCritical=1',
      ),
    );

    expect(runScheduledRefreshForAllTenantsMock).toHaveBeenCalledWith({
      client: { service: true },
      maxRestaurants: 50,
      dryRun: true,
    });
    expect(runAutoExportForAllTenantsMock).toHaveBeenCalledWith({
      client: { service: true },
      maxRestaurants: 50,
      maxCandidatesPerRestaurant: 25,
      dryRun: true,
    });
    expect(runDualSyncOperationalHealthAlertSweepMock).toHaveBeenCalledWith({
      client: { service: true },
      maxRestaurants: 50,
      dryRun: true,
      windowMs: 168 * 60 * 60 * 1000,
      limit: 500,
      onlyCritical: true,
    });
  });

  it('lets runtime controls disable scheduled refresh and auto-candidate export crons', async () => {
    isDualSyncScheduledRefreshEnabledMock.mockReturnValue(false);
    isDualSyncAutoCandidatesEnabledMock.mockReturnValue(false);

    const refreshResponse = await refreshGET(cronRequest('/api/cron/dual-sync/refresh?dryRun=1'));
    const autoExportResponse = await autoExportGET(
      cronRequest('/api/cron/dual-sync/auto-export?dryRun=1'),
    );

    expect(refreshResponse.status).toBe(409);
    await expect(refreshResponse.json()).resolves.toEqual({
      error: 'Dual-sync scheduled refresh is disabled for this deployment.',
    });
    expect(autoExportResponse.status).toBe(409);
    await expect(autoExportResponse.json()).resolves.toEqual({
      error: 'Dual-sync auto-candidate export is disabled for this deployment.',
    });
    expect(runScheduledRefreshForAllTenantsMock).not.toHaveBeenCalled();
    expect(runAutoExportForAllTenantsMock).not.toHaveBeenCalled();
  });

  it('records dual-sync health sweep observability and returns the sweep summary', async () => {
    runDualSyncOperationalHealthAlertSweepMock.mockResolvedValueOnce({
      restaurantsConsidered: 2,
      restaurantsProcessed: 2,
      restaurantIds: ['rest-1', 'rest-2'],
      summaries: [
        {
          restaurantId: 'rest-1',
          alertCount: 1,
          criticalCount: 1,
          warningCount: 0,
          alerts: [{ code: 'DEAD_LETTER_JOBS', severity: 'critical', count: 1 }],
        },
      ],
      alertsEmitted: 1,
      errors: [],
      dryRun: false,
    });

    const response = await healthGET(cronRequest('/api/cron/dual-sync/health?windowHours=6'));

    expect(response.status).toBe(200);
    expect(recoverStaleGrantsMock.mock.invocationCallOrder[0]).toBeLessThan(
      reconcileTerminalNoticesMock.mock.invocationCallOrder[0] ?? Number.MAX_SAFE_INTEGER,
    );
    expect(recordObservabilityEventMock).toHaveBeenCalledWith(
      expect.objectContaining({
        source: 'cron.dual-sync.health',
        eventType: 'sweep.triggered',
        severity: 'info',
        context: expect.objectContaining({
          windowHours: 6,
          metricLimit: 200,
        }),
      }),
    );
    expect(recordObservabilityEventMock).toHaveBeenCalledWith(
      expect.objectContaining({
        source: 'cron.dual-sync.health',
        eventType: 'sweep.completed',
        severity: 'warning',
        context: expect.objectContaining({
          restaurantsConsidered: 2,
          restaurantsProcessed: 2,
          alertsEmitted: 1,
          errors: 0,
        }),
      }),
    );
    await expect(response.json()).resolves.toMatchObject({
      success: true,
      dryRun: false,
      windowHours: 6,
      metricLimit: 200,
      alertsEmitted: 1,
      grantRecovery: {
        mode: 'mutated',
        recovered: 1,
        terminalNoticesMaterialized: 1,
        errors: [],
      },
    });
  });

  it('truthfully omits dispatched grant mutation and notice reconciliation in health dry-run', async () => {
    // Given
    const request = cronRequest('/api/cron/dual-sync/health?dryRun=1');

    // When
    const response = await healthGET(request);

    // Then
    expect(response.status).toBe(200);
    expect(recoverStaleGrantsMock).not.toHaveBeenCalled();
    expect(reconcileTerminalNoticesMock).not.toHaveBeenCalled();
    await expect(response.json()).resolves.toMatchObject({
      grantRecovery: {
        mode: 'dry_run_omitted',
        recovered: 0,
        terminalNoticesMaterialized: 0,
        errors: [],
      },
    });
  });

  it('returns safe per-profile grant recovery failures and marks health telemetry warning', async () => {
    // Given
    recoverStaleGrantsMock.mockResolvedValueOnce({
      mode: 'mutated',
      cutoff: '2026-05-09T23:55:00.000Z',
      profilesConsidered: 2,
      profilesProcessed: 2,
      recovered: 1,
      capped: false,
      errors: [
        {
          restaurantId: 'rest-1',
          externalProfileRowId: 'profile-row-1',
          code: 'grant_recovery_failed',
        },
      ],
    });

    // When
    const response = await healthGET(cronRequest('/api/cron/dual-sync/health'));
    const body = await response.json();

    // Then
    expect(response.status).toBe(200);
    expect(body.grantRecovery).toEqual(
      expect.objectContaining({
        recovered: 1,
        errors: [
          {
            restaurantId: 'rest-1',
            externalProfileRowId: 'profile-row-1',
            code: 'grant_recovery_failed',
          },
        ],
      }),
    );
    expect(JSON.stringify(body)).not.toContain('provider body');
    expect(recordObservabilityEventMock).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: 'sweep.completed',
        severity: 'warning',
        context: expect.objectContaining({ grantRecoveryErrors: 1 }),
      }),
    );
  });

  it('caps dual-sync queue worker drain limits and stops on idle', async () => {
    processNextDualSyncJobMock
      .mockResolvedValueOnce({
        status: 'succeeded',
        job: {
          id: 'job-1',
          jobKind: 'publish_batch',
          restaurantId: 'rest-1',
          attemptCount: 1,
          lastErrorCode: null,
        },
      })
      .mockResolvedValueOnce({ status: 'idle', job: null });

    const response = await queueGET(cronRequest('/api/cron/dual-sync/queue?maxJobs=999999'));

    expect(response.status).toBe(200);
    expect(processNextDualSyncJobMock).toHaveBeenCalledTimes(2);
    expect(processNextDualSyncJobMock).toHaveBeenCalledWith({
      client: { service: true },
      workerId: expect.any(String),
    });
    expect(recordObservabilityEventMock).toHaveBeenCalledWith(
      expect.objectContaining({
        source: 'cron.dual-sync.queue',
        eventType: 'drain.triggered',
        severity: 'info',
      }),
    );
    expect(recordObservabilityEventMock).toHaveBeenCalledWith(
      expect.objectContaining({
        source: 'cron.dual-sync.queue',
        eventType: 'drain.completed',
        severity: 'info',
        context: expect.objectContaining({
          maxJobs: 25,
          processed: 1,
          succeeded: 1,
          failed: 0,
        }),
      }),
    );
    await expect(response.json()).resolves.toMatchObject({
      success: true,
      dryRun: false,
      maxJobs: 25,
      processed: 1,
      results: [{ jobId: 'job-1', status: 'succeeded' }],
    });
  });

  it('keeps dual-sync queue dryRun behind auth without claiming jobs', async () => {
    const response = await queueGET(
      cronRequest('/api/cron/dual-sync/queue?dryRun=1&maxJobs=999999'),
    );

    expect(response.status).toBe(200);
    expect(processNextDualSyncJobMock).not.toHaveBeenCalled();
    await expect(response.json()).resolves.toMatchObject({
      success: true,
      dryRun: true,
      maxJobs: 25,
      processed: 0,
      results: [],
    });
  });

  it('caps request-log retention limits and records count-only observability', async () => {
    const port = { retention: true };
    createSupabaseContentRetentionPortMock.mockReturnValueOnce(port);
    runContentRetentionMock.mockResolvedValueOnce({
      dryRun: false,
      runAt: '2026-05-10T00:00:00.000Z',
      limit: 5_000,
      totals: { matched: 5_000, mutated: 5_000 },
      oldestOutstandingAgeMs: 86_400_000,
      level: 'page',
      moreLikely: true,
      stores: [],
    });

    const response = await requestLogRetentionGET(
      cronRequest('/api/cron/dual-sync/request-log-retention?limit=999999'),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('private, no-store, max-age=0');
    expect(createSupabaseContentRetentionPortMock).toHaveBeenCalledWith({ service: true });
    expect(runContentRetentionMock).toHaveBeenCalledWith({
      port,
      now: expect.any(Date),
      limit: 5_000,
      dryRun: false,
      timeBudgetMs: 20_000,
    });
    expect(recordObservabilityEventMock).toHaveBeenCalledWith(
      expect.objectContaining({
        source: 'cron.dual-sync.request-log-retention',
        eventType: 'retention.triggered',
        severity: 'info',
        context: expect.objectContaining({
          limit: 5_000,
        }),
      }),
    );
    expect(recordObservabilityEventMock).toHaveBeenCalledWith(
      expect.objectContaining({
        source: 'cron.dual-sync.request-log-retention',
        eventType: 'retention.completed',
        severity: 'warning',
        context: expect.objectContaining({
          matched: 5_000,
          mutated: 5_000,
          level: 'page',
          moreLikely: true,
        }),
      }),
    );
    await expect(response.json()).resolves.toMatchObject({
      success: true,
      dryRun: false,
      limit: 5_000,
      totals: { matched: 5_000, mutated: 5_000 },
      moreLikely: true,
    });
  });

  it('keeps request-log retention dryRun behind auth without deleting rows', async () => {
    const port = { retention: true };
    createSupabaseContentRetentionPortMock.mockReturnValueOnce(port);
    runContentRetentionMock.mockResolvedValueOnce({
      dryRun: true,
      runAt: '2026-05-10T00:00:00.000Z',
      limit: 5_000,
      totals: { matched: 2, mutated: 0 },
      oldestOutstandingAgeMs: 60_000,
      level: 'healthy',
      moreLikely: false,
      stores: [],
    });
    const response = await requestLogRetentionGET(
      cronRequest('/api/cron/dual-sync/request-log-retention?dryRun=1&limit=999999'),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('private, no-store, max-age=0');
    expect(runContentRetentionMock).toHaveBeenCalledWith({
      port,
      now: expect.any(Date),
      limit: 5_000,
      dryRun: true,
      timeBudgetMs: 20_000,
    });
    await expect(response.json()).resolves.toMatchObject({
      success: true,
      dryRun: true,
      limit: 5_000,
      totals: { matched: 2, mutated: 0 },
      moreLikely: false,
    });
  });

  it('rejects overlapping executions for the same job', async () => {
    let resolveRun: (value: unknown) => void = () => undefined;
    autoCompletePastBookingsMock.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveRun = resolve;
      }),
    );

    const first = autoCompleteGET(cronRequest('/api/cron/auto-complete-bookings?dryRun=1&limit=1'));
    const second = await autoCompleteGET(
      cronRequest('/api/cron/auto-complete-bookings?dryRun=1&limit=1'),
    );

    expect(second.status).toBe(409);
    resolveRun({
      mode: 'dry-run',
      nowUtc: '2026-05-05T00:00:00.000Z',
      windowMinutes: 30,
      limit: 1,
      restaurantsTotal: 0,
      restaurantsProcessed: 0,
      restaurantsSkippedWindow: 0,
      candidates: 0,
      completed: 0,
      skipped: 0,
      errors: 0,
    });
    expect((await first).status).toBe(200);
  });
});
