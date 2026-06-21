import { NextResponse } from 'next/server';
import { randomUUID, createHash } from 'node:crypto';
import { ZodError } from 'zod';
import { captureServerException } from '@/lib/posthog/server';

import { profileUpdateSchema, type ProfileUpdatePayload } from '@/lib/profile/schema';
import { normalizeProfileRow, ensureProfileRow } from '@/lib/profile/server';
import { mapSupabaseAuthError } from '@/server/auth/supabase-auth-errors';
import { withCsrfProtectedMutation } from '@/server/security/csrf';
import { getRouteHandlerSupabaseClient, getServiceSupabaseClient } from '@/server/supabase';

import type { Database } from '@/types/supabase';
import type { NextRequest } from 'next/server';

function jsonError(status: number, code: string, message: string, details?: unknown) {
  return NextResponse.json({ code, message, details }, { status });
}

type ProfileRow = Database['public']['Tables']['profiles']['Row'];

type ApplyProfileUpdateResult = {
  status: 'applied' | 'idempotent' | 'conflict';
  profile: ProfileRow | null;
};

type ApplyProfileUpdateRpcClient = {
  rpc: (
    fn: 'apply_profile_update_idempotent',
    args: {
      p_profile_id: string;
      p_idempotency_key: string;
      p_payload_hash: string;
      p_set_name: boolean;
      p_name: string | null;
      p_set_phone: boolean;
      p_phone: string | null;
      p_set_image: boolean;
      p_image: string | null;
    },
  ) => Promise<{
    data: ApplyProfileUpdateResult[] | ApplyProfileUpdateResult | null;
    error: { message?: string; code?: string } | null;
  }>;
};

function normalizeIdempotencyKey(raw: string | null): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (trimmed.length === 0) {
    return null;
  }
  if (trimmed.length > 128) {
    return trimmed.slice(0, 128);
  }
  return trimmed;
}

function hashPayload(payload: ProfileUpdatePayload): string {
  const ordered = Object.keys(payload)
    .sort()
    .reduce<Record<string, unknown>>((acc, key) => {
      acc[key] = payload[key as keyof ProfileUpdatePayload] ?? null;
      return acc;
    }, {});
  return createHash('sha256').update(JSON.stringify(ordered)).digest('hex');
}

export async function GET(): Promise<NextResponse> {
  try {
    const supabase = await getRouteHandlerSupabaseClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError) {
      console.error('[profile][get] failed to resolve auth', authError.message);
      const mapped = mapSupabaseAuthError(authError);
      return jsonError(mapped.status, mapped.code, mapped.message);
    }

    if (!user) {
      return jsonError(401, 'UNAUTHENTICATED', 'You must be signed in to view your profile');
    }

    const row = await ensureProfileRow(supabase, user);
    const profile = normalizeProfileRow(row, user.email ?? null);

    return NextResponse.json({ profile });
  } catch (error) {
    console.error('[profile][get] unexpected', error);
    captureServerException(error, {
      properties: { source: 'api', kind: 'profile' },
    });
    return jsonError(500, 'UNEXPECTED_ERROR', 'We couldn’t load your profile. Please try again.');
  }
}

export async function PUT(req: NextRequest): Promise<NextResponse> {
  return withCsrfProtectedMutation(req, () => putProfile(req));
}

