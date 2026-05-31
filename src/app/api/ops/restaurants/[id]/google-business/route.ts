import { NextResponse } from 'next/server';

import {
  disconnectGoogleBusinessProfileConnection,
  getGoogleBusinessProfileBusinessDetailsStatus,
} from '@/server/google-business-profile/service';

import {
  googleBusinessErrorResponse,
  requireGoogleBusinessAdminAccess,
  type RouteContext,
} from './_shared';

import type { NextRequest } from 'next/server';

export async function GET(_req: NextRequest, { params }: RouteContext) {
  const resolved = await requireGoogleBusinessAdminAccess(params);
  if (resolved instanceof NextResponse) {
    return resolved;
  }

  try {
    return NextResponse.json(
      await getGoogleBusinessProfileBusinessDetailsStatus(resolved.restaurantId),
    );
  } catch (error) {
    return googleBusinessErrorResponse(
      error,
      'Unable to load Google Business Profile business details.',
    );
  }
}

export async function DELETE(_req: NextRequest, { params }: RouteContext) {
  const resolved = await requireGoogleBusinessAdminAccess(params, _req);
  if (resolved instanceof NextResponse) {
    return resolved;
  }

  try {
    await disconnectGoogleBusinessProfileConnection(resolved.restaurantId);
    return NextResponse.json(
      await getGoogleBusinessProfileBusinessDetailsStatus(resolved.restaurantId),
    );
  } catch (error) {
    return googleBusinessErrorResponse(error, 'Unable to disconnect Google Business Profile.');
  }
}
