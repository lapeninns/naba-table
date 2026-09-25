import { NextResponse } from 'next/server';

import {
  restaurantEmailTemplateKeySchema,
  updateRestaurantEmailTemplateSchema,
  type RestaurantEmailTemplateResponse,
} from '@/app/api/ops/restaurants/schema';
import { logger } from '@/lib/logger';
import { captureServerException } from '@/lib/posthog/server';
import {
  resetRestaurantEmailTemplate,
  upsertRestaurantEmailTemplate,
} from '@/server/restaurants/emailTemplates';

import {
  buildTemplateDto,
  ensureTemplateWriteAccess,
  resolveRestaurantId,
  resolveTemplateKeyParam,
  type RouteParams,
} from '../_shared';

import type { NextRequest } from 'next/server';

export async function PATCH(req: NextRequest, { params }: RouteParams) {
  const restaurantId = await resolveRestaurantId(params);
  if (!restaurantId) {
    return NextResponse.json({ error: 'Missing restaurant id' }, { status: 400 });
  }

  const parsedTemplateKey = restaurantEmailTemplateKeySchema.safeParse(
    await resolveTemplateKeyParam(params),
  );
  if (!parsedTemplateKey.success) {
    return NextResponse.json({ error: 'Unknown template key' }, { status: 400 });
  }

  const venueOrResponse = await ensureTemplateWriteAccess(restaurantId, req);
  if (venueOrResponse instanceof NextResponse) {
    return venueOrResponse;
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const parsedBody = updateRestaurantEmailTemplateSchema.safeParse(body);
  if (!parsedBody.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsedBody.error.flatten() },
      { status: 400 },
    );
  }

  try {
    const updatedVenue = await upsertRestaurantEmailTemplate({
      restaurantId,
      templateKey: parsedTemplateKey.data,
      variants: parsedBody.data.variants,
    });

    const response: RestaurantEmailTemplateResponse = {
      restaurantId,
      canEdit: true,
      template: buildTemplateDto(updatedVenue, parsedTemplateKey.data),
    };

    return NextResponse.json(response);
  } catch (error) {
    logger.error('ops.restaurants.email-templates.patch failed', {
      route: 'ops.restaurants.email-templates',
      restaurantId,
      errorName: error instanceof Error ? error.name : 'UnknownError',
    });
    captureServerException(error, {
      groups: { restaurant: restaurantId },
      properties: { restaurantId, source: 'ops', kind: 'ops-email-templates' },
    });
    return NextResponse.json(
      { error: 'Unable to save template.', code: 'INTERNAL_ERROR' },
      { status: 500 },
    );
  }
}

export async function DELETE(_req: NextRequest, { params }: RouteParams) {
  const restaurantId = await resolveRestaurantId(params);
  if (!restaurantId) {
    return NextResponse.json({ error: 'Missing restaurant id' }, { status: 400 });
  }

  const parsedTemplateKey = restaurantEmailTemplateKeySchema.safeParse(
    await resolveTemplateKeyParam(params),
  );
  if (!parsedTemplateKey.success) {
    return NextResponse.json({ error: 'Unknown template key' }, { status: 400 });
  }

  const venueOrResponse = await ensureTemplateWriteAccess(restaurantId, _req);
  if (venueOrResponse instanceof NextResponse) {
    return venueOrResponse;
  }

  try {
    const updatedVenue = await resetRestaurantEmailTemplate(restaurantId, parsedTemplateKey.data);
    const response: RestaurantEmailTemplateResponse = {
      restaurantId,
      canEdit: true,
      template: buildTemplateDto(updatedVenue, parsedTemplateKey.data),
    };

    return NextResponse.json(response);
  } catch (error) {
    logger.error('ops.restaurants.email-templates.delete failed', {
      route: 'ops.restaurants.email-templates',
      restaurantId,
      errorName: error instanceof Error ? error.name : 'UnknownError',
    });
    captureServerException(error, {
      groups: { restaurant: restaurantId },
      properties: { restaurantId, source: 'ops', kind: 'ops-email-templates' },
    });
    return NextResponse.json(
      { error: 'Unable to reset template.', code: 'INTERNAL_ERROR' },
      { status: 500 },
    );
  }
}
