import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database, Tables, TablesInsert } from "@/types/supabase";

const CUSTOMER_CONFLICT_KEY = "restaurant_id,email_normalized,phone_normalized";
const CUSTOMER_CONFLICT_FALLBACK_KEYS = [
  "restaurant_id,email_normalized",
  "restaurant_id,phone_normalized",
];
const CUSTOMER_COLUMNS =
  "id,restaurant_id,email,phone,full_name,marketing_opt_in,created_at,updated_at,email_normalized,phone_normalized";

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
    .select(CUSTOMER_COLUMNS)
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
    .select(CUSTOMER_COLUMNS)
    .maybeSingle();

  const isMissingConflictConstraintError = (value: unknown): boolean => {
    if (!value || typeof value !== "object") {
      return false;
    }
    const record = value as { code?: unknown; message?: unknown };
    const code = typeof record.code === "string" ? record.code : "";
    if (code === "42P10") {
      return true;
    }
    const message = typeof record.message === "string" ? record.message : "";
    return /no unique or exclusion constraint matching the on conflict specification/i.test(message);
  };

  let customerData = data;
  let lastError = error ?? null;

  if (error && isMissingConflictConstraintError(error)) {
    // Some environments may be missing the composite conflict target. Retry with the available uniques.
    for (const fallbackKey of CUSTOMER_CONFLICT_FALLBACK_KEYS) {
      const { data: fallbackData, error: fallbackError } = await client
        .from("customers")
        .upsert(insertPayload, {
          onConflict: fallbackKey,
          ignoreDuplicates: false,
        })
        .select(CUSTOMER_COLUMNS)
        .maybeSingle();

      customerData = fallbackData;
      lastError = fallbackError ?? null;

      if (!fallbackError) {
        break;
      }

      if (!isMissingConflictConstraintError(fallbackError)) {
        break;
      }
    }
  }

  const isUniqueViolationError = (value: unknown): boolean => {
    if (!value || typeof value !== "object") {
      return false;
    }
    const record = value as { code?: unknown };
    return record.code === "23505";
  };

  if (lastError && isUniqueViolationError(lastError)) {
    const { data: existing, error: existingError } = await client
      .from("customers")
      .select(CUSTOMER_COLUMNS)
      .eq("restaurant_id", params.restaurantId)
      .eq("email_normalized", email)
      .maybeSingle();

    if (existingError && existingError.code !== "PGRST116") {
      throw existingError;
    }

    if (existing) {
      customerData = existing;
      lastError = null;

      const existingNormalizedPhone = normalizePhone(existing.phone);
      const incomingNormalizedPhone = normalizePhone(params.phone);

      if (incomingNormalizedPhone && existingNormalizedPhone !== incomingNormalizedPhone) {
        const { data: updated, error: phoneUpdateError } = await client
          .from("customers")
          .update({ phone: phoneForStorage })
          .eq("id", existing.id)
          .select(CUSTOMER_COLUMNS)
          .single();

        if (!phoneUpdateError && updated) {
          customerData = updated;
        }
      }
    }
  }

  if (lastError) {
    throw lastError;
  }

  if (!customerData) {
    throw new Error("Failed to upsert customer contact");
  }

  // Ensure marketing opt-in is sticky when true.
  if (marketingOptIn && !customerData.marketing_opt_in) {
    const { data: patched, error: updateError } = await client
      .from("customers")
      .update({ marketing_opt_in: true, full_name: customerData.full_name ?? params.name ?? null })
      .eq("id", customerData.id)
      .select(CUSTOMER_COLUMNS)
      .single();

    if (updateError) {
      throw updateError;
    }

    return patched as CustomerRow;
  }

  if (!customerData.full_name && params.name) {
    const { data: patched, error: nameUpdateError } = await client
      .from("customers")
      .update({ full_name: params.name })
      .eq("id", customerData.id)
      .select(CUSTOMER_COLUMNS)
      .single();

    if (!nameUpdateError && patched) {
      return patched as CustomerRow;
    }
  }

  return customerData as CustomerRow;
}

export async function recordBookingForCustomerProfile(
  client: DbClient,
  params: {
    customerId: string;
    createdAt: string;
    partySize: number;
    marketingOptIn: boolean;
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
