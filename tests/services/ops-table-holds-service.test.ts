import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { HttpError } from '@/lib/http/errors';
import { CSRF_HEADER_NAME } from '@/lib/security/csrf';
import { releaseTableHold } from '@/services/ops/table-holds';

const RESTAURANT_ID = '11111111-1111-4111-8111-111111111111';
const HOLD_ID = '33333333-3333-4333-8333-333333333333';

function jsonResponse(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

describe('releaseTableHold service', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('sends a CSRF-protected DELETE to the restaurant-scoped hold route', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(200, { data: { holdId: HOLD_ID, released: true, alreadyReleased: false } }),
    );

    await expect(
      releaseTableHold({ restaurantId: RESTAURANT_ID, holdId: HOLD_ID }),
    ).resolves.toEqual({ holdId: HOLD_ID, released: true, alreadyReleased: false });

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(`/api/ops/tables/holds/${HOLD_ID}?restaurantId=${RESTAURANT_ID}`);
    expect(init.method).toBe('DELETE');
    expect(new Headers(init.headers).get(CSRF_HEADER_NAME)).toBeTruthy();
  });

  it('treats 404 HOLD_NOT_FOUND as already released', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(404, { error: 'gone', message: 'gone', code: 'HOLD_NOT_FOUND' }),
    );

    await expect(
      releaseTableHold({ restaurantId: RESTAURANT_ID, holdId: HOLD_ID }),
    ).resolves.toEqual({ holdId: HOLD_ID, released: true, alreadyReleased: true });
  });

  it('rethrows other failures as HttpError', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(403, { error: 'no', message: 'no', code: 'FORBIDDEN' }),
    );

    const failure = releaseTableHold({ restaurantId: RESTAURANT_ID, holdId: HOLD_ID });
    await expect(failure).rejects.toBeInstanceOf(HttpError);
    await expect(failure).rejects.toMatchObject({ status: 403, code: 'FORBIDDEN' });
  });
});
