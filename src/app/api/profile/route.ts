import { NextResponse } from 'next/server';
import { randomUUID, createHash } from 'node:crypto';
import { ZodError } from 'zod';

import {
  apiError,
  conflict,
  fieldsFromIssues,
  internalError,
  unauthenticated,
} from '@/lib/api/errors';
import { logger } from '@/lib/logger';
import { captureServerException } from '@/lib/posthog/server';
import { profileUpdateSchema, type ProfileUpdatePayload } from '@/lib/profile/schema';
import { normalizeProfileRow, ensureProfileRow } from '@/lib/profile/server';
import { mapSupabaseAuthError } from '@/server/auth/supabase-auth-errors';
import { withCsrfProtectedMutation } from '@/server/security/csrf';
import { getRouteHandlerSupabaseClient, getServiceSupabaseClient } from '@/server/supabase';

import type { Database } from '@/types/supabase';
import type { NextRequest } from 'next/server';

const INVALID_PROFILE_MESSAGE = 'Some details need attention. Check the highlighted fields.';
const SAVE_FAILED_MESSAGE = 'We couldn’t save your profile. Try again.';

function invalidProfile(error: ZodError) {
  return apiError(400, 'INVALID_PROFILE', INVALID_PROFILE_MESSAGE, {
    fields: fieldsFromIssues(error.issues),
  });
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
      const mapped = mapSupabaseAuthError(authError);
      if (mapped.status >= 500) {
        logger.warn('api.profile.auth_unresolved', { route: 'profile.get' });
      }
      return apiError(mapped.status, mapped.code, mapped.message);
    }

    if (!user) {
      return unauthenticated('Sign in to view your profile.');
    }

    const row = await ensureProfileRow(supabase, user);
    const profile = normalizeProfileRow(row, user.email ?? null);

    return NextResponse.json({ profile });
  } catch (error) {
    captureServerException(error, {
      properties: { source: 'api', kind: 'profile' },
    });
    return internalError(
      error,
      { route: 'profile.get' },
      'We couldn’t load your profile. Try again.',
    );
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
      const mapped = mapSupabaseAuthError(authError);
      if (mapped.status >= 500) {
        logger.warn('api.profile.auth_unresolved', { route: 'profile.put' });
      }
      return apiError(mapped.status, mapped.code, mapped.message);
    }

    if (!user) {
      return unauthenticated('Sign in to update your profile.');
    }

    let rawBody: unknown;
    try {
      rawBody = await req.json();
    } catch {
      return apiError(400, 'INVALID_JSON', 'The request body must be valid JSON.');
    }

    if (
      rawBody &&
      typeof rawBody === 'object' &&
      Object.prototype.hasOwnProperty.call(rawBody, 'email')
    ) {
      const attemptedEmail = (rawBody as Record<string, unknown>).email;
      if (attemptedEmail !== undefined && attemptedEmail !== user.email) {
        return apiError(
          400,
          'EMAIL_IMMUTABLE',
          'Your email is managed through sign-in and can’t be changed here.',
          { fields: { email: ['Email can’t be changed here.'] } },
        );
      }
    }

    const result = profileUpdateSchema.safeParse(rawBody ?? {});
    if (!result.success) {
      return invalidProfile(result.error);
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
      return internalError(
        Object.assign(new Error('apply_profile_update_idempotent failed'), {
          code: rpcError.code ?? 'RPC_ERROR',
        }),
        { route: 'profile.put', stage: 'rpc' },
        SAVE_FAILED_MESSAGE,
      );
    }

    const rpcResult = Array.isArray(rpcData) ? rpcData[0] : rpcData;
    if (!rpcResult) {
      return internalError(
        new Error('apply_profile_update_idempotent returned no result'),
        { route: 'profile.put', stage: 'rpc_result' },
        SAVE_FAILED_MESSAGE,
      );
    }

    if (rpcResult.status === 'conflict') {
      return conflict(
        'IDEMPOTENCY_KEY_CONFLICT',
        'Your details changed while an earlier save was still being processed. Save again.',
      );
    }

    if (!rpcResult.profile) {
      return internalError(
        new Error('apply_profile_update_idempotent returned no profile'),
        { route: 'profile.put', stage: 'rpc_profile', rpcStatus: rpcResult.status },
        SAVE_FAILED_MESSAGE,
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
      return invalidProfile(error);
    }

    // Log which fields were being saved, never their values (name and phone are PII).
    return internalError(
      error,
      {
        route: 'profile.put',
        fieldNames: parsedBody ? Object.keys(parsedBody).sort() : [],
        hasIdempotencyKey: Boolean(idempotencyKey),
      },
      SAVE_FAILED_MESSAGE,
    );
  }
}
