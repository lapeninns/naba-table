import { NextResponse } from 'next/server';

import { logger } from '@/lib/logger';

const timingLogger = logger.child({ module: 'api.ops.bookings.performance' });

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
    timingLogger.info('ops.booking_api.timing', {
      route,
      status,
      duration_ms: durationMs(),
      marks: Object.fromEntries(marks.map((mark) => [mark.name, mark.durationMs])),
      ...(meta ?? {}),
    });
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
