/**
 * I5 raw-error sweep: routes that used to echo `error.message` (and, for the
 * admin queue status, the stack) to the client now answer unexpected failures
 * through the C1 `internalError` helper. Each case injects a dependency failure
 * whose message looks like a secret plus PII and asserts that none of it
 * reaches the response body or the logs, while the status, the no-store
 * headers and the fixed copy stay as before.
 */
import { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const SECRET = 'SECRET_DB_DETAIL owner@example.com';

const resolveRestaurantIdMock = vi.hoisted(() => vi.fn());
const ensureRestaurantAdminAccessMock = vi.hoisted(() => vi.fn());
const getServiceSupabaseClientMock = vi.hoisted(() => vi.fn());
const captureSafeGbpExceptionMock = vi.hoisted(() => vi.fn());
const requireProviderRefreshBudgetMock = vi.hoisted(() => vi.fn());
const requireApiRateLimitMock = vi.hoisted(() => vi.fn());
const getFoodMenusContextMock = vi.hoisted(() => vi.fn());
const requireCronAuthAndRunMock = vi.hoisted(() => vi.fn());
const getEmailQueueStatusMock = vi.hoisted(() => vi.fn());

vi.mock('@/app/api/ops/restaurants/[id]/_shared', () => ({
  resolveRestaurantId: resolveRestaurantIdMock,
  ensureRestaurantAdminAccess: ensureRestaurantAdminAccessMock,
}));

vi.mock('@/server/supabase', () => ({
  getServiceSupabaseClient: getServiceSupabaseClientMock,
}));

vi.mock('@/server/dual-sync/retention/telemetry', () => ({
  captureSafeGbpException: captureSafeGbpExceptionMock,
}));

vi.mock('@/server/security/provider-rate-limit', () => ({
  requireProviderRefreshBudget: requireProviderRefreshBudgetMock,
}));

vi.mock('@/server/security/api-rate-limit', () => ({
  requireApiRateLimit: requireApiRateLimitMock,
}));

vi.mock('@/server/google-business-profile/service', () => ({
  getGoogleBusinessProfileFoodMenusContext: getFoodMenusContextMock,
}));

vi.mock('@/server/dual-sync/runtime-controls', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return { ...actual, isDualSyncAutoCandidatesEnabled: () => true };
});

// Request-body schemas are not under test here; accept any body so every POST
// reaches its domain call.
vi.mock(
  '@/app/api/ops/restaurants/[id]/google-business-profile/food-menus/_shared',
  async (importOriginal) => {
    const actual =
      await importOriginal<Record<string, unknown>>();
    const passThrough = { parse: (value: unknown) => value };
    return {
      ...actual,
      FoodMenusProjectionRequestSchema: passThrough,
      FoodMenusImportReviewRequestSchema: passThrough,
      FoodMenusImportReviewRefreshRequestSchema: passThrough,
      FoodMenusImportReviewDecisionRequestSchema: passThrough,
    };
  },
);

vi.mock('@/server/security/cron-auth', () => ({
  requireCronAuthAndRun: requireCronAuthAndRunMock,
}));

vi.mock('@/server/runtime-policy', () => ({
  isEmailQueueEnabled: () => true,
}));

vi.mock('@/server/queue/email', () => ({
  getEmailQueueStatus: getEmailQueueStatusMock,
}));

import { GET as queueStatusGET } from '@/src/app/api/admin/queue-status/route';
import { POST as autoExportPOST } from '@/src/app/api/ops/restaurants/[id]/dual-sync/auto-export/route';
import { GET as candidatesGET } from '@/src/app/api/ops/restaurants/[id]/dual-sync/candidates/route';
import {
  GET as controlGET,
  PATCH as controlPATCH,
} from '@/src/app/api/ops/restaurants/[id]/dual-sync/control/route';
import { POST as jobRetryPOST } from '@/src/app/api/ops/restaurants/[id]/dual-sync/jobs/[jobId]/retry/route';
import { GET as jobsGET } from '@/src/app/api/ops/restaurants/[id]/dual-sync/jobs/route';
import { GET as metricsGET } from '@/src/app/api/ops/restaurants/[id]/dual-sync/metrics/route';
import { GET as operationsGET } from '@/src/app/api/ops/restaurants/[id]/dual-sync/operations/route';
import { GET as publishJobGET } from '@/src/app/api/ops/restaurants/[id]/dual-sync/publish-jobs/[jobId]/route';
import { GET as publishJobsGET } from '@/src/app/api/ops/restaurants/[id]/dual-sync/publish-jobs/route';
import { POST as refreshPOST } from '@/src/app/api/ops/restaurants/[id]/dual-sync/refresh/route';
import { GET as stateGET } from '@/src/app/api/ops/restaurants/[id]/dual-sync/state/route';
import { POST as importDecisionPOST } from '@/src/app/api/ops/restaurants/[id]/google-business-profile/food-menus/import-review/[reviewId]/decision/route';
import { POST as importRefreshPOST } from '@/src/app/api/ops/restaurants/[id]/google-business-profile/food-menus/import-review/refresh/route';
import {
  GET as importReviewGET,
  POST as importReviewPOST,
} from '@/src/app/api/ops/restaurants/[id]/google-business-profile/food-menus/import-review/route';
import { POST as projectionPOST } from '@/src/app/api/ops/restaurants/[id]/google-business-profile/food-menus/projection/route';

