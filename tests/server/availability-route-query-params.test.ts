import { beforeEach, describe, expect, it, vi } from 'vitest';

import { GET } from '@/app/api/availability/route';

import { NextRequest } from 'next/server';

const checkSlotAvailabilityMock = vi.hoisted(() => vi.fn());
const findAlternativeSlotsMock = vi.hoisted(() => vi.fn());
const getActiveRestaurantIdMock = vi.hoisted(() => vi.fn());
const requireApiRateLimitMock = vi.hoisted(() => vi.fn());
const recordObservabilityEventMock = vi.hoisted(() => vi.fn());

vi.mock('@/server/capacity', () => ({
  checkSlotAvailability: checkSlotAvailabilityMock,
  findAlternativeSlots: findAlternativeSlotsMock,
}));

vi.mock('@/server/restaurants/getActiveRestaurantId', () => ({
  getActiveRestaurantId: getActiveRestaurantIdMock,
}));

vi.mock('@/server/security/api-rate-limit', () => ({
  requireApiRateLimit: requireApiRateLimitMock,
}));

vi.mock('@/server/security/request', () => ({
  anonymizeIp: (ip: string | null) => ip ?? 'unknown',
  extractClientIp: () => '203.0.113.10',
}));

vi.mock('@/server/observability', () => ({
  recordObservabilityEvent: recordObservabilityEventMock,
}));

vi.mock('@/server/supabase', () => ({
  MissingRestaurantContextError: class MissingRestaurantContextError extends Error {},
  getDefaultRestaurantId: vi.fn(),
}));

describe('availability route query params', () => {
  beforeEach(() => {
    checkSlotAvailabilityMock.mockReset();
    findAlternativeSlotsMock.mockReset();
    getActiveRestaurantIdMock.mockReset();
    requireApiRateLimitMock.mockReset();
    recordObservabilityEventMock.mockReset();

    getActiveRestaurantIdMock.mockResolvedValue('11111111-1111-4111-8111-111111111111');
    requireApiRateLimitMock.mockResolvedValue(null);
    checkSlotAvailabilityMock.mockResolvedValue({
      available: false,
      reason: 'Full',
      metadata: {
        servicePeriod: 'Dinner',
        maxCovers: 20,
        bookedCovers: 20,
        availableCovers: 0,
        utilizationPercent: 100,
        maxParties: 10,
        bookedParties: 10,
      },
    });
    findAlternativeSlotsMock.mockResolvedValue([
      { time: '19:30', available: true, utilizationPercent: 50 },
    ]);
  });

  it('does not request alternatives when includeAlternatives=false', async () => {
    const req = new NextRequest(
      'http://localhost/api/availability?restaurantId=11111111-1111-4111-8111-111111111111&date=2026-05-16&time=19:00&partySize=2&includeAlternatives=false',
    );

    const response = await GET(req);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(findAlternativeSlotsMock).not.toHaveBeenCalled();
    expect(body.alternatives).toBeUndefined();
  });

  it('keeps public availability responses free of exact capacity metrics', async () => {
    const req = new NextRequest(
      'http://localhost/api/availability?restaurantId=11111111-1111-4111-8111-111111111111&date=2026-05-16&time=19:00&partySize=2&includeAlternatives=true',
    );

    const response = await GET(req);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(response.headers.get('X-Utilization')).toBeNull();
    expect(body.metadata).toEqual({ servicePeriod: 'Dinner' });
    expect(body.metadata).not.toHaveProperty('maxCovers');
    expect(body.metadata).not.toHaveProperty('bookedCovers');
    expect(body.metadata).not.toHaveProperty('availableCovers');
    expect(body.metadata).not.toHaveProperty('utilizationPercent');
    expect(body.metadata).not.toHaveProperty('maxParties');
    expect(body.metadata).not.toHaveProperty('bookedParties');
    expect(body.alternatives).toEqual([{ time: '19:30', available: true }]);
  });
});
