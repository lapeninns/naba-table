import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database, Tables, TablesInsert } from "@/types/supabase";

const CUSTOMER_CONFLICT_KEY = "restaurant_id,email_normalized,phone_normalized";

export type CustomerRow = Tables<"customers">;

type DbClient = SupabaseClient<Database, any, any>;

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function normalizePhone(phone: string): string {
  return phone.replace(/[^0-9]/g, "");
}

function sanitizePhoneValue(phone: string): string {
  return phone.trim();
}


export async function findCustomerByContact(
  client: DbClient,
  restaurantId: string,
  email: string,
  phone: string,
): Promise<CustomerRow | null> {
  const normalizedEmail = normalizeEmail(email);
  const normalizedPhone = normalizePhone(phone);

  const { data, error } = await client
    .from("customers")
    .select("id,restaurant_id,email,phone,full_name,marketing_opt_in,created_at,updated_at,email_normalized,phone_normalized")
    .eq("restaurant_id", restaurantId)
    .eq("email_normalized", normalizedEmail)
    .eq("phone_normalized", normalizedPhone)
    .maybeSingle();

  if (error && error.code !== "PGRST116") {
    throw error;
  }

  return (data as CustomerRow | null) ?? null;
}

export async function upsertCustomer(
  client: DbClient,
  params: {
    restaurantId: string;
    email: string;
    phone: string;
    name?: string | null;
    marketingOptIn?: boolean;
  },
): Promise<CustomerRow> {
  const email = normalizeEmail(params.email);
  const phoneForStorage = sanitizePhoneValue(params.phone);
  const marketingOptIn = params.marketingOptIn ?? false;

  const insertPayload: TablesInsert<"customers"> = {
    restaurant_id: params.restaurantId,
    email,
    phone: phoneForStorage,
    full_name: params.name ?? null,
    marketing_opt_in: marketingOptIn,
  };

  const { data, error } = await client
    .from("customers")
    .upsert(insertPayload, {
      onConflict: CUSTOMER_CONFLICT_KEY,
      ignoreDuplicates: false,
    })
    .select("id,restaurant_id,email,phone,full_name,marketing_opt_in,created_at,updated_at,email_normalized,phone_normalized")
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data) {
    throw new Error("Failed to upsert customer contact");
  }

  // Ensure marketing opt-in is sticky when true.
  if (marketingOptIn && !data.marketing_opt_in) {
    const { data: patched, error: updateError } = await client
      .from("customers")
      .update({ marketing_opt_in: true, full_name: data.full_name ?? params.name ?? null })
      .eq("id", data.id)
      .select("id,restaurant_id,email,phone,full_name,marketing_opt_in,created_at,updated_at,email_normalized,phone_normalized")
      .single();

    if (updateError) {
      throw updateError;
    }

    return patched as CustomerRow;
  }

  if (!data.full_name && params.name) {
    const { data: patched, error: nameUpdateError } = await client
      .from("customers")
      .update({ full_name: params.name })
      .eq("id", data.id)
      .select("id,restaurant_id,email,phone,full_name,marketing_opt_in,created_at,updated_at,email_normalized,phone_normalized")
      .single();

    if (!nameUpdateError && patched) {
      return patched as CustomerRow;
    }
  }

  return data as CustomerRow;
}

export async function recordBookingForCustomerProfile(
  client: DbClient,
  params: {
    customerId: string;
    createdAt: string;
    partySize: number;
    marketingOptIn: boolean;
    waitlisted: boolean;
    status: Tables<"bookings">["status"];
  },
): Promise<void> {
  const nowIso = new Date().toISOString();
  const { data: existing, error: lookupError } = await client
    .from("customer_profiles")
    .select("*")
    .eq("customer_id", params.customerId)
    .maybeSingle();

  if (lookupError) {
    throw lookupError;
  }

  const existingProfile = existing ?? null;
  const firstBookingAt = existingProfile?.first_booking_at ?? params.createdAt;
  const lastBookingAt = existingProfile?.last_booking_at ?? params.createdAt;
  const nextLastBooking = params.createdAt > lastBookingAt ? params.createdAt : lastBookingAt;
  const nextTotalBookings = (existingProfile?.total_bookings ?? 0) + 1;
  const nextTotalCovers = (existingProfile?.total_covers ?? 0) + params.partySize;
  const nextMarketingOptIn = (existingProfile?.marketing_opt_in ?? false) || params.marketingOptIn;
  const lastMarketingOptInAt = params.marketingOptIn
    ? params.createdAt
    : existingProfile?.last_marketing_opt_in_at ?? null;
  const lastWaitlistAt = params.waitlisted ? params.createdAt : existingProfile?.last_waitlist_at ?? null;
  const nextTotalCancellations =
    (existingProfile?.total_cancellations ?? 0) + (params.status === "cancelled" ? 1 : 0);

  const payload = {
    customer_id: params.customerId,
    first_booking_at: firstBookingAt,
    last_booking_at: nextLastBooking,
    total_bookings: nextTotalBookings,
    total_covers: nextTotalCovers,
    total_cancellations: nextTotalCancellations,
    marketing_opt_in: nextMarketingOptIn,
    last_marketing_opt_in_at: lastMarketingOptInAt,
    last_waitlist_at: lastWaitlistAt,
    updated_at: nowIso,
  };

  const { error: upsertError } = await client
    .from("customer_profiles")
    .upsert(payload, { onConflict: "customer_id" });

  if (upsertError) {
    throw upsertError;
  }
}

export async function recordCancellationForCustomerProfile(
  client: DbClient,
  params: { customerId: string; cancelledAt: string },
): Promise<void> {
  const { data: existing, error } = await client
    .from("customer_profiles")
    .select("total_cancellations,last_booking_at,updated_at")
    .eq("customer_id", params.customerId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  const totalCancellations = (existing?.total_cancellations ?? 0) + 1;
  const { error: updateError } = await client
    .from("customer_profiles")
    .upsert(
      {
        customer_id: params.customerId,
        total_cancellations: totalCancellations,
        last_booking_at: existing?.last_booking_at ?? params.cancelledAt,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "customer_id" },
    );

  if (updateError) {
    throw updateError;
  }
}
