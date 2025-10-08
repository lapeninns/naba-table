import { NextRequest, NextResponse } from "next/server";

import { getRouteHandlerSupabaseClient } from "@/server/supabase";
import type { Database } from "@/types/supabase";
import { createRestaurantSchema, type CreateRestaurantPayload } from "@/lib/owner/restaurants/schema";

type RestaurantInsert = Database["public"]["Tables"]["restaurants"]["Insert"];
type RestaurantRow = Database["public"]["Tables"]["restaurants"]["Row"];
type MembershipRow = Database["public"]["Tables"]["restaurant_memberships"]["Row"];

type CreateRestaurantResponse = {
  restaurant: {
    id: string;
    name: string;
    slug: string;
    timezone: string;
    contactEmail: string | null;
    contactPhone: string | null;
    address: string | null;
    capacity: number | null;
    bookingPolicy: string | null;
    createdAt: string;
    updatedAt: string;
  };
  membership: {
    restaurantId: string;
    role: string;
    createdAt: string;
  } | null;
};

function normalizeInsertPayload(payload: CreateRestaurantPayload): RestaurantInsert {
  return {
    name: payload.name,
    slug: payload.slug,
    timezone: payload.timezone,
    contact_email: payload.contactEmail ? payload.contactEmail : null,
    contact_phone: payload.contactPhone ? payload.contactPhone : null,
    address: payload.address ? payload.address : null,
  };
}

function toResponse(restaurant: RestaurantRow, membership: MembershipRow | null): CreateRestaurantResponse {
  return {
    restaurant: {
      id: restaurant.id,
      name: restaurant.name,
      slug: restaurant.slug,
      timezone: restaurant.timezone,
      contactEmail: restaurant.contact_email,
      contactPhone: restaurant.contact_phone,
      address: restaurant.address,
      capacity: restaurant.capacity,
      bookingPolicy: restaurant.booking_policy,
      createdAt: restaurant.created_at,
      updatedAt: restaurant.updated_at,
    },
    membership: membership
      ? {
          restaurantId: membership.restaurant_id,
          role: membership.role,
          createdAt: membership.created_at,
        }
      : null,
  };
}

function errorResponse(status: number, code: string, message: string, details?: unknown) {
  return NextResponse.json({ code, message, details }, { status });
}

export async function POST(req: NextRequest) {
  let parsedBody: CreateRestaurantPayload | null = null;

  try {
    const supabase = await getRouteHandlerSupabaseClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError) {
      console.error("[owner/restaurants][post] auth error", authError.message);
      return errorResponse(500, "AUTH_RESOLUTION_FAILED", "Unable to verify your session");
    }

    if (!user) {
      return errorResponse(401, "UNAUTHENTICATED", "You must sign in to create a restaurant");
    }

    if (!user.email_confirmed_at) {
      return errorResponse(403, "EMAIL_NOT_VERIFIED", "Verify your email before creating a restaurant");
    }

    let rawBody: unknown;
    try {
      rawBody = await req.json();
    } catch {
      return errorResponse(400, "INVALID_JSON", "Request body must be valid JSON");
    }

    const result = createRestaurantSchema.safeParse(rawBody ?? {});
    if (!result.success) {
      const flattened = result.error.flatten();
      return errorResponse(400, "INVALID_RESTAURANT", "Please review the highlighted fields", flattened);
    }

    parsedBody = result.data;
    const insertPayload = normalizeInsertPayload(parsedBody);

    const { data: inserted, error: insertError } = await supabase
      .from("restaurants")
      .insert(insertPayload)
      .select("id, name, slug, timezone, contact_email, contact_phone, address, capacity, booking_policy, created_at, updated_at, created_by")
      .single<RestaurantRow>();

    if (insertError) {
      if (insertError.code === "23505") {
        return errorResponse(409, "SLUG_TAKEN", "That slug is already in use. Try another one.");
      }

      console.error("[owner/restaurants][post] insert failed", insertError.message, {
        code: insertError.code,
        details: insertError.details,
        hint: insertError.hint,
      });
      return errorResponse(500, "RESTAURANT_CREATE_FAILED", "Unable to create the restaurant right now");
    }

    const { data: membership, error: membershipError } = await supabase
      .from("restaurant_memberships")
      .select("restaurant_id, role, created_at")
      .eq("restaurant_id", inserted.id)
      .eq("user_id", user.id)
      .maybeSingle<MembershipRow>();

    if (membershipError) {
      console.error("[owner/restaurants][post] membership fetch failed", membershipError.message, {
        code: membershipError.code,
        details: membershipError.details,
        hint: membershipError.hint,
      });
    }

    return NextResponse.json(toResponse(inserted, membership ?? null), { status: 201 });
  } catch (error) {
    console.error("[owner/restaurants][post] unexpected", error, parsedBody ?? {});
    return errorResponse(500, "UNEXPECTED_ERROR", "We couldn’t create the restaurant. Please try again.");
  }
}
