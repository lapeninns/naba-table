import { NextResponse, type NextRequest } from 'next/server';

import { withPlatformAdminAuthorization } from '@/server/auth/guards';
import { mapSupabaseAuthError } from '@/server/auth/supabase-auth-errors';
import { fetchAllOccasions, insertAudit, toAdminOccasion } from '@/server/occasions/admin';
import { getRouteHandlerSupabaseClient, getServiceSupabaseClient } from '@/server/supabase';

export async function GET() {
  const supabase = await getRouteHandlerSupabaseClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError) {
    console.error('[ops/occasions][GET] failed to resolve auth', authError.message);
    const mapped = mapSupabaseAuthError(authError);
    return NextResponse.json(
      { error: mapped.message, code: mapped.code },
      { status: mapped.status },
    );
  }

  if (!user) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  try {
    const occasions = await fetchAllOccasions();
    return NextResponse.json({ occasions });
  } catch (error) {
    console.error('[ops/occasions][GET] failed to load occasions', error);
    return NextResponse.json({ error: 'Unable to load occasions' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const authorization = await withPlatformAdminAuthorization(request, { csrf: true });
  if (!authorization.ok) {
    return authorization.response;
  }

  const body = await request.json().catch(() => null);
  if (!body) {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const {
    key,
    label,
    shortLabel,
    description = null,
    availability = [],
    defaultDurationMinutes = 90,
    displayOrder,
    isActive = true,
  } = body as Record<string, unknown>;

  if (typeof key !== 'string' || key.trim().length === 0) {
    return NextResponse.json({ error: 'Key is required' }, { status: 400 });
  }
  const normalizedKey = key.trim();
  if (!/^[a-z0-9_-]+$/.test(normalizedKey)) {
    return NextResponse.json(
      { error: 'Key must be lowercase letters, numbers, dashes, or underscores' },
      { status: 400 },
    );
  }

  if (typeof label !== 'string' || label.trim().length === 0) {
    return NextResponse.json({ error: 'Label is required' }, { status: 400 });
  }

  const serviceClient = getServiceSupabaseClient();

  // Determine display order (append to end if not provided).
  let resolvedDisplayOrder = 0;
  if (typeof displayOrder === 'number' && Number.isFinite(displayOrder)) {
    resolvedDisplayOrder = displayOrder;
  } else {
    const { data: maxRow, error: maxError } = await serviceClient
      .from('booking_occasions')
      .select('display_order')
      .order('display_order', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (maxError) {
      console.error('[ops/occasions][POST] failed to resolve display order', maxError.message);
      return NextResponse.json({ error: 'Unable to resolve display order' }, { status: 500 });
    }
    resolvedDisplayOrder = (maxRow?.display_order ?? 0) + 10;
  }

  const payload = {
    key: normalizedKey,
    label: String(label).trim(),
    short_label:
      typeof shortLabel === 'string' && shortLabel.trim().length > 0
        ? shortLabel.trim()
        : String(label).trim(),
    description:
      typeof description === 'string' && description.trim().length > 0 ? description.trim() : null,
    availability: Array.isArray(availability) ? availability : [],
    default_duration_minutes:
      typeof defaultDurationMinutes === 'number' && Number.isFinite(defaultDurationMinutes)
        ? Math.max(1, Math.round(defaultDurationMinutes))
        : 90,
    display_order: resolvedDisplayOrder,
    is_active: Boolean(isActive),
    is_builtin: normalizedKey === 'lunch' || normalizedKey === 'dinner',
    created_by: authorization.user.id,
    updated_by: authorization.user.id,
  };

  try {
    const { data: existing, error: existingError } = await serviceClient
      .from('booking_occasions')
      .select('key, deleted_at')
      .eq('key', normalizedKey)
      .maybeSingle<{ key: string; deleted_at: string | null }>();
    if (existingError) {
      throw existingError;
    }
    if (existing && !existing.deleted_at) {
      return NextResponse.json({ error: 'Occasion already exists' }, { status: 409 });
    }

    const { data, error } = await serviceClient
      .from('booking_occasions')
      .upsert(payload)
      .select()
      .maybeSingle();
    if (error) {
      throw error;
    }

    await insertAudit({
      occasion_key: normalizedKey,
      action: 'create',
      before_change: null,
      after_change: data ?? null,
      changed_by: authorization.user.id,
    });

    const occasion = data ? toAdminOccasion(data as Parameters<typeof toAdminOccasion>[0]) : null;
    return NextResponse.json({ occasion });
  } catch (error) {
    console.error('[ops/occasions][POST] failed to create occasion', error);
    return NextResponse.json({ error: 'Unable to create occasion' }, { status: 500 });
  }
}
