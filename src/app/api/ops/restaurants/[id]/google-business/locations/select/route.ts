import { NextResponse } from 'next/server';
import { z } from 'zod';

import {
  getGoogleBusinessProfileBusinessDetailsStatus,
  linkGoogleBusinessProfileLocation,
  syncGoogleBusinessProfileBusinessInformation,
} from '@/server/google-business-profile/service';

import {
  googleBusinessErrorResponse,
  requireGoogleBusinessAdminAccess,
  type RouteContext,
} from '../../_shared';

import type { NextRequest } from 'next/server';

const selectLocationSchema = z.object({
  accountName: z.string().min(1),
  accountId: z.string().min(1),
  locationName: z.string().min(1),
  locationId: z.string().min(1),
});

export async function POST(req: NextRequest, { params }: RouteContext) {
  const resolved = await requireGoogleBusinessAdminAccess(params);
  if (resolved instanceof NextResponse) {
    return resolved;
  }

  const parsed = selectLocationSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid payload', details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  try {
    await linkGoogleBusinessProfileLocation(resolved.restaurantId, parsed.data);
    await syncGoogleBusinessProfileBusinessInformation(resolved.restaurantId, undefined, {
      runKind: 'location_selection',
    });

    return NextResponse.json(
      await getGoogleBusinessProfileBusinessDetailsStatus(resolved.restaurantId),
    );
  } catch (error) {
    return googleBusinessErrorResponse(error, 'Unable to select Google Business Profile location.');
  }
}