async function putProfile(req: NextRequest): Promise<NextResponse> {
  let parsedBody: ProfileUpdatePayload | null = null;
  let idempotencyKey: string | null = null;

  try {
    const supabase = await getRouteHandlerSupabaseClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError) {
      console.error('[profile][put] failed to resolve auth', authError.message);
      const mapped = mapSupabaseAuthError(authError);
      return jsonError(mapped.status, mapped.code, mapped.message);
    }

    if (!user) {
      return jsonError(401, 'UNAUTHENTICATED', 'You must be signed in to update your profile');
    }

    let rawBody: unknown;
    try {
      rawBody = await req.json();
    } catch {
      return jsonError(400, 'INVALID_JSON', 'Request body must be valid JSON');
    }

    if (
      rawBody &&
      typeof rawBody === 'object' &&
      Object.prototype.hasOwnProperty.call(rawBody, 'email')
    ) {
      const attemptedEmail = (rawBody as Record<string, unknown>).email;
      if (attemptedEmail !== undefined && attemptedEmail !== user.email) {
        return jsonError(400, 'EMAIL_IMMUTABLE', 'Email cannot be changed');
      }
    }

    const result = profileUpdateSchema.safeParse(rawBody ?? {});
    if (!result.success) {
      const flattened = result.error.flatten();
      return jsonError(400, 'INVALID_PROFILE', 'Please review the highlighted fields', flattened);
    }

    parsedBody = result.data;

    idempotencyKey = normalizeIdempotencyKey(req.headers.get('Idempotency-Key')) ?? randomUUID();

    const row = await ensureProfileRow(supabase, user);
    const serviceSupabase = getServiceSupabaseClient();

    if (
      !Object.keys(parsedBody).some((key) => key === 'name' || key === 'phone' || key === 'image')
    ) {
      const profile = normalizeProfileRow(row, user.email ?? null);
      return NextResponse.json(
        { profile, idempotent: true },
        {
          headers: {
            'Idempotency-Key': idempotencyKey,
          },
        },
      );
    }

    const payloadHash = hashPayload(parsedBody);
    const hasName = Object.prototype.hasOwnProperty.call(parsedBody, 'name');
    const hasPhone = Object.prototype.hasOwnProperty.call(parsedBody, 'phone');
    const hasImage = Object.prototype.hasOwnProperty.call(parsedBody, 'image');

    const { data: rpcData, error: rpcError } = await (
      serviceSupabase as unknown as ApplyProfileUpdateRpcClient
    ).rpc('apply_profile_update_idempotent', {
      p_profile_id: user.id,
      p_idempotency_key: idempotencyKey,
      p_payload_hash: payloadHash,
      p_set_name: hasName,
      p_name: hasName ? (parsedBody.name ?? null) : null,
      p_set_phone: hasPhone,
      p_phone: hasPhone ? (parsedBody.phone ?? null) : null,
      p_set_image: hasImage,
      p_image: hasImage ? (parsedBody.image ?? null) : null,
    });

    if (rpcError) {
      console.error('[profile][put] atomic update failed', rpcError.message ?? rpcError.code);
      return jsonError(
        500,
        'PROFILE_UPDATE_FAILED',
        'Unable to save your profile. Please try again.',
      );
    }

    const rpcResult = Array.isArray(rpcData) ? rpcData[0] : rpcData;
    if (!rpcResult) {
      console.error('[profile][put] atomic update returned no result');
      return jsonError(
        500,
        'PROFILE_UPDATE_FAILED',
        'Unable to save your profile. Please try again.',
      );
    }

    if (rpcResult.status === 'conflict') {
      return jsonError(
        409,
        'IDEMPOTENCY_KEY_CONFLICT',
        'This update was already applied with different details. Refresh and try again with a new request.',
      );
    }

    if (!rpcResult.profile) {
      console.error('[profile][put] atomic update returned no profile', rpcResult.status);
      return jsonError(
        500,
        'PROFILE_UPDATE_FAILED',
        'Unable to save your profile. Please try again.',
      );
    }

    const profile = normalizeProfileRow(rpcResult.profile, user.email ?? null);
    return NextResponse.json(
      { profile, idempotent: rpcResult.status === 'idempotent' },
      {
        headers: {
          'Idempotency-Key': idempotencyKey,
        },
      },
    );
  } catch (error) {
    if (error instanceof ZodError) {
      const flattened = error.flatten();
      return jsonError(400, 'INVALID_PROFILE', 'Please review the highlighted fields', flattened);
    }

    console.error('[profile][put] unexpected', error, parsedBody ?? {});
    return jsonError(500, 'UNEXPECTED_ERROR', 'We couldn’t update your profile. Please try again.');
  }
}
