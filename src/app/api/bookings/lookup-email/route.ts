import { buildLookupEmailHttpResponse } from '@/server/bookings/lookup-email-response';

import type { NextRequest } from 'next/server';

/**
 * POST /api/bookings/lookup-email
 *
 * Emails a manage link for the requester's upcoming bookings at one venue to
 * the address stored on each booking. Always answers a neutral 202.
 */
export async function POST(req: NextRequest) {
  return buildLookupEmailHttpResponse(req);
}

export const dynamic = 'force-dynamic';
