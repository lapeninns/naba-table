import { NextResponse } from "next/server";
import { z } from "zod";

import { getOccasionCatalog } from "@/server/occasions/catalog";
import { updateServicePeriods, type UpdateServicePeriod } from "@/server/restaurants/servicePeriods";
import { TIME_REGEX, canonicalTime } from "@/server/restaurants/timeNormalization";
import { validateCsrfToken } from "@/server/security/csrf";
import { getRouteHandlerSupabaseClient } from "@/server/supabase";
import { requireAdminMembership } from "@/server/team/access";

import type { NextRequest } from "next/server";

const timeSchema = z
  .string()
  .trim()
  .regex(TIME_REGEX)
  .transform((value) => canonicalTime(value));
const nameSchema = z.string().min(1).max(80);

const payloadSchema = z.array(
  z.object({
    id: z.string().uuid().optional(),
    name: nameSchema,
    dayOfWeek: z.number().int().min(0).max(6).nullable().optional(),
    startTime: timeSchema,
    endTime: timeSchema,
    bookingOption: z.string().trim().min(1),
  }),
);

type RouteParams = {
  params: Promise<{ id: string | string[] }>;
};

async function resolveRestaurantId(paramsPromise: Promise<{ id: string | string[] }> | undefined): Promise<string | null> {
  if (!paramsPromise) return null;
  const params = await paramsPromise;
  const { id } = params;
  if (typeof id === "string") return id;
  if (Array.isArray(id)) return id[0] ?? null;
  return null;
}

function handleUnexpectedError(error: unknown, context: string) {
  console.error(context, error);
  if (error instanceof Error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
  return NextResponse.json({ error: "Unexpected error" }, { status: 500 });
}

export async function PATCH(req: NextRequest, { params }: RouteParams) {
  if (!validateCsrfToken(req)) {
    return NextResponse.json({ error: "Invalid or missing CSRF token" }, { status: 403 });
  }
  const restaurantId = await resolveRestaurantId(params);
  if (!restaurantId) {
    return NextResponse.json({ error: "Missing restaurant id" }, { status: 400 });
  }

  let payload: UpdateServicePeriod[];
  try {
    const json = await req.json();
    payload = payloadSchema.parse(json) as UpdateServicePeriod[];
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid payload", details: error.flatten() }, { status: 400 });
    }
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  try {
    const supabase = await getRouteHandlerSupabaseClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError) {
      return NextResponse.json({ error: "Unable to verify session" }, { status: 500 });
    }
    if (!user) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    await requireAdminMembership({
      userId: user.id,
      restaurantId,
      client: supabase,
    });

    const catalog = await getOccasionCatalog();
    const validKeys = new Set(catalog.definitions.map((definition) => definition.key.toLowerCase()));
    const sanitized = payload.map((entry) => ({
      ...entry,
      bookingOption: entry.bookingOption.trim().toLowerCase(),
    })) as UpdateServicePeriod[];

    const invalidEntry = sanitized.find((entry) => !validKeys.has(entry.bookingOption));
    if (invalidEntry) {
      return NextResponse.json({ error: `Unknown occasion "${invalidEntry.bookingOption}"` }, { status: 400 });
    }

    const periods = await updateServicePeriods(restaurantId, sanitized);
    return NextResponse.json({ restaurantId, periods }, { status: 200 });
  } catch (error) {
    return handleUnexpectedError(error, "[onboarding][restaurant][service-periods][PATCH]");
  }
}
