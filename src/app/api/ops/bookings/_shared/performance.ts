import { NextResponse } from 'next/server';

import { logger } from '@/lib/logger';
import { sampleRoutineLog } from '@/lib/observability/log-sampling';

const timingLogger = logger.child({ module: 'api.ops.bookings.performance' });

// Healthy, fast requests are sampled 1-in-10 to keep a representative latency
// baseline without one info log per request; slow requests and non-2xx/3xx
// responses always log so incidents and the latency tail stay fully visible.
const ROUTINE_TIMING_SAMPLE_RATE = 10;
const SLOW_REQUEST_THRESHOLD_MS = 1_200;

type TimingMark = {
  name: string;
  durationMs: number;
};

function nowMs() {
  return Date.now();
}

function sanitizeServerTimingToken(value: string) {
  return value.replace(/[^a-zA-Z0-9_-]/g, '_');
}

export function createOpsBookingApiTiming(route: string) {
  const startedAt = nowMs();
  const marks: TimingMark[] = [];
  let logged = false;

  const durationMs = () => Math.max(0, nowMs() - startedAt);

  const recordMark = (name: string, started: number) => {
    marks.push({ name, durationMs: Math.max(0, nowMs() - started) });
  };

  const buildHeaders = (headers?: HeadersInit) => {
    const nextHeaders = new Headers(headers);
    const totalMs = durationMs();
    const serverTiming = [
      `total;dur=${totalMs}`,
      ...marks.map((mark) => `${sanitizeServerTimingToken(mark.name)};dur=${mark.durationMs}`),
    ].join(', ');
    nextHeaders.set('Server-Timing', serverTiming);
    nextHeaders.set('X-Ops-Api-Duration-Ms', String(totalMs));
    return nextHeaders;
  };

  const log = (status: number, meta?: Record<string, unknown>) => {
    if (logged) return;
    logged = true;
    const totalMs = durationMs();
    const payload = {
      route,
      status,
      duration_ms: totalMs,
      marks: Object.fromEntries(marks.map((mark) => [mark.name, mark.durationMs])),
      ...(meta ?? {}),
    };

    const isFailure = status >= 400;
    const isSlow = totalMs >= SLOW_REQUEST_THRESHOLD_MS;
    if (isFailure) {
      timingLogger.warn('ops.booking_api.timing', payload);
      return;
    }
    if (isSlow || sampleRoutineLog(`ops.booking_api.timing:${route}`, ROUTINE_TIMING_SAMPLE_RATE)) {
      timingLogger.info('ops.booking_api.timing', { ...payload, ...(isSlow ? { slow: true } : {}) });
      return;
    }
    timingLogger.debug('ops.booking_api.timing', payload);
  };

  return {
    async measure<T>(name: string, work: PromiseLike<T>): Promise<T> {
      const markStartedAt = nowMs();
      try {
        return await work;
      } finally {
        recordMark(name, markStartedAt);
      }
    },
    json(body: unknown, init: ResponseInit = {}, meta?: Record<string, unknown>) {
      const status = init.status ?? 200;
      log(status, meta);
      return NextResponse.json(body, {
        ...init,
        headers: buildHeaders(init.headers),
      });
    },
    withHeaders(response: NextResponse, meta?: Record<string, unknown>) {
      log(response.status, meta);
      const headers = buildHeaders(response.headers);
      headers.forEach((value, key) => {
        response.headers.set(key, value);
      });
      return response;
    },
  };
}
