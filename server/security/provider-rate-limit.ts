import { NextResponse } from 'next/server';

import { consumeRateLimit } from '@/server/security/rate-limit';

const PROVIDER_REFRESH_LIMIT = 6;
const PROVIDER_REFRESH_WINDOW_MS = 10 * 60 * 1000;

export async function requireProviderRefreshBudget(params: {
  provider: 'google_business_profile';
  restaurantId: string;
  action: string;
}): Promise<NextResponse | null> {
  try {
    const result = await consumeRateLimit({
      identifier: `provider:${params.provider}:${params.restaurantId}:${params.action}`,
      limit: PROVIDER_REFRESH_LIMIT,
      windowMs: PROVIDER_REFRESH_WINDOW_MS,
    });

    if (result.ok) {
      return null;
    }

    console.warn('[provider][rate-limit] request rejected', {
      provider: params.provider,
      restaurantId: params.restaurantId,
      action: params.action,
    });
    return NextResponse.json({ error: 'Too many provider refresh requests.' }, { status: 429 });
  } catch (error) {
    console.error('[provider][rate-limit] unavailable', {
      provider: params.provider,
      restaurantId: params.restaurantId,
      action: params.action,
      message: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: 'Provider refresh rate limit is unavailable.' }, { status: 503 });
  }
}
