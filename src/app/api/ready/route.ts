import { NextResponse } from 'next/server';

import { logger } from '@/lib/logger';
import { observeHttpRequest } from '@/lib/observability/http-trace';
import {
  READINESS_SERVICE_NAME,
  buildReadinessReport,
  createDatabaseProbe,
  createGatewayProbe,
  createStorageProbe,
  isAuthorizedMonitoringRequest,
  readinessHttpStatus,
  resolveRevision,
  runReadinessProbes,
} from '@/lib/observability/readiness';
import { getServiceSupabaseClient } from '@/server/supabase';

import type { ReadinessProbe } from '@/lib/observability/readiness';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const readyLogger = logger.child({ module: 'api.ready' });

function unauthorized(): NextResponse {
  return NextResponse.json(
    { error: 'Unauthorized' },
    { status: 401, headers: { 'cache-control': 'no-store' } },
  );
}

/**
 * Builds the read-only probe set. The Supabase client is only reached through
 * a bounded `select` and `storage.listBuckets()`; the email gateway is probed
 * with HEAD so nothing can be enqueued, sent, or published.
 */
function buildProbes(): ReadinessProbe[] {
  const supabase = getServiceSupabaseClient();
  return [
    createDatabaseProbe({
      selectOne: async (signal) => {
        const { error } = await supabase
          .from('restaurants')
          .select('id')
          .limit(1)
          .abortSignal(signal);
        return { error: error ? { message: error.message } : null };
      },
    }),
    createStorageProbe({
      listBuckets: async () => {
        const { error } = await supabase.storage.listBuckets();
        return { error: error ? { message: error.message } : null };
      },
    }),
    createGatewayProbe('email-gateway', {
      url: process.env.CLOUDFLARE_EMAIL_QUEUE_GATEWAY_URL,
      fetcher: fetch,
    }),
  ];
}

export async function GET(request: Request): Promise<Response> {
  return observeHttpRequest(request, async () => {
    if (
      !isAuthorizedMonitoringRequest(
        process.env.MONITORING_TOKEN,
        request.headers.get('authorization'),
      )
    ) {
      readyLogger.warn('readiness probe rejected', {
        reason: process.env.MONITORING_TOKEN?.trim() ? 'unauthorized' : 'unconfigured',
        hasAuthHeader: Boolean(request.headers.get('authorization')),
      });
      return unauthorized();
    }

    let probes: ReadinessProbe[];
    try {
      probes = buildProbes();
    } catch (error) {
      readyLogger.error('readiness probe wiring failed', {
        error: error instanceof Error ? error.message : String(error),
      });
      probes = [];
    }

    const checks = await runReadinessProbes(probes);
    if (probes.length === 0) {
      checks.push({ name: 'database', status: 'down', latencyMs: 0, detail: 'unconfigured' });
    }

    const report = buildReadinessReport({
      service: READINESS_SERVICE_NAME,
      checks,
      ...resolveRevision(process.env),
    });

    if (report.status !== 'ok') {
      readyLogger.warn('readiness degraded', {
        status: report.status,
        checks: report.checks.map((check) => ({
          name: check.name,
          status: check.status,
          latencyMs: check.latencyMs,
          detail: check.detail ?? null,
        })),
      });
    }

    return NextResponse.json(report, {
      status: readinessHttpStatus(report.status),
      headers: { 'cache-control': 'no-store' },
    });
  });
}
