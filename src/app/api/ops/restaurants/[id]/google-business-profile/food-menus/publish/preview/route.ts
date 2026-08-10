import { POST as previewExactConsent } from '@/app/api/ops/restaurants/[id]/dual-sync/publish/preview/route';
import { gbpNoStoreResponse } from '@/server/dual-sync/retention/privacy';

import type { NextRequest } from 'next/server';

type RouteContext = {
  params: Promise<{ id: string | string[] }>;
};

export async function POST(request: NextRequest, context: RouteContext) {
  return gbpNoStoreResponse(await previewExactConsent(request, context));
}

export const runtime = 'nodejs';
