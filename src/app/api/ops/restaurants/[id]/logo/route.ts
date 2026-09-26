import { NextResponse } from 'next/server';

import { apiError, forbidden, internalError, unauthenticated } from '@/lib/api/errors';
import { captureServerException } from '@/lib/posthog/server';
import {
  LOGO_ALLOWED_MIME_TYPES,
  LOGO_BUCKET_ID,
  buildVersionedLogoPath,
  logoStoragePathFromUrl,
  removeLogoObject,
} from '@/server/restaurants/logo-storage';
import { updateRestaurantProfile } from '@/server/restaurants/update';
import { isRestaurantUpdateError } from '@/server/restaurants/update-errors';
import { requireApiRateLimit } from '@/server/security/api-rate-limit';
import { withCsrfProtectedMutation } from '@/server/security/csrf';
import { getRouteHandlerSupabaseClient, getServiceSupabaseClient } from '@/server/supabase';
import { requireAdminMembership } from '@/server/team/access';

import { toRestaurantDto } from '../_restaurantDto';

import type { RestaurantDTO, RestaurantResponse } from '../../schema';
import type { NextRequest } from 'next/server';

const ROUTE = 'ops.restaurants.logo';
const MAX_FILE_SIZE_BYTES = 2 * 1024 * 1024; // 2 MB

type RouteContext = {
  params: Promise<{ id: string }>;
};

export type RestaurantLogoUploadResponse = RestaurantResponse & {
  path: string;
  url: string;
  cacheKey: string;
};

type ServiceClient = ReturnType<typeof getServiceSupabaseClient>;

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

type AuthorizedContext = { userId: string; restaurantId: string; role: RestaurantDTO['role'] };

/** Session and owner/manager membership, or the C1 response to return. */
async function authorize(context: RouteContext): Promise<AuthorizedContext | NextResponse> {
  const supabase = await getRouteHandlerSupabaseClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError) {
    return apiError(500, 'AUTH_RESOLUTION_FAILED', 'Unable to verify your session.', {
      retryable: true,
    });
  }

  if (!user) {
    return unauthenticated('Sign in to change the logo.');
  }

  const { id: restaurantId } = await context.params;
  if (!restaurantId) {
    return apiError(400, 'MISSING_RESTAURANT', 'Restaurant id is required.');
  }

  try {
    const membership = await requireAdminMembership({ userId: user.id, restaurantId });
    return {
      userId: user.id,
      restaurantId,
      role: (membership.role as RestaurantDTO['role']) ?? 'viewer',
    };
  } catch (error) {
    const membershipErrorCode = getMembershipGuardErrorCode(error);
    if (membershipErrorCode === 'MEMBERSHIP_NOT_FOUND') {
      return forbidden();
    }
    if (membershipErrorCode === 'MEMBERSHIP_ROLE_DENIED') {
      return forbidden('FORBIDDEN', 'Only an owner or manager can change the logo.');
    }
    captureServerException(error, {
      distinctId: user.id,
      groups: { restaurant: restaurantId },
      properties: { restaurantId, source: 'ops', kind: 'ops-restaurant-logo' },
    });
    return internalError(error, { route: ROUTE, restaurantId, stage: 'membership' });
  }
}

async function ensureBucketExists(service: ServiceClient): Promise<void> {
  const { data } = await service.storage.getBucket(LOGO_BUCKET_ID);
  if (data) {
    return;
  }
  const { error: createError } = await service.storage.createBucket(LOGO_BUCKET_ID, {
    public: true,
    allowedMimeTypes: Array.from(LOGO_ALLOWED_MIME_TYPES),
  });
  if (createError && !/Bucket already exists/i.test(createError.message ?? '')) {
    throw createError;
  }
}

function saveFailureResponse(error: unknown, ctx: { restaurantId: string; method: string }) {
  if (isRestaurantUpdateError(error)) {
    return apiError(error.status, error.code, error.message, { fields: error.fields });
  }
  captureServerException(error, {
    groups: { restaurant: ctx.restaurantId },
    properties: { source: 'ops', kind: 'ops-restaurant-logo' },
  });
  return internalError(
    error,
    { route: ROUTE, restaurantId: ctx.restaurantId, method: ctx.method },
    'We couldn’t save your logo. Please try again.',
  );
}

export async function POST(req: NextRequest, context: RouteContext) {
  return withCsrfProtectedMutation(req, () => postRestaurantLogo(req, context));
}

