import { describe, expect, it, vi } from 'vitest';

import { reconcileReviewMessageCostsWithDependencies } from '@/server/reviews/cost-reconciler';

describe('review message cost reconciliation', () => {
  it('records Twilio absolute settled price in provider currency without contact data', async () => {
    const recordCost = vi.fn(async () => undefined);
    const markSettled = vi.fn(async () => undefined);

    const result = await reconcileReviewMessageCostsWithDependencies({
      listCandidates: vi.fn(async () => [
        {
          attemptId: 'attempt-1',
          providerMessageId: 'SM123',
          restaurantId: 'restaurant-1',
          reviewRequestId: 'review-1',
        },
      ]),
      fetchMessage: vi.fn(async () => ({ price: '-0.0475', priceUnit: 'GBP' })),
      recordCost,
      markSettled,
    });

    expect(result).toEqual({ scanned: 1, settled: 1, pending: 0, failed: 0 });
    expect(recordCost).toHaveBeenCalledWith({
      costMicrounits: 47_500,
      currency: 'GBP',
      providerMessageId: 'SM123',
      restaurantId: 'restaurant-1',
      reviewRequestId: 'review-1',
    });
    expect(JSON.stringify(recordCost.mock.calls)).not.toMatch(/email|phone|recipient/i);
  });

  it('leaves messages pending until Twilio exposes a final price', async () => {
    const result = await reconcileReviewMessageCostsWithDependencies({
      listCandidates: vi.fn(async () => [
        {
          attemptId: 'attempt-1',
          providerMessageId: 'SM123',
          restaurantId: 'restaurant-1',
          reviewRequestId: 'review-1',
        },
      ]),
      fetchMessage: vi.fn(async () => ({ price: null, priceUnit: null })),
      recordCost: vi.fn(),
      markSettled: vi.fn(),
    });

    expect(result.pending).toBe(1);
    expect(result.settled).toBe(0);
  });
});
