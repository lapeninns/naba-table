import { POST as publishExactConsent } from '@/app/api/ops/restaurants/[id]/dual-sync/publish/route';
import { EXACT_CONSENT_VERSION } from '@/server/dual-sync/publish/exact-consent';
import { gbpNoStoreJson, gbpNoStoreResponse } from '@/server/dual-sync/retention/privacy';

import type { NextRequest } from 'next/server';

type RouteContext = {
  params: Promise<{ id: string | string[] }>;
};

export async function POST(request: NextRequest, context: RouteContext) {
  const body = (await request
    .clone()
    .json()
    .catch(() => null)) as unknown;
  if (
    body !== null &&
    typeof body === 'object' &&
    'confirmationVersion' in body &&
    body.confirmationVersion === EXACT_CONSENT_VERSION
  ) {
    return gbpNoStoreResponse(await publishExactConsent(request, context));
  }
  return gbpNoStoreJson(
    {
      error: 'Google FoodMenus publishing requires an explicit write authorization.',
      code: 'GBP_WRITE_AUTHORIZATION_REQUIRED',
      retryable: false,
    },
    { status: 410, headers: { 'Cache-Control': 'private, no-store, max-age=0' } },
  );
}

export const runtime = 'nodejs';
