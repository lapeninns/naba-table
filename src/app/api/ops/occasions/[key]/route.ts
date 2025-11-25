import { NextResponse, type NextRequest } from 'next/server';

import { countOccasionReferences, fetchOccasionByKey, insertAudit, toAdminOccasion } from '@/server/occasions/admin';
import { getRouteHandlerSupabaseClient, getServiceSupabaseClient } from '@/server/supabase';

export async function PATCH(request: NextRequest, { params }: { params: { key: string } }) {
  const supabase = await getRouteHandlerSupabaseClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError) {
    console.error('[ops/occasions][PATCH] auth error', authError.message);
    return NextResponse.json({ error: 'Unable to verify session' }, { status: 500 });
  }
  if (!user) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  const key = params.key;
  const body = await request.json().catch(() => null);
  if (!body) {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  if (body.key && body.key !== key) {
    return NextResponse.json({ error: 'Key is immutable' }, { status: 400 });
  }

  const serviceClient = getServiceSupabaseClient();

  try {
    const existing = await fetchOccasionByKey(key, serviceClient);
    if (!existing || existing.deleted_at) {
      return NextResponse.json({ error: 'Occasion not found' }, { status: 404 });
    }

    const update: Record<string, unknown> = {};
    if (typeof body.label === 'string' && body.label.trim().length > 0) {
      update.label = body.label.trim();
    }
    if (typeof body.shortLabel === 'string' && body.shortLabel.trim().length > 0) {
      update.short_label = body.shortLabel.trim();
    }
    if ('description' in body) {
      update.description = typeof body.description === 'string' && body.description.trim().length > 0 ? body.description.trim() : null;
    }
    if ('isActive' in body) {
      update.is_active = Boolean(body.isActive);
    }
    if ('displayOrder' in body && typeof body.displayOrder === 'number' && Number.isFinite(body.displayOrder)) {
      update.display_order = body.displayOrder;
    }
    if ('defaultDurationMinutes' in body && typeof body.defaultDurationMinutes === 'number' && Number.isFinite(body.defaultDurationMinutes)) {
      update.default_duration_minutes = Math.max(1, Math.round(body.defaultDurationMinutes));
    }
    if ('availability' in body) {
      update.availability = Array.isArray(body.availability) ? body.availability : [];
    }

    update.updated_by = user.id;

    const { data, error } = await serviceClient
      .from('booking_occasions')
      .update(update)
      .eq('key', key)
      .select()
      .maybeSingle();

    if (error) {
      throw error;
    }

    await insertAudit({
      occasion_key: key,
      action: 'update',
      before_change: existing,
      after_change: data ?? null,
      changed_by: user.id,
    });

    const occasion = data ? toAdminOccasion(data as Parameters<typeof toAdminOccasion>[0]) : null;
    return NextResponse.json({ occasion });
  } catch (error) {
    console.error('[ops/occasions][PATCH] failed', error);
    return NextResponse.json({ error: 'Unable to update occasion' }, { status: 500 });
  }
}

export async function DELETE(_request: NextRequest, { params }: { params: { key: string } }) {
  const supabase = await getRouteHandlerSupabaseClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError) {
    console.error('[ops/occasions][DELETE] auth error', authError.message);
    return NextResponse.json({ error: 'Unable to verify session' }, { status: 500 });
  }
  if (!user) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  const key = params.key;
  const serviceClient = getServiceSupabaseClient();

  try {
    const existing = await fetchOccasionByKey(key, serviceClient);
    if (!existing || existing.deleted_at) {
      return NextResponse.json({ error: 'Occasion not found' }, { status: 404 });
    }
    if (existing.is_builtin) {
      return NextResponse.json({ error: 'Builtin occasions cannot be deleted' }, { status: 400 });
    }

    const refs = await countOccasionReferences(key, serviceClient);
    if (refs.futureBookings > 0 || refs.servicePeriods > 0) {
      return NextResponse.json(
        {
          error: 'Occasion is in use',
          details: {
            futureBookings: refs.futureBookings,
            servicePeriods: refs.servicePeriods,
          },
        },
        { status: 409 },
      );
    }

    const { data, error } = await serviceClient
      .from('booking_occasions')
      .update({ deleted_at: new Date().toISOString(), is_active: false, updated_by: user.id })
      .eq('key', key)
      .select()
      .maybeSingle();

    if (error) {
      throw error;
    }

    await insertAudit({
      occasion_key: key,
      action: 'delete',
      before_change: existing,
      after_change: data ?? null,
      changed_by: user.id,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[ops/occasions][DELETE] failed', error);
    return NextResponse.json({ error: 'Unable to delete occasion' }, { status: 500 });
  }
}
