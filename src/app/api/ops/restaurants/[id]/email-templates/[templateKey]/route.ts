import { NextResponse } from 'next/server';

import {
  restaurantEmailTemplateKeySchema,
  updateRestaurantEmailTemplateSchema,
  type RestaurantEmailTemplateResponse,
} from '@/app/api/ops/restaurants/schema';
import { apiError, validationError } from '@/lib/api/errors';
import { captureServerException } from '@/lib/posthog/server';
import {
  resetRestaurantEmailTemplate,
  upsertRestaurantEmailTemplate,
} from '@/server/restaurants/emailTemplates';

import { templateRouteFailure, unknownTemplateKey } from '../_errors';
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
    return apiError(400, 'INVALID_REQUEST', 'Missing restaurant id.');
  }

  const parsedTemplateKey = restaurantEmailTemplateKeySchema.safeParse(
    await resolveTemplateKeyParam(params),
  );
  if (!parsedTemplateKey.success) {
    return unknownTemplateKey();
  }

  const venueOrResponse = await ensureTemplateWriteAccess(restaurantId, req);
  if (venueOrResponse instanceof NextResponse) {
    return venueOrResponse;
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return apiError(400, 'INVALID_REQUEST', 'Invalid JSON body.');
  }

  const parsedBody = updateRestaurantEmailTemplateSchema.safeParse(body);
  if (!parsedBody.success) {
    return validationError(parsedBody.error);
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
    captureServerException(error, {
      groups: { restaurant: restaurantId },
      properties: { restaurantId, source: 'ops', kind: 'ops-email-templates' },
    });
    return templateRouteFailure(
      error,
      { operation: 'patch', restaurantId },
      "The template couldn't be saved. Try again.",
    );
  }
}

export async function DELETE(_req: NextRequest, { params }: RouteParams) {
  const restaurantId = await resolveRestaurantId(params);
  if (!restaurantId) {
    return apiError(400, 'INVALID_REQUEST', 'Missing restaurant id.');
  }

  const parsedTemplateKey = restaurantEmailTemplateKeySchema.safeParse(
    await resolveTemplateKeyParam(params),
  );
  if (!parsedTemplateKey.success) {
    return unknownTemplateKey();
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
    captureServerException(error, {
      groups: { restaurant: restaurantId },
      properties: { restaurantId, source: 'ops', kind: 'ops-email-templates' },
    });
    return templateRouteFailure(
      error,
      { operation: 'delete', restaurantId },
      "The template couldn't be reset. Try again.",
    );
  }
}
