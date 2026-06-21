import { NextResponse } from 'next/server';
import { z } from 'zod';

import { captureServerException } from '@/lib/posthog/server';
import {
  RESERVATION_INTERVAL_MAX,
  RESERVATION_INTERVAL_MIN,
} from '@/lib/restaurants/reservation-interval';
import {
  PasswordConfirmationError,
  verifyUserPasswordConfirmation,
} from '@/server/auth/password-confirmation';
import { mapSupabaseAuthError } from '@/server/auth/supabase-auth-errors';
import { syncRestaurantOperatingHoursWithGoogleBusinessProfile } from '@/server/google-business-profile/service';
import {
  getOperatingHours,
  updateOperatingHours,
  type UpdateOperatingHoursPayload,
} from '@/server/restaurants/operatingHours';
import { TIME_REGEX, canonicalTime } from '@/server/restaurants/timeNormalization';
import { withCsrfProtectedMutation } from '@/server/security/csrf';
import { getRouteHandlerSupabaseClient } from '@/server/supabase';
import { requireAdminMembership } from '@/server/team/access';

import type { NextRequest } from 'next/server';

const timeSchema = z
  .string()
  .trim()
  .regex(TIME_REGEX)
  .transform((value) => canonicalTime(value));
const notesSchema = z.string().max(250);
const intervalSchema = z.number().int().min(RESERVATION_INTERVAL_MIN).max(RESERVATION_INTERVAL_MAX);
const slotTimesSchema = z.array(timeSchema);

const weeklyEntrySchema = z
  .object({
    dayOfWeek: z.number().int().min(0).max(6),
    opensAt: z.union([timeSchema, z.null()]).optional(),
    closesAt: z.union([timeSchema, z.null()]).optional(),
    isClosed: z.boolean().optional(),
    notes: notesSchema.nullable().optional(),
    reservationIntervalMinutes: z.union([intervalSchema, z.null()]).optional(),
    reservationSlotTimes: z.union([slotTimesSchema, z.null()]).optional(),
  })
  .superRefine((data, ctx) => {
    const isClosed = data.isClosed ?? false;
    if (isClosed) {
      return;
    }

    if (!data.opensAt || !data.closesAt) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'opensAt and closesAt are required when day is not closed',
      });
    }
  });

const overrideSchema = z
  .object({
    id: z.string().uuid().optional(),
    effectiveDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    opensAt: z.union([timeSchema, z.null()]).optional(),
    closesAt: z.union([timeSchema, z.null()]).optional(),
    isClosed: z.boolean().optional(),
    notes: notesSchema.nullable().optional(),
    reservationIntervalMinutes: z.union([intervalSchema, z.null()]).optional(),
    reservationSlotTimes: z.union([slotTimesSchema, z.null()]).optional(),
  })
  .superRefine((data, ctx) => {
    const isClosed = data.isClosed ?? false;
    if (isClosed) {
      return;
    }

    if (!data.opensAt || !data.closesAt) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'opensAt and closesAt are required when override is not closed',
      });
    }
  });

const payloadSchema = z.object({
  weekly: z.array(weeklyEntrySchema),
  overrides: z.array(overrideSchema),
});

const syncSelectionSchema = z
  .object({
    weeklyDays: z.array(z.number().int().min(0).max(6)).optional(),
    overrideDates: z.array(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)).optional(),
  })
  .optional();

const syncSchema = z.object({
  direction: z.enum(['pull_from_gbp', 'push_to_gbp']).optional(),
  selection: syncSelectionSchema,
  password: z.string().trim().min(1, 'Enter your password to confirm this GBP action.'),
});

type RouteParams = {
  params: Promise<{
    id: string | string[];
  }>;
};

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
    console.error('[ops][restaurants][hours] admin permission required', error);
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  return {
    userEmail: user.email ?? null,
  };
}

function handleUnexpectedError(error: unknown, context: string) {
  console.error(context, error);

  if (!(error instanceof PasswordConfirmationError)) {
    captureServerException(error, { properties: { source: 'ops', kind: 'restaurant-hours' } });
  }

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

    const snapshot = await getOperatingHours(restaurantId);
    return NextResponse.json(snapshot);
  } catch (error) {
    return handleUnexpectedError(error, '[ops][restaurants][hours][GET]');
  }
}

export async function PUT(req: NextRequest, { params }: RouteParams) {
  const restaurantId = await resolveRestaurantId(params);
  if (!restaurantId) {
    return NextResponse.json({ error: 'Missing restaurant id' }, { status: 400 });
  }

  return withCsrfProtectedMutation(req, () => putOperatingHours(req, restaurantId));
}

async function putOperatingHours(req: NextRequest, restaurantId: string) {
  let payload: UpdateOperatingHoursPayload;
  try {
    const json = await req.json();
    payload = payloadSchema.parse(json);
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

    const snapshot = await updateOperatingHours(restaurantId, payload);
    return NextResponse.json(snapshot);
  } catch (error) {
    return handleUnexpectedError(error, '[ops][restaurants][hours][PUT]');
  }
}

export async function POST(req: NextRequest, { params }: RouteParams) {
  const restaurantId = await resolveRestaurantId(params);
  if (!restaurantId) {
    return NextResponse.json({ error: 'Missing restaurant id' }, { status: 400 });
  }

  return withCsrfProtectedMutation(req, () => postOperatingHours(req, restaurantId));
}

async function postOperatingHours(req: NextRequest, restaurantId: string) {
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

    const snapshot = await syncRestaurantOperatingHoursWithGoogleBusinessProfile({
      restaurantId,
      direction: payload.direction,
      selection: payload.selection,
    });
    return NextResponse.json(snapshot);
  } catch (error) {
    return handleUnexpectedError(error, '[ops][restaurants][hours][POST]');
  }
}
