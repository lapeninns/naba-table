import { NextResponse } from 'next/server';
import { captureServerException } from '@/lib/posthog/server';

import { requireApiRateLimit } from '@/server/security/api-rate-limit';
import { withCsrfProtectedMutation } from '@/server/security/csrf';
import { getRouteHandlerSupabaseClient, getServiceSupabaseClient } from '@/server/supabase';
import { requireAdminMembership } from '@/server/team/access';

import type { NextRequest } from 'next/server';

const BUCKET_ID = 'restaurant-branding';
const MAX_FILE_SIZE_BYTES = 2 * 1024 * 1024; // 2 MB
const ALLOWED_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml']);

function jsonError(status: number, code: string, message: string, details?: unknown) {
  return NextResponse.json({ code, message, details }, { status });
}

type RouteContext = {
  params: Promise<{ id: string }>;
};

type MembershipGuardErrorCode = 'MEMBERSHIP_NOT_FOUND' | 'MEMBERSHIP_ROLE_DENIED';

function getMembershipGuardErrorCode(error: unknown): MembershipGuardErrorCode | null {
  if (!error || typeof error !== 'object') {
    return null;
  }

  const code = (error as { code?: string }).code;
  if (code === 'MEMBERSHIP_NOT_FOUND' || code === 'MEMBERSHIP_ROLE_DENIED') {
    return code;
  }
  return null;
}

async function ensureBucketExists() {
  const service = getServiceSupabaseClient();
  const { data, error } = await service.storage.getBucket(BUCKET_ID);
  if (!data) {
    const { error: createError } = await service.storage.createBucket(BUCKET_ID, {
      public: true,
      allowedMimeTypes: Array.from(ALLOWED_MIME_TYPES),
    });
    if (createError && !/Bucket already exists/i.test(createError.message ?? '')) {
      throw createError;
    }
  } else if (error) {
    console.warn('[ops/restaurants/logo] bucket lookup produced error', error);
  }
  return service;
}

export async function POST(req: NextRequest, context: RouteContext) {
  return withCsrfProtectedMutation(req, () => postRestaurantLogo(req, context));
}

async function postRestaurantLogo(req: NextRequest, context: RouteContext) {
  try {
    const supabase = await getRouteHandlerSupabaseClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError) {
      console.error('[ops/restaurants/logo][POST] auth resolution failed', authError.message);
      return jsonError(500, 'AUTH_RESOLUTION_FAILED', 'Unable to verify your session');
    }

    if (!user) {
      return jsonError(401, 'UNAUTHENTICATED', 'You must be signed in to upload a logo');
    }

    const { id: restaurantId } = await context.params;
    if (!restaurantId) {
      return jsonError(400, 'MISSING_RESTAURANT', 'Restaurant id is required');
    }

    try {
      await requireAdminMembership({ userId: user.id, restaurantId });
    } catch (error) {
      const membershipErrorCode = getMembershipGuardErrorCode(error);
      if (membershipErrorCode === 'MEMBERSHIP_NOT_FOUND') {
        return jsonError(403, 'FORBIDDEN', 'Forbidden');
      }
      if (membershipErrorCode === 'MEMBERSHIP_ROLE_DENIED') {
        return jsonError(403, 'FORBIDDEN', 'Owner or manager role required');
      }

      console.error('[ops/restaurants/logo][POST] membership guard failed', error);
      captureServerException(error, {
        distinctId: user.id,
        groups: { restaurant: restaurantId },
        properties: { restaurantId, source: 'ops', kind: 'ops-restaurant-logo' },
      });
      return jsonError(500, 'ACCESS_CHECK_FAILED', 'Unable to verify access');
    }

    const rateLimit = await requireApiRateLimit({
      request: req,
      scope: 'restaurant-logo:upload',
      tenantId: restaurantId,
      userId: user.id,
      limit: 10,
      windowMs: 60_000,
      message: 'Too many logo uploads. Please try again later.',
    });
    if (rateLimit) {
      return rateLimit;
    }

    let file: File | null = null;
    try {
      const formData = await req.formData();
      const candidate = formData.get('file');
      if (candidate instanceof File) {
        file = candidate;
      }
    } catch (cause) {
      console.error('[ops/restaurants/logo][POST] failed to parse form data', cause);
      return jsonError(400, 'INVALID_FORM_DATA', 'Failed to read the uploaded file');
    }

    if (!file) {
      return jsonError(400, 'FILE_REQUIRED', 'Select an image to upload');
    }

    if (file.size === 0) {
      return jsonError(400, 'EMPTY_FILE', 'The selected file is empty');
    }

    if (file.size > MAX_FILE_SIZE_BYTES) {
      return jsonError(400, 'FILE_TOO_LARGE', 'Images must be 2 MB or smaller');
    }

    if (!ALLOWED_MIME_TYPES.has(file.type)) {
      return jsonError(400, 'UNSUPPORTED_FILE', 'Supported formats: JPEG, PNG, WEBP, SVG');
    }

    const service = await ensureBucketExists();
    const cacheKey = Date.now().toString(36);
    const path = `${restaurantId}/logo`;

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const { error: uploadError } = await service.storage.from(BUCKET_ID).upload(path, buffer, {
      cacheControl: '3600',
      upsert: true,
      contentType: file.type,
    });

    if (uploadError) {
      console.error('[ops/restaurants/logo][POST] upload failed', uploadError.message);
      return jsonError(500, 'UPLOAD_FAILED', 'We couldn’t store your image. Please try again.');
    }

    const { data: publicUrlData } = service.storage.from(BUCKET_ID).getPublicUrl(path);
    const publicUrl = publicUrlData?.publicUrl;

    if (!publicUrl) {
      return jsonError(500, 'PUBLIC_URL_FAILED', 'We couldn’t generate an image URL');
    }

    return NextResponse.json({
      path,
      url: `${publicUrl}?v=${cacheKey}`,
      cacheKey,
    });
  } catch (error) {
    console.error('[ops/restaurants/logo][POST] unexpected', error);
    captureServerException(error, {
      properties: { source: 'ops', kind: 'ops-restaurant-logo' },
    });
    return jsonError(500, 'UNEXPECTED_ERROR', 'We couldn’t upload your image. Please try again.');
  }
}

export const runtime = 'nodejs';
