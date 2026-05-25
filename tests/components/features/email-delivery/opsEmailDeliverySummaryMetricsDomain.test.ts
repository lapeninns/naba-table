import { describe, expect, it } from 'vitest';

import {
  buildOpsEmailSummaryMetricsModel,
  formatOpsEmailDeliveryDuration,
  formatOpsEmailDeliveryRate,
} from '@/components/features/email-delivery/opsEmailDeliverySummaryMetricsDomain';
import { EMAIL_DELIVERY_STALE_THRESHOLD_HOURS } from '@/types/emailDelivery';

import type { OpsEmailDeliverySummary } from '@/types/emailDelivery';

describe('opsEmailDeliverySummaryMetricsDomain', () => {
  it('formats delivery rates and durations for metric display', () => {
    expect(formatOpsEmailDeliveryRate(0.6)).toBe('60%');
    expect(formatOpsEmailDeliveryRate(0.075)).toBe('7.5%');
    expect(formatOpsEmailDeliveryRate(Number.NaN)).toBe('0%');
    expect(formatOpsEmailDeliveryRate(2)).toBe('100%');

    expect(formatOpsEmailDeliveryDuration(null)).toBe('—');
    expect(formatOpsEmailDeliveryDuration(-1)).toBe('—');
    expect(formatOpsEmailDeliveryDuration(35)).toBe('35s');
    expect(formatOpsEmailDeliveryDuration(180)).toBe('3m 0s');
    expect(formatOpsEmailDeliveryDuration(3665)).toBe('1h 1m');
  });

  it('builds primary metrics, distribution, secondary metrics, and failure lists', () => {
    const model = buildOpsEmailSummaryMetricsModel(summary());

    expect(model.primaryMetrics).toMatchObject([
      {
        key: 'total',
        label: 'Total attempts',
        value: '20',
        filterStatus: null,
      },
      {
        key: 'delivered',
        value: '12',
        hint: '60% delivered',
        filterStatus: 'delivered',
      },
      {
        key: 'delayed',
        value: '3',
        filterStatus: 'delivery_delayed',
      },
      {
        key: 'failures',
        value: '3',
        hint: '15% failure rate',
      },
    ]);

    expect(model.distributionSummary).toContain('Delivered: 12');
    expect(
      model.distributionSegments.find((segment) => segment.status === 'delivered'),
    ).toMatchObject({
      count: 12,
      widthPercent: 60,
      title: 'Delivered: 12 (60%)',
      screenReaderText: 'Delivered: 12 of 20',
    });
    expect(model.secondaryMetrics.find((metric) => metric.key === 'p95DeliverySeconds')).toEqual({
      key: 'p95DeliverySeconds',
      label: 'p95 delivery time',
      value: '3m 0s',
      testId: 'email-metric-p95DeliverySeconds',
    });
    expect(model.failureLists[0]).toMatchObject({
      key: 'templates',
      title: 'Top failed templates',
      entries: [{ key: 'booking_confirmation', label: 'booking_confirmation', count: 2 }],
    });
  });

  it('normalizes unavailable counts and exposes stuck in-flight alert inputs', () => {
    const model = buildOpsEmailSummaryMetricsModel({
      ...summary(),
      total: -1,
      sent: Number.NaN,
      delivered: 0,
      deliveryDelayed: 0,
      bounced: 0,
      complained: 0,
      failed: 0,
      topFailedTemplates: [],
      topFailedEmailTypes: [],
      stuckInFlight: 2.9,
    });

    expect(model.total).toBe(0);
    expect(model.distributionSummary).toBe('No attempts');
    expect(model.stuckInFlight).toEqual({
      count: 2,
      thresholdHours: EMAIL_DELIVERY_STALE_THRESHOLD_HOURS,
    });
    expect(model.failureLists[0]?.entries).toEqual([]);
    expect(model.secondaryMetrics.find((metric) => metric.key === 'sent')?.value).toBe('0');
  });
});

function summary(): OpsEmailDeliverySummary {
  return {
    total: 20,
    sent: 2,
    delivered: 12,
    deliveryDelayed: 3,
    bounced: 1,
    complained: 1,
    failed: 1,
    deliveredRate: 0.6,
    failureRate: 0.15,
    uniqueRecipients: 14,
    uniqueBookings: 11,
    p50DeliverySeconds: 35,
    p95DeliverySeconds: 180,
    topFailedTemplates: [{ templateType: 'booking_confirmation', count: 2 }],
    topFailedEmailTypes: [{ emailType: 'confirmation', count: 2 }],
  };
}
