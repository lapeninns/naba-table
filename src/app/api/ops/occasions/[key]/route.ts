import { NextResponse, type NextRequest } from 'next/server';

import { apiError, conflict, internalError, notFound, validationError } from '@/lib/api/errors';
import { captureServerException } from '@/lib/posthog/server';
import { withPlatformAdminAuthorization } from '@/server/auth/guards';
import {
  countOccasionReferences,
  fetchOccasionByKey,
  insertAudit,
  toAdminOccasion,
} from '@/server/occasions/admin';
import { updateOccasionBodySchema } from '@/server/occasions/adminSchemas';
import { clearOccasionCatalogCache } from '@/server/occasions/catalog';
import { getServiceSupabaseClient } from '@/server/supabase';

import type { Json } from '@/types/supabase';

const ROUTE = 'ops.occasions.key';

function occasionNotFound() {
  return notFound('OCCASION_NOT_FOUND', 'This booking type no longer exists.');
}

/** Updates a global booking type. Platform administrators only. */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ key: string }> },
) {
  const { key } = await params;
  const authorization = await withPlatformAdminAuthorization(request, { csrf: true });
  if (!authorization.ok) {
    return authorization.response;
  }

  const body: unknown = await request.json().catch(() => null);
  if (body === null) {
    return apiError(400, 'INVALID_JSON', 'The request body must be JSON.');
  }
  const parsed = updateOccasionBodySchema.safeParse(body);
  if (!parsed.success) {
    return validationError(parsed.error);
  }
  const input = parsed.data;
  if (input.key !== undefined && input.key !== key) {
    return apiError(400, 'OCCASION_KEY_IMMUTABLE', 'A booking type’s key cannot be changed.');
  }

  const serviceClient = getServiceSupabaseClient();

  try {
    const existing = await fetchOccasionByKey(key, serviceClient);
    if (!existing || existing.deleted_at) {
      return occasionNotFound();
    }

    const update: {
      label?: string;
      short_label?: string;
      description?: string | null;
      is_active?: boolean;
      display_order?: number;
      default_duration_minutes?: number;
      availability?: Json;
      updated_by: string;
    } = { updated_by: authorization.user.id };
    if (input.label !== undefined) update.label = input.label;
    if (input.shortLabel !== undefined && input.shortLabel.length > 0) {
      update.short_label = input.shortLabel;
    }
    if (input.description !== undefined) {
      update.description =
        input.description && input.description.length > 0 ? input.description : null;
    }
    if (input.isActive !== undefined) update.is_active = input.isActive;
    if (input.displayOrder !== undefined) update.display_order = input.displayOrder;
    if (input.defaultDurationMinutes !== undefined) {
      update.default_duration_minutes = input.defaultDurationMinutes;
    }
    if (input.availability !== undefined) update.availability = input.availability as Json;

    const { data, error } = await serviceClient
      .from('booking_occasions')
      .update(update)
      .eq('key', key)
      .is('deleted_at', null)
      .select()
      .maybeSingle();

    if (error) {
      throw error;
    }
    if (!data) {
      // Deleted between the read and the write.
      return occasionNotFound();
    }

    await insertAudit({
      occasion_key: key,
      action: 'update',
      before_change: existing as unknown as Json,
      after_change: data as unknown as Json,
      changed_by: authorization.user.id,
    });

    clearOccasionCatalogCache();
    return NextResponse.json({
      occasion: toAdminOccasion(data as Parameters<typeof toAdminOccasion>[0]),
    });
  } catch (error) {
    captureServerException(error, {
      properties: { source: 'ops', kind: 'ops-occasion' },
    });
    return internalError(error, { route: ROUTE, method: 'PATCH' });
  }
}

/**
 * Soft-deletes a global booking type. Platform administrators only. Refused for built-in types
 * and while any restaurant still has upcoming bookings or meal times that use it.
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ key: string }> },
) {
  const { key } = await params;
  const authorization = await withPlatformAdminAuthorization(request, { csrf: true });
  if (!authorization.ok) {
    return authorization.response;
  }

  const serviceClient = getServiceSupabaseClient();

  try {
    const existing = await fetchOccasionByKey(key, serviceClient);
    if (!existing || existing.deleted_at) {
      return occasionNotFound();
    }
    if (existing.is_builtin) {
      return apiError(
        400,
        'OCCASION_BUILTIN',
        'Lunch and Dinner are built in and cannot be removed. Turn them off instead.',
      );
    }

    const refs = await countOccasionReferences(key, serviceClient);
    if (refs.futureBookings > 0 || refs.servicePeriods > 0) {
      return conflict(
        'OCCASION_IN_USE',
        'This booking type is still used by upcoming bookings or meal times, so it cannot be removed. Turn it off instead.',
        {
          details: {
            futureBookings: refs.futureBookings,
            servicePeriods: refs.servicePeriods,
          },
        },
      );
    }

    const { data, error } = await serviceClient
      .from('booking_occasions')
      .update({
        deleted_at: new Date().toISOString(),
        is_active: false,
        updated_by: authorization.user.id,
      })
      .eq('key', key)
      .is('deleted_at', null)
      .select()
      .maybeSingle();

    if (error) {
      throw error;
    }
    if (!data) {
      return occasionNotFound();
    }

    await insertAudit({
      occasion_key: key,
      action: 'delete',
      before_change: existing as unknown as Json,
      after_change: data as unknown as Json,
      changed_by: authorization.user.id,
    });

    clearOccasionCatalogCache();
    return NextResponse.json({ success: true });
  } catch (error) {
    captureServerException(error, {
      distinctId: authorization.user.id,
      properties: { source: 'ops', kind: 'ops-occasion' },
    });
    return internalError(error, { route: ROUTE, method: 'DELETE' });
  }
}
