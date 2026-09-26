import { NextResponse } from 'next/server';
import { z } from 'zod';

import {
  apiError,
  forbidden,
  internalError,
  unauthenticated,
  validationError,
} from '@/lib/api/errors';
import { captureServerException } from '@/lib/posthog/server';
import { safeGoogleMapsUrl, safeGoogleReviewUrl } from '@/lib/security/safe-url';
import {
  PasswordConfirmationError,
  verifyUserPasswordConfirmation,
} from '@/server/auth/password-confirmation';
import { mapSupabaseAuthError } from '@/server/auth/supabase-auth-errors';
import { isGoogleBusinessProfileError } from '@/server/google-business-profile/errors';
import { syncRestaurantProfileWithGoogleBusinessProfile } from '@/server/google-business-profile/service';
import {
  getRestaurantDetails,
  updateRestaurantDetails,
  type UpdateRestaurantDetailsInput,
} from '@/server/restaurants/details';
import { isRestaurantUpdateError } from '@/server/restaurants/update-errors';
import { withCsrfProtectedMutation } from '@/server/security/csrf';
import { getRouteHandlerSupabaseClient } from '@/server/supabase';
import { requireAdminMembership } from '@/server/team/access';

import type { NextRequest } from 'next/server';

type RouteParams = {
  params: Promise<{
    id: string | string[];
  }>;
};

function googleUrlField(
  sanitizer: (value: string | null | undefined) => string | null,
  message: string,
) {
  return z
    .preprocess(
      (value) => {
        if (typeof value !== 'string') {
          return value;
        }
        const trimmed = value.trim();
        return trimmed ? (sanitizer(trimmed) ?? trimmed) : null;
      },
      z
        .string()
        .max(2048)
        .refine((value) => sanitizer(value) === value, message)
        .nullable(),
    )
    .optional();
}

const detailsSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  slug: z
    .string()
    .min(1)
    .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/)
    .max(120)
    .optional(),
  timezone: z.string().min(1),
  capacity: z.number().int().min(0).nullable().optional(),
  phone: z.string().max(80).nullable().optional(),
  managerDailySummaryEnabled: z.boolean().optional(),
  managerNotificationPhone: z
    .string()
    .regex(/^\+[1-9][0-9]{6,14}$/)
    .max(16)
    .nullable()
    .optional(),
  email: z.string().email().nullable().optional(),
  address: z.string().max(240).nullable().optional(),
  businessDescription: z.string().max(4096).nullable().optional(),
  googleMapUrl: googleUrlField(
    safeGoogleMapsUrl,
    'Google Map link must be an HTTPS Google Maps URL',
  ),
  googleReviewUrl: googleUrlField(
    safeGoogleReviewUrl,
    'Google review link must be an HTTPS Google review URL',
  ),
  bookingPolicy: z.string().max(800).nullable().optional(),
  logoUrl: z.string().url().nullable().optional(),
});

const syncSchema = z.object({
  direction: z.enum(['pull_from_gbp', 'push_to_gbp']).optional(),
  fields: z
    .array(z.enum(['name', 'contactPhone', 'address', 'googleMapUrl', 'googleReviewUrl']))
    .optional(),
  password: z.string().trim().min(1, 'Enter your password to confirm this GBP action.'),
});

async function resolveRestaurantId(
  paramsPromise: Promise<{ id: string | string[] }> | undefined,
): Promise<string | null> {
  if (!paramsPromise) return null;
  const params = await paramsPromise;
  const { id } = params;
  if (typeof id === 'string') return id;
  if (Array.isArray(id)) return id[0] ?? null;
  return null;
}

async function ensureAuthorized(
  restaurantId: string,
): Promise<NextResponse | { userEmail: string | null }> {
  const supabase = await getRouteHandlerSupabaseClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError) {
    const mapped = mapSupabaseAuthError(authError);
    return apiError(mapped.status, mapped.code, mapped.message);
  }

  if (!user) {
    return unauthenticated();
  }

  try {
    await requireAdminMembership({
      userId: user.id,
      restaurantId,
      client: supabase,
    });
  } catch {
    return forbidden();
  }

  return {
    userEmail: user.email ?? null,
  };
}

const ROUTE = 'ops.restaurants.details';

function handleUnexpectedError(error: unknown, restaurantId: string, method: string) {
  if (error instanceof PasswordConfirmationError) {
    return apiError(error.status, error.code, error.message);
  }

  if (isRestaurantUpdateError(error)) {
    return apiError(error.status, error.code, error.message, { fields: error.fields });
  }

  captureServerException(error, { properties: { source: 'ops', kind: 'restaurant-details' } });

  if (isGoogleBusinessProfileError(error)) {
    // GBP service errors carry app-authored copy and a stable code.
    return apiError(error.status, error.code, error.message);
  }

  return internalError(error, { route: ROUTE, restaurantId, method });
}

