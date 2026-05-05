import { NextResponse } from 'next/server';
import { z } from 'zod';

import { safeGoogleMapsUrl, safeGoogleReviewUrl } from '@/lib/security/safe-url';
import {
  PasswordConfirmationError,
  verifyUserPasswordConfirmation,
} from '@/server/auth/password-confirmation';
import { mapSupabaseAuthError } from '@/server/auth/supabase-auth-errors';
import { syncRestaurantProfileWithGoogleBusinessProfile } from '@/server/google-business-profile/service';
import {
  getRestaurantDetails,
  updateRestaurantDetails,
  type UpdateRestaurantDetailsInput,
} from '@/server/restaurants/details';
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
    return NextResponse.json(
      { error: mapped.message, code: mapped.code },
      { status: mapped.status },
    );
  }

  if (!user) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  try {
    await requireAdminMembership({
      userId: user.id,
      restaurantId,
      client: supabase,
    });
  } catch (error) {
    console.error('[ops][restaurants][details] admin permission required', error);
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  return {
    userEmail: user.email ?? null,
  };
}

function handleUnexpectedError(error: unknown, context: string) {
  console.error(context, error);

  if (error instanceof PasswordConfirmationError) {
    return NextResponse.json(
      { message: error.message, code: error.code },
      { status: error.status },
    );
  }

  if (error instanceof Error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ error: 'Unexpected error' }, { status: 500 });
}

export async function GET(_req: NextRequest, { params }: RouteParams) {
  const restaurantId = await resolveRestaurantId(params);
  if (!restaurantId) {
    return NextResponse.json({ error: 'Missing restaurant id' }, { status: 400 });
  }

  try {
    const authResponse = await ensureAuthorized(restaurantId);
    if (authResponse instanceof NextResponse) {
      return authResponse;
    }

    const details = await getRestaurantDetails(restaurantId);
    return NextResponse.json(details);
  } catch (error) {
    return handleUnexpectedError(error, '[ops][restaurants][details][GET]');
  }
}

export async function PUT(req: NextRequest, { params }: RouteParams) {
  const restaurantId = await resolveRestaurantId(params);
  if (!restaurantId) {
    return NextResponse.json({ error: 'Missing restaurant id' }, { status: 400 });
  }

  let payload: UpdateRestaurantDetailsInput;
  try {
    const json = await req.json();
    const parsed = detailsSchema.parse(json);
    payload = {
      name: parsed.name,
      slug: parsed.slug,
      timezone: parsed.timezone,
      capacity: parsed.capacity ?? null,
      contactPhone: parsed.phone ?? null,
      managerDailySummaryEnabled: parsed.managerDailySummaryEnabled,
      managerNotificationPhone: parsed.managerNotificationPhone ?? null,
      contactEmail: parsed.email ?? null,
      address: parsed.address ?? null,
      businessDescription: parsed.businessDescription ?? null,
      googleMapUrl: parsed.googleMapUrl ?? null,
      googleReviewUrl: parsed.googleReviewUrl ?? null,
      bookingPolicy: parsed.bookingPolicy ?? null,
      logoUrl: parsed.logoUrl ?? null,
    };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid payload', details: error.flatten() },
        { status: 400 },
      );
    }
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
  }

  try {
    const authResponse = await ensureAuthorized(restaurantId);
    if (authResponse instanceof NextResponse) {
      return authResponse;
    }

    const details = await updateRestaurantDetails(restaurantId, payload);
    return NextResponse.json(details);
  } catch (error) {
    return handleUnexpectedError(error, '[ops][restaurants][details][PUT]');
  }
}

export async function POST(req: NextRequest, { params }: RouteParams) {
  const restaurantId = await resolveRestaurantId(params);
  if (!restaurantId) {
    return NextResponse.json({ error: 'Missing restaurant id' }, { status: 400 });
  }

  let payload: z.infer<typeof syncSchema>;
  try {
    payload = syncSchema.parse(await req.json());
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid payload', details: error.flatten() },
        { status: 400 },
      );
    }
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
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
    return handleUnexpectedError(error, '[ops][restaurants][details][POST]');
  }
}
