import { describe, expect, it } from 'vitest';

import { buildCommunicationsOverviewMetrics } from '@/components/features/communications-delivery/communicationsDeliverySelectors';

describe('communications overview metrics', () => {
  it('never represents missing summaries as a successful zero', () => {
    const metrics = buildCommunicationsOverviewMetrics({
      emailSummary: null,
      messageSummary: null,
    });
    expect(metrics.map((metric) => metric.value)).toEqual(['—', '—', '—', '—']);
    expect(metrics.every((metric) => metric.hint === 'Summary unavailable')).toBe(true);
  });
});