async function postRestaurantLogo(req: NextRequest, context: RouteContext) {
  const authorized = await authorize(context);
  if (authorized instanceof NextResponse) {
    return authorized;
  }
  const { restaurantId, userId, role } = authorized;

  const rateLimit = await requireApiRateLimit({
    request: req,
    scope: 'restaurant-logo:upload',
    tenantId: restaurantId,
    userId,
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
  } catch {
    return apiError(400, 'INVALID_FORM_DATA', 'Failed to read the uploaded file.');
  }

  if (!file) {
    return apiError(400, 'FILE_REQUIRED', 'Select an image to upload.');
  }
  if (file.size === 0) {
    return apiError(400, 'EMPTY_FILE', 'The selected file is empty.');
  }
  if (file.size > MAX_FILE_SIZE_BYTES) {
    return apiError(400, 'FILE_TOO_LARGE', 'Images must be 2 MB or smaller.');
  }
  if (!LOGO_ALLOWED_MIME_TYPES.has(file.type)) {
    return apiError(400, 'UNSUPPORTED_FILE', 'Supported formats: JPEG, PNG, WEBP.');
  }

  const service = getServiceSupabaseClient();

  let path: string;
  let version: string;
  let publicUrl: string;
  try {
    await ensureBucketExists(service);
    ({ path, version } = buildVersionedLogoPath(restaurantId, file.type));

    const buffer = Buffer.from(await file.arrayBuffer());
    const { error: uploadError } = await service.storage.from(LOGO_BUCKET_ID).upload(path, buffer, {
      // Each version has its own path, so the object can be cached for a long time.
      cacheControl: '31536000',
      upsert: false,
      contentType: file.type,
    });
    if (uploadError) {
      return internalError(
        uploadError,
        { route: ROUTE, restaurantId, stage: 'upload' },
        'We couldn’t store your image. Please try again.',
      );
    }

    const { data: publicUrlData } = service.storage.from(LOGO_BUCKET_ID).getPublicUrl(path);
    if (!publicUrlData?.publicUrl) {
      await removeLogoObject(service, path, { restaurantId, reason: 'save_failed' });
      return internalError(
        new Error('Public URL unavailable'),
        { route: ROUTE, restaurantId, stage: 'public_url' },
        'We couldn’t generate an image URL.',
      );
    }
    publicUrl = publicUrlData.publicUrl;
  } catch (error) {
    captureServerException(error, {
      properties: { source: 'ops', kind: 'ops-restaurant-logo' },
    });
    return internalError(
      error,
      { route: ROUTE, restaurantId, stage: 'upload' },
      'We couldn’t upload your image. Please try again.',
    );
  }

  let saved: Awaited<ReturnType<typeof updateRestaurantProfile>>;
  try {
    saved = await updateRestaurantProfile(restaurantId, { logoUrl: publicUrl }, service);
  } catch (error) {
    // The saved logo still points at the previous object, so only the new upload is dropped.
    await removeLogoObject(service, path, { restaurantId, reason: 'save_failed' });
    return saveFailureResponse(error, { restaurantId, method: 'POST' });
  }

  // The replaced logo is read under the update's row lock, so concurrent uploads each delete
  // exactly the object their own save replaced and none is orphaned.
  const previousPath = logoStoragePathFromUrl(saved.previous.logoUrl, restaurantId);
  if (previousPath && previousPath !== path) {
    await removeLogoObject(service, previousPath, { restaurantId, reason: 'replaced' });
  }

  const response: RestaurantLogoUploadResponse = {
    path,
    url: publicUrl,
    cacheKey: version,
    restaurant: toRestaurantDto(saved.restaurant, role),
  };
  return NextResponse.json(response);
}

export async function DELETE(req: NextRequest, context: RouteContext) {
  return withCsrfProtectedMutation(req, () => deleteRestaurantLogo(context));
}

async function deleteRestaurantLogo(context: RouteContext) {
  const authorized = await authorize(context);
  if (authorized instanceof NextResponse) {
    return authorized;
  }
  const { restaurantId, role } = authorized;
  const service = getServiceSupabaseClient();

  let saved: Awaited<ReturnType<typeof updateRestaurantProfile>>;
  try {
    saved = await updateRestaurantProfile(restaurantId, { logoUrl: null }, service);
  } catch (error) {
    return saveFailureResponse(error, { restaurantId, method: 'DELETE' });
  }

  const previousPath = logoStoragePathFromUrl(saved.previous.logoUrl, restaurantId);
  if (previousPath) {
    await removeLogoObject(service, previousPath, { restaurantId, reason: 'removed' });
  }

  const response: RestaurantResponse = { restaurant: toRestaurantDto(saved.restaurant, role) };
  return NextResponse.json(response);
}

export const runtime = 'nodejs';
