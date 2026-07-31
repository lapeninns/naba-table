import { NextResponse } from 'next/server';

import {
  InternalServiceAuthError,
  verifyInternalServiceRequest,
} from '@/server/internal-service-auth';
import { listPresenceRestaurantCandidates } from '@/server/presence/projection';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    await verifyInternalServiceRequest(request);
    return NextResponse.json(
      { restaurants: await listPresenceRestaurantCandidates() },
      { headers: { 'cache-control': 'private, no-store' } },
    );
  } catch (error) {
    if (error instanceof InternalServiceAuthError) {
      return NextResponse.json(
        { error: 'Internal service authentication failed.' },
        { status: error.status },
      );
    }
    return NextResponse.json(
      { error: 'Unable to list presence restaurants.' },
      { status: 500 },
    );
  }
}
