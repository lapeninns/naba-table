import { describe, expect, it } from 'vitest';

import {
  buildOpsEmailQueueMetrics,
  formatOpsEmailQueueDateTime,
  getOpsEmailQueueStatusBadgeVariant,
  getOpsEmailQueueStatusLabel,
  getOpsEmailQueueTotal,
  getOpsEmailQueueTypeLabel,
  OPS_EMAIL_QUEUE_STATUS_OPTIONS,
  resolveOpsEmailQueueQueryStatus,
} from '@/components/features/email-delivery/opsEmailQueuePanelDomain';

import type { OpsEmailQueueFeedResponse } from '@/types/emailQueue';

describe('opsEmailQueuePanelDomain', () => {
  it('formats timestamps and preserves invalid input', () => {
    expect(formatOpsEmailQueueDateTime(null, 'Europe/London')).toBe('—');
    expect(formatOpsEmailQueueDateTime('not-a-date', 'Europe/London')).toBe('not-a-date');
    expect(formatOpsEmailQueueDateTime('2026-05-20T09:00:00.000Z', 'Europe/London')).toContain(
      'May 20',
    );
  });

  it('maps queue statuses and job types to operator labels', () => {
    expect(OPS_EMAIL_QUEUE_STATUS_OPTIONS.map((option) => option.value)).toEqual([
      'all',
      'delayed',
      'waiting',
      'active',
      'dlq',
    ]);
    expect(getOpsEmailQueueStatusLabel('dlq')).toBe('Needs attention');
    expect(getOpsEmailQueueStatusBadgeVariant('dlq')).toBe('destructive');
    expect(getOpsEmailQueueTypeLabel('reminder_24h')).toBe('24-hour reminder');
    expect(getOpsEmailQueueTypeLabel('custom_job_type')).toBe('custom job type');
  });

  it('builds queue metrics and query parameters from summary/filter state', () => {
    expect(
      buildOpsEmailQueueMetrics({
        active: 3,
        delayed: 2,
        dlq: 1,
        total: 10,
        waiting: 4,
      }),
    ).toEqual([
      { label: 'Total in queue', value: 10, tone: 'slate' },
      { label: 'Scheduled for later', value: 2, tone: 'amber' },
      { label: 'Ready to send', value: 4, tone: 'blue' },
      { label: 'Sending now', value: 3, tone: 'emerald' },
      { label: 'Needs attention', value: 1, tone: 'rose' },
    ]);
    expect(resolveOpsEmailQueueQueryStatus('all')).toBeUndefined();
    expect(resolveOpsEmailQueueQueryStatus('waiting')).toBe('waiting');
  });

  it('extracts queue total only from successful responses', () => {
    const okResponse = {
      ok: true,
      jobs: [],
      pageInfo: { hasNext: false, page: 1, pageSize: 25, total: 7 },
      restaurantId: 'rest-1',
      summary: { active: 0, delayed: 0, dlq: 0, total: 7, waiting: 7 },
      timestamp: '2026-05-20T09:00:00.000Z',
    } satisfies OpsEmailQueueFeedResponse;

    expect(getOpsEmailQueueTotal(okResponse)).toBe(7);
    expect(getOpsEmailQueueTotal({ ok: false, code: 'FORBIDDEN', error: 'Nope' })).toBe(0);
  });
});
