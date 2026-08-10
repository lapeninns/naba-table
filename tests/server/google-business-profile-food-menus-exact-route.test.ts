import { NextRequest, NextResponse } from 'next/server';
import { describe, expect, it, vi } from 'vitest';

const canonicalPublish = vi.hoisted(() => vi.fn());

vi.mock('@/app/api/ops/restaurants/[id]/dual-sync/publish/route', () => ({
  POST: canonicalPublish,
}));

import { POST } from '@/src/app/api/ops/restaurants/[id]/google-business-profile/food-menus/publish/route';

describe('FoodMenus exact-consent route', () => {
  it('delegates only an exact-consent confirmation to the canonical permit-aware route', async () => {
    canonicalPublish.mockResolvedValue(
      NextResponse.json({ mode: 'immediate', outcomes: [{ status: 'consumed' }] }),
    );
    const request = new NextRequest(
      'https://example.com/api/ops/restaurants/rest-1/google-business-profile/food-menus/publish',
      {
        method: 'POST',
        body: JSON.stringify({
          confirmationVersion: 'gbp-exact-consent-v1',
          acknowledged: true,
          riskAcknowledgements: ['destructive_full_replacement'],
        }),
      },
    );
    const context = { params: Promise.resolve({ id: 'rest-1' }) };

    const response = await POST(request, context);

    expect(response.status).toBe(200);
    expect(canonicalPublish).toHaveBeenCalledTimes(1);
    expect(canonicalPublish).toHaveBeenCalledWith(request, context);
  });

  it('keeps legacy and validate-only bypass payloads retired', async () => {
    const response = await POST(
      new NextRequest(
        'https://example.com/api/ops/restaurants/rest-1/google-business-profile/food-menus/publish',
        { method: 'POST', body: JSON.stringify({ validateOnly: true }) },
      ),
      { params: Promise.resolve({ id: 'rest-1' }) },
    );

    expect(response.status).toBe(410);
    expect(canonicalPublish).not.toHaveBeenCalled();
    expect(response.headers.get('cache-control')).toBe('private, no-store, max-age=0');
  });
});
