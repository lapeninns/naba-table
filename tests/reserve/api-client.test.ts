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
});
