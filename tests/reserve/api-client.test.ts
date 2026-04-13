import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const fetchMock = vi.fn();

describe('apiClient', () => {
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock as unknown as typeof fetch);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  it('preserves server error payload text when message is returned as error', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          code: 'DUPLICATE_RESOURCE',
          error: 'We already have a booking with those details.',
        }),
        {
          status: 409,
          headers: { 'content-type': 'application/json' },
        },
      ),
    );

    const { apiClient } = await import('@reserve/shared/api/client');

    await expect(apiClient.post('/bookings', {})).rejects.toMatchObject({
      code: 'DUPLICATE_RESOURCE',
      message: 'We already have a booking with those details.',
      status: 409,
    });
  });

  it('preserves the full server error body for alternative slot handling', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          code: 'CAPACITY_EXCEEDED',
          message: 'No capacity available for 19:00.',
          alternatives: [
            { time: '18:30', available: true, utilizationPercent: 72 },
            { time: '20:00', available: true, utilizationPercent: 61 },
          ],
          retryable: true,
          retryAfter: 1,
        }),
        {
          status: 409,
          headers: { 'content-type': 'application/json' },
        },
      ),
    );

    const { apiClient } = await import('@reserve/shared/api/client');

    await expect(apiClient.post('/bookings', {})).rejects.toMatchObject({
      code: 'CAPACITY_EXCEEDED',
      message: 'No capacity available for 19:00.',
      status: 409,
      body: expect.objectContaining({
        alternatives: [
          { time: '18:30', available: true, utilizationPercent: 72 },
          { time: '20:00', available: true, utilizationPercent: 61 },
        ],
        retryable: true,
        retryAfter: 1,
      }),
    });
  });
});
