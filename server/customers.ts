import {
  CUSTOMER_PHONE_LENGTH_MAX,
  CUSTOMER_PHONE_LENGTH_MIN,
  formatUKPhoneToE164,
  normalizeComparablePhone,
} from "@reserve/shared/validation";

import type { Database, Tables, TablesInsert, TablesUpdate } from "@/types/supabase";
import type { SupabaseClient } from "@supabase/supabase-js";

const CUSTOMER_COLUMNS =
  "id,restaurant_id,email,phone,full_name,marketing_opt_in,created_at,updated_at,email_normalized,phone_normalized,auth_user_id,user_profile_id,notes";

export type CustomerRow = Tables<"customers">;

type DbClient = SupabaseClient<Database>;

export function normalizeEmail(email: string | null | undefined): string {
  if (!email) return '';
  return email.trim().toLowerCase();
}

export function normalizePhone(phone: string | null | undefined): string {
  return normalizeComparablePhone(phone);
}

function buildCustomerOrFilter(email: string, phone: string): string {
  const filters: string[] = [];

  if (email) {
    filters.push(`email_normalized.eq."${email}"`);
  }

  if (phone) {
    filters.push(`phone_normalized.eq."${phone}"`);
  }

  if (filters.length === 0) {
    throw new Error('At least one normalized contact method is required');
  }

  return filters.join(',');
}

function contactsMatchExisting(
  existing: Pick<CustomerRow, "email_normalized" | "phone_normalized">,
  params: { email: string; phone: string },
): boolean {
  if (params.email && params.phone) {
    return existing.email_normalized === params.email && existing.phone_normalized === params.phone;
  }
  if (params.email) return existing.email_normalized === params.email;
  if (params.phone) return existing.phone_normalized === params.phone;
  return false;
}

function sanitizePhoneValue(phone: string | null | undefined): string {
  if (!phone) return '';
  const trimmed = phone.trim();
  if (!trimmed) return '';

  // Canonicalize valid GB numbers to E.164 for consistency and DB safety.
  const canonical = formatUKPhoneToE164(trimmed) ?? trimmed;
  if (canonical.length < CUSTOMER_PHONE_LENGTH_MIN || canonical.length > CUSTOMER_PHONE_LENGTH_MAX) {
    throw new Error(
      `Phone must be between ${CUSTOMER_PHONE_LENGTH_MIN} and ${CUSTOMER_PHONE_LENGTH_MAX} characters`,
    );
  }
  return canonical;
}

export async function findCustomerByContact(
  client: DbClient,
  restaurantId: string,
  email: string,
  phone: string,
): Promise<CustomerRow | null> {
  const normalizedEmail = normalizeEmail(email);
  const normalizedPhone = normalizePhone(phone);

  if (!normalizedEmail && !normalizedPhone) {
    return null;
  }

  let query = client
    .from("customers")
    .select(CUSTOMER_COLUMNS)
    .eq("restaurant_id", restaurantId);

  if (normalizedEmail) {
    query = query.eq("email_normalized", normalizedEmail);
  }

  if (normalizedPhone) {
    query = query.eq("phone_normalized", normalizedPhone);
  }

  const { data, error } = await query.maybeSingle();

  if (error && error.code !== "PGRST116") {
    throw error;
  }

  return (data as CustomerRow | null) ?? null;
}

