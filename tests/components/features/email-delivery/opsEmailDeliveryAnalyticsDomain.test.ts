import { describe, expect, it } from 'vitest';

import {
  buildOpsEmailDeliveryAnalyticsModel,
  isOpsEmailDeliveryAnalyticsRange,
  OPS_EMAIL_DELIVERY_ANALYTICS_RANGE_OPTIONS,
} from '@/components/features/email-delivery/opsEmailDeliveryAnalyticsDomain';

import type { OpsEmailDeliverySummary } from '@/types/emailDelivery';

describe('opsEmailDeliveryAnalyticsDomain', () => {
  it('defines and validates supported analytics ranges', () => {
    expect(OPS_EMAIL_DELIVERY_ANALYTICS_RANGE_OPTIONS).toEqual(['24h', '7d', '30d']);
    expect(isOpsEmailDeliveryAnalyticsRange('24h')).toBe(true);
    expect(isOpsEmailDeliveryAnalyticsRange('90d')).toBe(false);
  });

  it('builds analytics tiles, distribution segments, secondary metrics, and failure sections', () => {
    const model = buildOpsEmailDeliveryAnalyticsModel(summary());

    expect(model.total).toBe(20);
    expect(model.primaryTiles).toMatchObject([
      {
        key: 'total',
        label: 'Total Attempts',
        value: '20',
      },
      {
        key: 'delivered',
        label: 'Delivered',
        value: '12',
        hint: '60% delivery rate',
      },
      {
        key: 'delayed',
        value: '3',
      },
      {
        key: 'failures',
        value: '3',
        hint: '15% failure rate',
      },
    ]);
    expect(model.distributionSegments.find((segment) => segment.key === 'delivered')).toMatchObject(
      {
        label: 'Delivered',
        count: 12,
        widthPercent: 60,
        title: 'Delivered: 12',
      },
    );
    expect(model.secondaryMetrics).toContainEqual({
      key: 'p95DeliverySeconds',
      label: 'p95 delivery time',
      value: '3m 0s',
      testId: 'analytics-p95',
    });
    expect(model.failureSections[0]).toMatchObject({
      key: 'templates',
      title: 'Top failed templates',
      entries: [{ key: 'booking_confirmation', label: 'booking_confirmation', count: 2 }],
    });
  });

  it('keeps all distribution segments for empty data and normalizes invalid counts', () => {
    const model = buildOpsEmailDeliveryAnalyticsModel({
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
    });

    expect(model.total).toBe(0);
    expect(model.primaryTiles.find((tile) => tile.key === 'total')?.value).toBe('0');
    expect(model.distributionSegments).toHaveLength(5);
    expect(model.distributionSegments.every((segment) => segment.widthPercent === 0)).toBe(true);
    expect(model.failureSections[0]?.entries).toEqual([]);
    expect(model.secondaryMetrics.find((metric) => metric.key === 'uniqueRecipients')?.value).toBe(
      '14',
    );
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
