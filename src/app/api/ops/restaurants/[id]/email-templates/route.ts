import { NextResponse } from 'next/server';

import { buildTemplateGroups, ensureTemplateReadAccess, resolveRestaurantId, type RouteParams } from './_shared';

import type { RestaurantEmailTemplatesResponse } from '../../schema';
import type { NextRequest } from 'next/server';

export async function GET(_req: NextRequest, { params }: RouteParams) {
  const restaurantId = await resolveRestaurantId(params);
  if (!restaurantId) {
    return NextResponse.json({ error: 'Missing restaurant id' }, { status: 400 });
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
