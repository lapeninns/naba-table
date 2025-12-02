import { NextResponse } from "next/server";

import { createRestaurantSchema } from "@/app/api/ops/restaurants/schema";
import { createRestaurant } from "@/server/restaurants/create";
import { validateCsrfToken } from "@/server/security/csrf";
import { getRouteHandlerSupabaseClient, getServiceSupabaseClient } from "@/server/supabase";

import type { NextRequest } from "next/server";

const payloadSchema = createRestaurantSchema.extend({
  // Make slug optional but allow empty string to be treated as undefined
  slug: createRestaurantSchema.shape.slug.optional().transform((value) => (value && value.length > 0 ? value : undefined)),
});

export async function POST(req: NextRequest) {
  if (!validateCsrfToken(req)) {
    return NextResponse.json({ error: "Invalid or missing CSRF token" }, { status: 403 });
  }

  const supabase = await getRouteHandlerSupabaseClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError) {
    console.error("[onboarding][restaurant][POST] auth resolve failed", authError.message);
    return NextResponse.json({ error: "Unable to verify session" }, { status: 500 });
  }

  if (!user) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = payloadSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Validation failed", details: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const serviceClient = getServiceSupabaseClient();
    const restaurant = await createRestaurant(parsed.data, user.id, serviceClient);

    return NextResponse.json(
      {
        restaurant: {
          id: restaurant.id,
          name: restaurant.name,
          slug: restaurant.slug,
          timezone: restaurant.timezone,
          capacity: restaurant.capacity,
          contactEmail: restaurant.contactEmail,
          contactPhone: restaurant.contactPhone,
          address: restaurant.address,
          googleMapUrl: restaurant.googleMapUrl,
          bookingPolicy: restaurant.bookingPolicy,
          logoUrl: restaurant.logoUrl,
          emailSendReminder24h: restaurant.emailSendReminder24h,
          emailSendReminderShort: restaurant.emailSendReminderShort,
          emailSendReviewRequest: restaurant.emailSendReviewRequest,
          reservationIntervalMinutes: restaurant.reservationIntervalMinutes,
          reservationDefaultDurationMinutes: restaurant.reservationDefaultDurationMinutes,
          reservationLastSeatingBufferMinutes: restaurant.reservationLastSeatingBufferMinutes,
          createdAt: restaurant.createdAt,
          updatedAt: restaurant.updatedAt,
          role: "owner" as const,
        },
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("[onboarding][restaurant][POST] creation failed", error);
    const message = error instanceof Error ? error.message : "Unable to create restaurant";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