export async function upsertCustomer(
  client: DbClient,
  params: {
    restaurantId: string;
    email: string | null;
    phone: string | null;
    name?: string | null;
    marketingOptIn?: boolean;
    authUserId?: string | null;
    userProfileId?: string | null;
  },
): Promise<CustomerRow> {
  const normalizedEmail = normalizeEmail(params.email);
  const normalizedPhone = normalizePhone(params.phone);
  const phoneForStorage = sanitizePhoneValue(params.phone);
  const marketingOptIn = params.marketingOptIn ?? false;

  // Validate at least one contact method exists
  if (!normalizedEmail && !normalizedPhone) {
    throw new Error('At least one contact method (email or phone) is required');
  }

  console.log(`[upsertCustomer] Resolving customer`, {
    restaurantId: params.restaurantId,
    email: normalizedEmail,
    phone: normalizedPhone
  });

  let lookup = client
    .from("customers")
    .select(CUSTOMER_COLUMNS)
    .eq("restaurant_id", params.restaurantId);

  if (normalizedEmail && normalizedPhone) {
    lookup = lookup.eq("email_normalized", normalizedEmail).eq("phone_normalized", normalizedPhone);
  } else {
    lookup = lookup.or(buildCustomerOrFilter(normalizedEmail, normalizedPhone));
  }

  const { data: existing, error: findError } = await lookup
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (findError && findError.code !== "PGRST116") {
    console.error(`[upsertCustomer] Find error`, findError);
    throw findError;
  }

  let customerData: CustomerRow | null = existing as CustomerRow | null;

  if (existing && contactsMatchExisting(existing as CustomerRow, { email: normalizedEmail, phone: normalizedPhone })) {
    console.log(`[upsertCustomer] Found existing customer: ${existing.id}`);
    // 2. Update existing customer
    const updates: TablesUpdate<"customers"> = {};

    if (!existing.full_name && params.name) {
      updates.full_name = params.name;
    }

    if (marketingOptIn && !existing.marketing_opt_in) {
      updates.marketing_opt_in = true;
    }

    if (!existing.phone_normalized && normalizedPhone) {
      updates.phone = phoneForStorage;
    }

    if (Object.keys(updates).length > 0) {
      console.log(`[upsertCustomer] Updating customer: ${existing.id}`, updates);
      const { data: updated, error: updateError } = await client
        .from("customers")
        .update(updates)
        .eq("id", existing.id)
        .select(CUSTOMER_COLUMNS)
        .single();

      if (updateError) {
        console.error(`[upsertCustomer] Update error`, updateError);
        throw updateError;
      }
      customerData = updated as CustomerRow;
    }
  } else {
    console.log(`[upsertCustomer] No existing customer found, inserting new.`);
    // 3. Insert new customer
    const insertPayload: TablesInsert<"customers"> = {
      restaurant_id: params.restaurantId,
      email: normalizedEmail,
      phone: phoneForStorage,
      full_name: params.name || '',
      marketing_opt_in: marketingOptIn,
    };

    if (params.authUserId) insertPayload.auth_user_id = params.authUserId;
    if (params.userProfileId) insertPayload.user_profile_id = params.userProfileId;

    const { data: inserted, error: insertError } = await client
      .from("customers")
      .insert(insertPayload)
      .select(CUSTOMER_COLUMNS)
      .single();

    if (insertError) {
      console.warn(`[upsertCustomer] Insert error (code ${insertError.code})`, insertError);
      // Final fallback for race conditions
      if (insertError.code === "23505") {
        console.log(`[upsertCustomer] Race condition detected, retrying find.`);
        let secondLookup = client
          .from("customers")
          .select(CUSTOMER_COLUMNS)
          .eq("restaurant_id", params.restaurantId);

        if (normalizedEmail && normalizedPhone) {
          secondLookup = secondLookup
            .eq("email_normalized", normalizedEmail)
            .eq("phone_normalized", normalizedPhone);
        } else {
          secondLookup = secondLookup.or(buildCustomerOrFilter(normalizedEmail, normalizedPhone));
        }

        const { data: secondFind } = await secondLookup.maybeSingle();

        if (
          secondFind &&
          contactsMatchExisting(secondFind as CustomerRow, {
            email: normalizedEmail,
            phone: normalizedPhone,
          })
        ) {
          return secondFind as CustomerRow;
        }
      }
      throw insertError;
    }
    customerData = inserted as CustomerRow;
    console.log(`[upsertCustomer] Created new customer: ${customerData.id}`);
  }

  if (!customerData) {
    throw new Error("Failed to resolve customer record");
  }

  return customerData;
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