export async function GET(_req: NextRequest, { params }: RouteParams) {
  const restaurantId = await resolveRestaurantId(params);
  if (!restaurantId) {
    return apiError(400, 'MISSING_RESTAURANT', 'Restaurant id is required.');
  }

  try {
    const authResponse = await ensureAuthorized(restaurantId);
    if (authResponse instanceof NextResponse) {
      return authResponse;
    }

    const details = await getRestaurantDetails(restaurantId);
    return NextResponse.json(details);
  } catch (error) {
    return handleUnexpectedError(error, restaurantId, 'GET');
  }
}

export async function PUT(req: NextRequest, { params }: RouteParams) {
  const restaurantId = await resolveRestaurantId(params);
  if (!restaurantId) {
    return apiError(400, 'MISSING_RESTAURANT', 'Restaurant id is required.');
  }

  return withCsrfProtectedMutation(req, () => putRestaurantDetails(req, restaurantId));
}

async function putRestaurantDetails(req: NextRequest, restaurantId: string) {
  let payload: UpdateRestaurantDetailsInput;
  try {
    const json = await req.json();
    const parsed = detailsSchema.parse(json);
    const hasField = (field: keyof typeof parsed) =>
      Object.prototype.hasOwnProperty.call(parsed, field);
    payload = {
      ...(hasField('name') ? { name: parsed.name } : {}),
      ...(hasField('slug') ? { slug: parsed.slug } : {}),
      ...(hasField('timezone') ? { timezone: parsed.timezone } : {}),
      ...(hasField('capacity') ? { capacity: parsed.capacity ?? null } : {}),
      ...(hasField('phone') ? { contactPhone: parsed.phone ?? null } : {}),
      ...(hasField('managerDailySummaryEnabled')
        ? { managerDailySummaryEnabled: parsed.managerDailySummaryEnabled }
        : {}),
      ...(hasField('managerNotificationPhone')
        ? { managerNotificationPhone: parsed.managerNotificationPhone ?? null }
        : {}),
      ...(hasField('email') ? { contactEmail: parsed.email ?? null } : {}),
      ...(hasField('address') ? { address: parsed.address ?? null } : {}),
      ...(hasField('businessDescription')
        ? { businessDescription: parsed.businessDescription ?? null }
        : {}),
      ...(hasField('googleMapUrl') ? { googleMapUrl: parsed.googleMapUrl ?? null } : {}),
      ...(hasField('googleReviewUrl') ? { googleReviewUrl: parsed.googleReviewUrl ?? null } : {}),
      ...(hasField('bookingPolicy') ? { bookingPolicy: parsed.bookingPolicy ?? null } : {}),
      ...(hasField('logoUrl') ? { logoUrl: parsed.logoUrl ?? null } : {}),
    };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return validationError(error);
    }
    return apiError(400, 'INVALID_JSON', 'The request body could not be read.');
  }

  try {
    const authResponse = await ensureAuthorized(restaurantId);
    if (authResponse instanceof NextResponse) {
      return authResponse;
    }

    const details = await updateRestaurantDetails(restaurantId, payload);
    return NextResponse.json(details);
  } catch (error) {
    return handleUnexpectedError(error, restaurantId, 'PUT');
  }
}

export async function POST(req: NextRequest, { params }: RouteParams) {
  const restaurantId = await resolveRestaurantId(params);
  if (!restaurantId) {
    return apiError(400, 'MISSING_RESTAURANT', 'Restaurant id is required.');
  }

  return withCsrfProtectedMutation(req, () => postRestaurantDetails(req, restaurantId));
}

async function postRestaurantDetails(req: NextRequest, restaurantId: string) {
  let payload: z.infer<typeof syncSchema>;
  try {
    payload = syncSchema.parse(await req.json());
  } catch (error) {
    if (error instanceof z.ZodError) {
      return validationError(error);
    }
    return apiError(400, 'INVALID_JSON', 'The request body could not be read.');
  }

  if (payload.direction === 'push_to_gbp') {
    return apiError(
      410,
      'GBP_LEGACY_GOOGLE_WRITE_RETIRED',
      'Legacy Google Business Profile writes are retired.',
    );
  }

  try {
    const authResponse = await ensureAuthorized(restaurantId);
    if (authResponse instanceof NextResponse) {
      return authResponse;
    }

    await verifyUserPasswordConfirmation({
      email: authResponse.userEmail,
      password: payload.password,
    });

    const details = await syncRestaurantProfileWithGoogleBusinessProfile({
      restaurantId,
      direction: payload.direction,
      fields: payload.fields,
    });
    return NextResponse.json(details);
  } catch (error) {
    return handleUnexpectedError(error, restaurantId, 'POST');
  }
}