type RouteCtx = { params: Promise<Record<string, string>> };
type Handler = (req: NextRequest, ctx: RouteCtx) => Promise<Response>;

const BASE = 'https://app.nabatable.com/api/ops/restaurants/rest-1';

function jsonRequest(path: string, method: string, body?: unknown) {
  return new NextRequest(`${BASE}${path}`, {
    method,
    headers: { 'content-type': 'application/json' },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}

type SweepCase = {
  name: string;
  handler: Handler;
  request: () => NextRequest;
  params?: Record<string, string>;
  message: string;
  /** Inject the failure somewhere other than the service client. */
  arrange?: () => void;
};

const cases: SweepCase[] = [
  {
    name: 'dual-sync auto-export POST',
    handler: autoExportPOST as Handler,
    request: () => jsonRequest('/dual-sync/auto-export', 'POST', {}),
    message: 'Auto-export failed.',
  },
  {
    name: 'dual-sync candidates GET',
    handler: candidatesGET as Handler,
    request: () => jsonRequest('/dual-sync/candidates', 'GET'),
    message: 'Failed to load dual-sync candidates.',
  },
  {
    name: 'dual-sync control GET',
    handler: controlGET as Handler,
    request: () => jsonRequest('/dual-sync/control', 'GET'),
    message: 'Failed to load dual-sync control.',
  },
  {
    name: 'dual-sync control PATCH',
    handler: controlPATCH as Handler,
    request: () => jsonRequest('/dual-sync/control', 'PATCH', { syncPaused: true }),
    message: 'Failed to update dual-sync control.',
  },
  {
    name: 'dual-sync job retry POST',
    handler: jobRetryPOST as Handler,
    request: () => jsonRequest('/dual-sync/jobs/job-1/retry', 'POST'),
    params: { jobId: 'job-1' },
    message: 'Failed to retry dual-sync job.',
  },
  {
    name: 'dual-sync jobs GET',
    handler: jobsGET as Handler,
    request: () => jsonRequest('/dual-sync/jobs', 'GET'),
    message: 'Failed to load dual-sync jobs.',
  },
  {
    name: 'dual-sync metrics GET',
    handler: metricsGET as Handler,
    request: () => jsonRequest('/dual-sync/metrics', 'GET'),
    message: 'Failed to load dual-sync metrics.',
  },
  {
    name: 'dual-sync operations GET',
    handler: operationsGET as Handler,
    request: () => jsonRequest('/dual-sync/operations', 'GET'),
    message: 'Failed to load operations.',
  },
  {
    name: 'dual-sync publish job GET',
    handler: publishJobGET as Handler,
    request: () => jsonRequest('/dual-sync/publish-jobs/job-1', 'GET'),
    params: { jobId: 'job-1' },
    message: 'Failed to load publish job detail.',
  },
  {
    name: 'dual-sync publish jobs GET',
    handler: publishJobsGET as Handler,
    request: () => jsonRequest('/dual-sync/publish-jobs', 'GET'),
    message: 'Failed to load publish jobs.',
  },
  {
    name: 'dual-sync refresh POST',
    handler: refreshPOST as Handler,
    request: () => jsonRequest('/dual-sync/refresh', 'POST'),
    message: 'Refresh failed.',
  },
  {
    name: 'dual-sync state GET',
    handler: stateGET as Handler,
    request: () => jsonRequest('/dual-sync/state', 'GET'),
    message: 'Failed to load dual-sync state.',
  },
  {
    name: 'FoodMenus import-review decision POST',
    handler: importDecisionPOST as Handler,
    request: () =>
      jsonRequest('/google-business-profile/food-menus/import-review/rev-1/decision', 'POST', {
        action: 'apply',
      }),
    params: { reviewId: 'rev-1' },
    message: 'Unable to decide Google FoodMenus import review.',
  },
  {
    name: 'FoodMenus import-review refresh POST',
    handler: importRefreshPOST as Handler,
    request: () =>
      jsonRequest('/google-business-profile/food-menus/import-review/refresh', 'POST', {}),
    message: 'Unable to refresh Google FoodMenus import review.',
    arrange: () => {
      // This route resolves the service client before its try block.
      getServiceSupabaseClientMock.mockReturnValue({ tag: 'service-client' });
      getFoodMenusContextMock.mockRejectedValue(new Error(SECRET));
    },
  },
  {
    name: 'FoodMenus import-review GET',
    handler: importReviewGET as Handler,
    request: () => jsonRequest('/google-business-profile/food-menus/import-review', 'GET'),
    message: 'Unable to list Google FoodMenus import reviews.',
  },
  {
    name: 'FoodMenus import-review POST',
    handler: importReviewPOST as Handler,
    request: () =>
      jsonRequest('/google-business-profile/food-menus/import-review', 'POST', {
        googleFoodMenus: {},
      }),
    message: 'Unable to prepare Google FoodMenus import review.',
  },
  {
    name: 'FoodMenus projection POST',
    handler: projectionPOST as Handler,
    request: () => jsonRequest('/google-business-profile/food-menus/projection', 'POST', {}),
    message: 'Unable to prepare Google FoodMenus projection.',
  },
];

function loggedText(spy: ReturnType<typeof vi.spyOn>): string {
  return JSON.stringify(spy.mock.calls);
}

describe('I5 raw-error sweep: ops dual-sync and GBP FoodMenus routes', () => {
  let consoleError: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
    consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    resolveRestaurantIdMock.mockResolvedValue('rest-1');
    ensureRestaurantAdminAccessMock.mockResolvedValue({ userId: 'user-1' });
    requireProviderRefreshBudgetMock.mockResolvedValue(null);
    requireApiRateLimitMock.mockResolvedValue(null);
    getServiceSupabaseClientMock.mockImplementation(() => {
      throw new Error(SECRET);
    });
  });

  afterEach(() => {
    consoleError.mockRestore();
  });

  it.each(cases)(
    '$name returns a fixed no-store 500 without the raw cause',
    async ({ handler, request, params, message, arrange }) => {
      arrange?.();

      const response = await handler(request(), {
        params: Promise.resolve({ id: 'rest-1', ...params }),
      });
      const text = await response.text();

      expect(response.status).toBe(500);
      expect(response.headers.get('cache-control')).toContain('no-store');
      expect(JSON.parse(text)).toEqual({ error: message, code: 'INTERNAL_ERROR', message });
      expect(text).not.toContain('SECRET_DB_DETAIL');
      expect(text).not.toContain('owner@example.com');

      // The failure is still diagnosable server-side, without the email.
      expect(loggedText(consoleError)).toContain('api.internal_error');
      expect(loggedText(consoleError)).not.toContain('owner@example.com');
      expect(captureSafeGbpExceptionMock).toHaveBeenCalled();
    },
  );
});

describe('I5 raw-error sweep: admin queue status', () => {
  let consoleError: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
    consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    requireCronAuthAndRunMock.mockImplementation(
      async (_request: Request, _job: string, run: () => Promise<Response>) => run(),
    );
  });

  afterEach(() => {
    consoleError.mockRestore();
  });

  it('returns the generic 500 without the error message or stack', async () => {
    getEmailQueueStatusMock.mockRejectedValue(new Error(SECRET));

    const response = await queueStatusGET(
      new NextRequest('https://app.nabatable.com/api/admin/queue-status'),
    );
    const text = await response.text();

    expect(response.status).toBe(500);
    expect(JSON.parse(text)).toMatchObject({ code: 'INTERNAL_ERROR' });
    expect(text).not.toContain('SECRET_DB_DETAIL');
    expect(text).not.toContain('owner@example.com');
    expect(text).not.toContain('at ');
    expect(loggedText(consoleError)).not.toContain('owner@example.com');
  });
});
