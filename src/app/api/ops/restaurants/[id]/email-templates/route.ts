import { NextResponse } from 'next/server';

import { apiError } from '@/lib/api/errors';

import {
  buildTemplateGroups,
  ensureTemplateReadAccess,
  resolveRestaurantId,
  type RouteParams,
} from './_shared';

import type { RestaurantEmailTemplatesResponse } from '../../schema';
import type { NextRequest } from 'next/server';

export async function GET(_req: NextRequest, { params }: RouteParams) {
  const restaurantId = await resolveRestaurantId(params);
  if (!restaurantId) {
    return apiError(400, 'INVALID_REQUEST', 'Missing restaurant id.');
  }

  const access = await ensureTemplateReadAccess(restaurantId);
  if (access instanceof NextResponse) {
    return access;
  }

  const response: RestaurantEmailTemplatesResponse = {
    restaurantId,
    canEdit: access.canEdit,
    groups: buildTemplateGroups(access.venue),
  };

  return NextResponse.json(response);
}
