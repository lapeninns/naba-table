import { describe, expect, it } from 'vitest';

import { getRejectionAnalytics } from '@/server/ops/rejections';

type MockQueryBuilder = {
  select: () => MockQueryBuilder;
  eq: () => MockQueryBuilder;
  gte: () => MockQueryBuilder;
  lte: () => MockQueryBuilder;
  order: () => MockQueryBuilder;
  limit: (value: number) => Promise<{ data: any[]; error: null }>; // eslint-disable-line @typescript-eslint/no-explicit-any
};

function createMockSupabaseClient(rows: any[]): any { // eslint-disable-line @typescript-eslint/no-explicit-any
  const builder: MockQueryBuilder = {
    select: () => builder,
    eq: () => builder,
    gte: () => builder,
    lte: () => builder,
    order: () => builder,
    limit: async () => ({ data: rows, error: null }),
  };

  return {
    from: () => builder,
  };
}

describe('getRejectionAnalytics', () => {
  it('aggregates hard and strategic rejections with telemetry metadata', async () => {
    const mockRows = [
      {
        id: 'evt-1',
        created_at: '2025-10-31T18:15:00Z',
        booking_id: 'booking-1',
        context: {
          skipReason: 'No suitable tables available (capacity)',
          rejectionClassification: 'strategic',
          strategicPenalties: {
            slack: 120,
            scarcity: 80,
            futureConflict: 0,
            dominant: 'slack',
          },
          plannerConfig: { weights: { scarcity: 22 } },
        },
      },
      {
        id: 'evt-2',
        created_at: '2025-10-31T19:15:00Z',
        booking_id: 'booking-2',
        context: {
          skipReason: 'Reservation window exceeds service boundary',
          rejectionClassification: 'hard',
        },
      },
      {
        id: 'evt-3',
        created_at: '2025-10-31T19:45:00Z',
        booking_id: 'booking-3',
        context: {
          skipReason: 'Conflicts with existing holds',
          strategicPenalties: {
            slack: 0,
            scarcity: 0,
            futureConflict: 150,
            dominant: 'future_conflict',
          },
        },
      },
    ];

    const client = createMockSupabaseClient(mockRows);

    const analytics = await getRejectionAnalytics('rest-123', {
      client,
      from: '2025-10-31T00:00:00Z',
      to: '2025-11-01T00:00:00Z',
      bucket: 'day',
    });

    expect(analytics.restaurantId).toBe('rest-123');
    expect(analytics.summary.total).toBe(3);
    expect(analytics.summary.hard.count).toBe(1);
    expect(analytics.summary.strategic.count).toBe(2);
    expect(analytics.summary.strategic.topPenalties[0]).toEqual({ penalty: 'slack', count: 1 });
    expect(analytics.summary.strategic.topPenalties[1]).toEqual({ penalty: 'future_conflict', count: 1 });
    expect(analytics.series).toHaveLength(1);
    expect(analytics.series[0]?.strategic).toBe(2);
    expect(analytics.strategicSamples.length).toBe(2);
    expect(analytics.strategicSamples[0]?.dominantPenalty).toMatch(/slack|future_conflict/);
  });

  it('falls back to strategic classification when skip reason implies strategic rejection', async () => {
    const mockRows = [
      {
        id: 'evt-4',
        created_at: '2025-11-01T12:00:00Z',
        booking_id: 'booking-4',
        context: {
          skipReason: 'Conflicts with existing assignment',
        },
      },
    ];

    const client = createMockSupabaseClient(mockRows);

    const analytics = await getRejectionAnalytics('rest-456', {
      client,
      from: '2025-11-01T00:00:00Z',
      to: '2025-11-02T00:00:00Z',
      bucket: 'hour',
    });

    expect(analytics.summary.total).toBe(1);
    expect(analytics.summary.strategic.count).toBe(1);
    expect(analytics.summary.hard.count).toBe(0);
  });
});
