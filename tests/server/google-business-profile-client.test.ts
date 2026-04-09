import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  fetchGoogleBusinessProfilePerformance,
  getGoogleBusinessProfileLocation,
  listGoogleBusinessProfileMedia,
  listGoogleBusinessProfileReviews,
} from '@/server/google-business-profile/client';

describe('getGoogleBusinessProfileLocation', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('retries with a reduced read mask when Google rejects the initial field set', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: false,
        json: async () => ({
          error: {
            message: 'Request contains an invalid argument.',
          },
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          name: 'locations/123',
          title: 'The Fox',
          websiteUri: 'https://thefox.example.com',
        }),
      });

    vi.stubGlobal('fetch', fetchMock);

    const location = await getGoogleBusinessProfileLocation('token', 'locations/123');

    expect(location).toMatchObject({
      name: 'locations/123',
      title: 'The Fox',
      websiteUri: 'https://thefox.example.com',
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);

    const firstUrl = new URL(fetchMock.mock.calls[0][0] as string | URL);
    const secondUrl = new URL(fetchMock.mock.calls[1][0] as string | URL);

    expect(firstUrl.searchParams.get('readMask')).toContain('serviceItems');
    expect(secondUrl.searchParams.get('readMask')).not.toContain('serviceItems');
    expect(secondUrl.searchParams.get('readMask')).toContain('metadata');
  });

  it('retries performance with a reduced metric set when Google rejects the broader request', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: false,
        json: async () => ({
          error: {
            message: 'Request contains an invalid argument.',
          },
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          multiDailyMetricTimeSeries: [
            {
              dailyMetricTimeSeries: [
                {
                  dailyMetric: 'WEBSITE_CLICKS',
                  timeSeries: {
                    datedValues: [{ date: { year: 2026, month: 4, day: 1 }, value: '9' }],
                  },
                },
              ],
            },
          ],
        }),
      });

    vi.stubGlobal('fetch', fetchMock);

    const response = await fetchGoogleBusinessProfilePerformance('token', 'locations/123');

    expect(response?.multiDailyMetricTimeSeries?.length).toBe(1);
    expect(fetchMock).toHaveBeenCalledTimes(2);

    const firstUrl = new URL(fetchMock.mock.calls[0][0] as string | URL);
    const secondUrl = new URL(fetchMock.mock.calls[1][0] as string | URL);

    expect(firstUrl.searchParams.getAll('dailyMetrics')).toContain('BUSINESS_IMPRESSIONS_DESKTOP_SEARCH');
    expect(secondUrl.searchParams.getAll('dailyMetrics')).toEqual([
      'WEBSITE_CLICKS',
      'CALL_CLICKS',
      'BUSINESS_DIRECTION_REQUESTS',
    ]);
  });

  it('paginates and caps review imports', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          reviews: Array.from({ length: 20 }, (_, index) => ({
            reviewId: `review-${index + 1}`,
          })),
          averageRating: 4.6,
          totalReviewCount: 88,
          nextPageToken: 'page-2',
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          reviews: Array.from({ length: 20 }, (_, index) => ({
            reviewId: `review-${index + 21}`,
          })),
        }),
      });

    vi.stubGlobal('fetch', fetchMock);

    const response = await listGoogleBusinessProfileReviews('token', 'accounts/123', '456');

    expect(response?.reviews).toHaveLength(25);
    expect(response?.averageRating).toBe(4.6);
    expect(fetchMock).toHaveBeenCalledTimes(2);

    const firstUrl = new URL(fetchMock.mock.calls[0][0] as string | URL);
    const secondUrl = new URL(fetchMock.mock.calls[1][0] as string | URL);

    expect(firstUrl.searchParams.get('pageSize')).toBe('50');
    expect(secondUrl.searchParams.get('pageToken')).toBe('page-2');
  });

  it('paginates and caps media imports', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          mediaItems: Array.from({ length: 15 }, (_, index) => ({
            name: `media-${index + 1}`,
          })),
          nextPageToken: 'page-2',
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          mediaItems: Array.from({ length: 15 }, (_, index) => ({
            name: `media-${index + 16}`,
          })),
        }),
      });

    vi.stubGlobal('fetch', fetchMock);

    const response = await listGoogleBusinessProfileMedia('token', 'accounts/123', '456');

    expect(response?.mediaItems).toHaveLength(24);
    expect(fetchMock).toHaveBeenCalledTimes(2);

    const firstUrl = new URL(fetchMock.mock.calls[0][0] as string | URL);
    expect(firstUrl.searchParams.get('pageSize')).toBe('100');
  });
});
