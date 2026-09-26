import { HttpError } from '@/lib/http/errors';
import { fetchJson } from '@/lib/http/fetchJson';

const OPS_TABLE_HOLDS_BASE = '/api/ops/tables/holds';

export type ReleaseTableHoldVariables = {
  restaurantId: string;
  holdId: string;
};

export type ReleaseTableHoldResult = {
  holdId: string;
  released: true;
  /** The hold had already ended (released, confirmed, expired or swept) before this request. */
  alreadyReleased: boolean;
};

/**
 * Releases a table hold for the restaurant (DELETE /api/ops/tables/holds/[holdId]). Uses fetchJson
 * so the CSRF header is sent. A 404 HOLD_NOT_FOUND means the hold is already gone (swept, confirmed
 * or released by someone else), which is what the caller wanted, so it resolves as already released.
 */
export async function releaseTableHold({
  restaurantId,
  holdId,
}: ReleaseTableHoldVariables): Promise<ReleaseTableHoldResult> {
  const search = new URLSearchParams({ restaurantId });
  try {
    const response = await fetchJson<{ data: ReleaseTableHoldResult }>(
      `${OPS_TABLE_HOLDS_BASE}/${encodeURIComponent(holdId)}?${search.toString()}`,
      { method: 'DELETE' },
    );
    return response.data;
  } catch (error) {
    if (error instanceof HttpError && error.status === 404 && error.code === 'HOLD_NOT_FOUND') {
      return { holdId, released: true, alreadyReleased: true };
    }
    throw error;
  }
}
