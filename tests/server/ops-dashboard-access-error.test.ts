import { describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/logger', async (importOriginal) => {
  const actual = await importOriginal<typeof LoggerModule>();
  return { ...actual, logger: { ...actual.logger, warn: vi.fn(), error: vi.fn(), info: vi.fn() } };
});

import { buildDashboardAccessErrorResponse } from '@/app/api/ops/dashboard/_shared';
import { GuardError } from '@/server/auth/guards';

import type * as LoggerModule from '@/lib/logger';

describe('buildDashboardAccessErrorResponse', () => {
  it('returns the C1 body for a guard failure and keeps its status and code', async () => {
    const res = buildDashboardAccessErrorResponse(
      'summary',
      new GuardError({
        status: 403,
        code: 'FORBIDDEN',
        message: 'You do not have access to this restaurant',
        details: { raw: 'SECRET_DB_DETAIL owner@example.com' },
      }),
    );
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body).toMatchObject({
      code: 'FORBIDDEN',
      message: 'You do not have access to this restaurant',
      error: 'You do not have access to this restaurant',
    });
    expect(JSON.stringify(body)).not.toContain('SECRET_DB_DETAIL');
  });

  it('adds Retry-After and retryable for a 503 guard failure', async () => {
    const res = buildDashboardAccessErrorResponse(
      'summary',
      new GuardError({
        status: 503,
        code: 'MEMBERSHIP_VALIDATION_UNAVAILABLE',
        message: 'Try again shortly',
      }),
    );
    expect(res.status).toBe(503);
    expect(res.headers.get('Retry-After')).toBe('30');
    expect((await res.json()).retryable).toBe(true);
  });

  it('never echoes an unexpected error', async () => {
    const res = buildDashboardAccessErrorResponse(
      'summary',
      new Error('SECRET_DB_DETAIL owner@example.com'),
    );
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.code).toBe('INTERNAL_ERROR');
    expect(JSON.stringify(body)).not.toContain('SECRET_DB_DETAIL');
  });
});
