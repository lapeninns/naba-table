// TODO(gbp-ia-audit-20260502-1201): Orphan route handler with no client caller after the F-10 hook deletions; decide whether to delete or rewire it.
import { gbpNoStoreJson } from '@/server/dual-sync/retention/privacy';

import type { NextRequest } from 'next/server';

type RouteContext = {
  params: Promise<{
    id: string | string[];
    draftId: string | string[];
    jobId: string | string[];
  }>;
};

export function POST(_request: NextRequest, _context: RouteContext) {
  return gbpNoStoreJson(
    {
      error: 'Legacy Google Business Profile writes are retired.',
      code: 'GBP_LEGACY_GOOGLE_WRITE_RETIRED',
    },
    { status: 410 },
  );
}

export const runtime = 'nodejs';
