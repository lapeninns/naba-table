import { Settings } from 'luxon';
import { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const sendMonthlyVenueReportsMock = vi.hoisted(() => vi.fn());
const consumeRateLimitMock = vi.hoisted(() => vi.fn());
const recordSecurityEventMock = vi.hoisted(() => vi.fn());
const flushPosthogLogsAfterResponseMock = vi.hoisted(() => vi.fn());

vi.mock('@/server/jobs/monthly-venue-report', () => ({
  sendMonthlyVenueReports: sendMonthlyVenueReportsMock,
}));

vi.mock('@/server/security/rate-limit', () => ({
  consumeRateLimit: consumeRateLimitMock,
}));

vi.mock('@/server/security/events', () => ({
  recordSecurityEvent: recordSecurityEventMock,
}));

vi.mock('@/src/instrumentation', () => ({
  flushPosthogLogsAfterResponse: flushPosthogLogsAfterResponseMock,
}));

import { GET } from '@/src/app/api/cron/monthly-venue-report/route';

const CURRENT_SECRET = 'current-secret';
// 2026-08-05 is the first Wednesday of August 2026; 2026-07-08 is a Wednesday
// past day 7 (the first Wednesday of July 2026 was July 1).
const FIRST_WEDNESDAY = '2026-08-05T09:00:00.000Z';
const NOT_FIRST_WEDNESDAY = '2026-07-08T09:00:00.000Z';

const SEND_SUMMARY = {
  totalVenues: 3,
  sent: 2,
  skipped: 1,
  failed: 0,
  errors: [],
};

function setCronEnv(value?: string) {
  if (value === undefined) {
    delete process.env.CRON_SECRET;
  } else {
    process.env.CRON_SECRET = value;
  }
  delete process.env.CRON_SECRET_PREVIOUS;
  delete process.env.CRON_SECRETS;
}

function cronRequest(query = '', secret: string | null = CURRENT_SECRET) {
  const headers = new Headers();
  if (secret !== null) {
    headers.set('authorization', `Bearer ${secret}`);
  }
  return new NextRequest(`https://www.nabatable.com/api/cron/monthly-venue-report${query}`, {
    headers,
  });
}

function pinTime(iso: string) {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(iso));
}

describe('GET /api/cron/monthly-venue-report', () => {
  beforeEach(() => {
    setCronEnv(CURRENT_SECRET);
    // Pin luxon to UTC so the first-Wednesday guard is deterministic under any host TZ.
    Settings.defaultZone = 'utc';
    consumeRateLimitMock.mockResolvedValue({
      ok: true,
      limit: 20,
      remaining: 19,
      resetAt: Date.now() + 60_000,
      source: 'memory',
    });
    recordSecurityEventMock.mockResolvedValue(undefined);
    flushPosthogLogsAfterResponseMock.mockResolvedValue(undefined);
    sendMonthlyVenueReportsMock.mockResolvedValue(SEND_SUMMARY);
  });

  afterEach(() => {
    vi.useRealTimers();
    Settings.defaultZone = 'system';
    setCronEnv(undefined);
  });

  it('@api @security fails closed when no cron secret is configured', async () => {
    setCronEnv(undefined);

    const response = await GET(cronRequest());
    const payload = await response.json();

    expect(response.status).toBe(503);
    expect(payload).toEqual({ error: 'Cron authentication is not configured.' });
    expect(sendMonthlyVenueReportsMock).not.toHaveBeenCalled();
  });

  it('@api @security rejects wrong bearer tokens before running the report pipeline', async () => {
    const response = await GET(cronRequest('', 'wrong-secret'));
    const payload = await response.json();

    expect(response.status).toBe(401);
    expect(payload).toEqual({ error: 'Unauthorized' });
    expect(sendMonthlyVenueReportsMock).not.toHaveBeenCalled();
  });

  it('@api @security rejects requests without an authorization header', async () => {
    const response = await GET(cronRequest('', null));

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: 'Unauthorized' });
    expect(sendMonthlyVenueReportsMock).not.toHaveBeenCalled();
  });

  it('@api skips outside the first Wednesday without invoking the send pipeline', async () => {
    pinTime(NOT_FIRST_WEDNESDAY);

    const response = await GET(cronRequest());
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload).toEqual({
      success: true,
      skipped: true,
      reason: 'not_first_wednesday',
      runId: expect.any(String),
    });
    expect(sendMonthlyVenueReportsMock).not.toHaveBeenCalled();
  });

  it('@api runs the report send boundary with default args on the first Wednesday', async () => {
    pinTime(FIRST_WEDNESDAY);

    const response = await GET(cronRequest());
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload).toEqual({
      success: true,
      runId: expect.any(String),
      totalVenues: 3,
      sent: 2,
      skipped: 1,
      failed: 0,
      errors: [],
    });
    expect(sendMonthlyVenueReportsMock).toHaveBeenCalledTimes(1);
    expect(sendMonthlyVenueReportsMock).toHaveBeenCalledWith({
      dryRun: false,
      restaurantIdFilter: undefined,
    });
  });

  it('@api forwards force, dryRun and restaurantId filters to the send boundary', async () => {
    pinTime(NOT_FIRST_WEDNESDAY);

    const response = await GET(cronRequest('?force=1&dryRun=true&restaurantId=rest-123'));

    expect(response.status).toBe(200);
    expect(sendMonthlyVenueReportsMock).toHaveBeenCalledTimes(1);
    expect(sendMonthlyVenueReportsMock).toHaveBeenCalledWith({
      dryRun: true,
      restaurantIdFilter: 'rest-123',
    });
  });

  it('@api returns a generic 500 when the report pipeline fails', async () => {
    pinTime(FIRST_WEDNESDAY);
    sendMonthlyVenueReportsMock.mockRejectedValue(
      new Error('SECRET_PROVIDER_DETAIL resend exploded'),
    );

    const response = await GET(cronRequest());
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body).toEqual({
      error: 'Monthly venue report cron failed.',
      code: 'INTERNAL_ERROR',
      message: 'Monthly venue report cron failed.',
    });
    expect(JSON.stringify(body)).not.toContain('SECRET_PROVIDER_DETAIL');
  });
});
