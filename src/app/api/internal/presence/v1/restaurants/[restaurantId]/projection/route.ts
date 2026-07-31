import { NextResponse } from 'next/server';
import { z } from 'zod';

import {
  InternalServiceAuthError,
  verifyInternalServiceRequest,
} from '@/server/internal-service-auth';
import { getVenuePresenceProjection } from '@/server/presence/projection';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ restaurantId: string }> },
) {
  try {
    await verifyInternalServiceRequest(request);
    const { restaurantId: rawRestaurantId } = await params;
    const restaurantId = z.string().uuid().parse(rawRestaurantId);
    const { projection, etag } =
      await getVenuePresenceProjection(restaurantId);
    if (request.headers.get('if-none-match') === etag) {
      return new NextResponse(null, {
        status: 304,
        headers: { etag, 'cache-control': 'private, no-store' },
      });
    }
    return NextResponse.json(projection, {
      headers: { etag, 'cache-control': 'private, no-store' },
    });
  } catch (error) {
    if (error instanceof InternalServiceAuthError) {
      return NextResponse.json(
        { error: 'Internal service authentication failed.' },
        { status: error.status },
      );
    }
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Restaurant identifier is invalid.' },
        { status: 400 },
      );
    }
    if (error instanceof Error && error.message === 'Restaurant not found') {
      return NextResponse.json(
        { error: 'Restaurant not found.' },
        { status: 404 },
      );
    }
    return NextResponse.json(
      { error: 'Unable to build the presence projection.' },
      { status: 500 },
    );
  }
}
