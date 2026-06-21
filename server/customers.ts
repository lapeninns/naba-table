import {
  CUSTOMER_PHONE_LENGTH_MAX,
  CUSTOMER_PHONE_LENGTH_MIN,
  formatUKPhoneToE164,
  normalizeComparablePhone,
} from '@reserve/shared/validation';

import type { Database, Tables, TablesInsert, TablesUpdate } from '@/types/supabase';
import type { SupabaseClient } from '@supabase/supabase-js';

const CUSTOMER_COLUMNS =
  'id,restaurant_id,email,phone,full_name,marketing_opt_in,created_at,updated_at,email_normalized,phone_normalized,auth_user_id,user_profile_id,notes';

export type CustomerRow = Tables<'customers'>;

type DbClient = SupabaseClient<Database>;
type CustomerIdentityMatchMode = 'strict' | 'partial';

export function normalizeEmail(email: string | null | undefined): string {
  if (!email) return '';
  return email.trim().toLowerCase();
}

export function normalizePhone(phone: string | null | undefined): string {
  return normalizeComparablePhone(phone);
}

function sanitizePhoneValue(phone: string | null | undefined): string {
  if (!phone) return '';
  const trimmed = phone.trim();
  if (!trimmed) return '';

  // Canonicalize valid GB numbers to E.164 for consistency and DB safety.
  const canonical = formatUKPhoneToE164(trimmed) ?? trimmed;
  if (
    canonical.length < CUSTOMER_PHONE_LENGTH_MIN ||
    canonical.length > CUSTOMER_PHONE_LENGTH_MAX
  ) {
    throw new Error(
      `Phone must be between ${CUSTOMER_PHONE_LENGTH_MIN} and ${CUSTOMER_PHONE_LENGTH_MAX} characters`,
    );
  }
  return canonical;
}

function maskCustomerContactForLog(value: string): string | null {
  if (!value) {
    return null;
  }
  return value.includes('@') ? `${value.split('@')[0].slice(0, 2)}...` : '[redacted-phone]';
}

function customerUpdateSummaryForLog(updates: TablesUpdate<'customers'>): {
  fields: string[];
} {
  return {
    fields: Object.keys(updates).sort(),
  };
}

function dbErrorSummaryForLog(error: unknown): { code?: string; name?: string } {
  const record = error && typeof error === 'object' ? (error as Record<string, unknown>) : {};
  const code = typeof record.code === 'string' ? record.code : undefined;
  const name =
    error instanceof Error
      ? error.name
      : typeof record.name === 'string'
        ? record.name
        : undefined;
  return {
    ...(code ? { code } : {}),
    ...(name ? { name } : {}),
  };
}

async function findCustomerByNormalizedIdentity(
  client: DbClient,
  restaurantId: string,
  params: { email: string; phone: string },
  options: { matchMode?: CustomerIdentityMatchMode } = {},
): Promise<CustomerRow | null> {
  const matchMode = options.matchMode ?? 'strict';

  if (matchMode === 'strict' && params.email && params.phone) {
    const { data, error } = await client
      .from('customers')
      .select(CUSTOMER_COLUMNS)
      .eq('restaurant_id', restaurantId)
      .eq('email_normalized', params.email)
      .eq('phone_normalized', params.phone)
      .maybeSingle();

    if (error && error.code !== 'PGRST116') {
      console.error(`[upsertCustomer] Strict contact lookup error`, error);
      throw error;
    }

    return (data as CustomerRow | null) ?? null;
  }

  if (params.email) {
    const { data, error } = await client
      .from('customers')
      .select(CUSTOMER_COLUMNS)
      .eq('restaurant_id', restaurantId)
      .eq('email_normalized', params.email)
      .maybeSingle();

    if (error && error.code !== 'PGRST116') {
      console.error(`[upsertCustomer] Email lookup error`, error);
      throw error;
    }

    if (data) {
      return data as CustomerRow;
    }
  }

  if (params.phone) {
    const { data, error } = await client
      .from('customers')
      .select(CUSTOMER_COLUMNS)
      .eq('restaurant_id', restaurantId)
      .eq('phone_normalized', params.phone)
      .maybeSingle();

    if (error && error.code !== 'PGRST116') {
      console.error(`[upsertCustomer] Phone lookup error`, error);
      throw error;
    }

    if (data) {
      return data as CustomerRow;
    }
  }

  return null;
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

  let query = client.from('customers').select(CUSTOMER_COLUMNS).eq('restaurant_id', restaurantId);

  if (normalizedEmail) {
    query = query.eq('email_normalized', normalizedEmail);
  }

  if (normalizedPhone) {
    query = query.eq('phone_normalized', normalizedPhone);
  }

  const { data, error } = await query.maybeSingle();

  if (error && error.code !== 'PGRST116') {
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
    identityMatchMode?: CustomerIdentityMatchMode;
    allowExistingUpdates?: boolean;
  },
): Promise<CustomerRow> {
  const normalizedEmail = normalizeEmail(params.email);
  const normalizedPhone = normalizePhone(params.phone);
  const phoneForStorage = sanitizePhoneValue(params.phone);
  const marketingOptIn = params.marketingOptIn ?? false;
  const identityMatchMode = params.identityMatchMode ?? 'strict';
  const allowExistingUpdates = params.allowExistingUpdates ?? false;

  // Validate at least one contact method exists
  if (!normalizedEmail && !normalizedPhone) {
    throw new Error('At least one contact method (email or phone) is required');
  }

  console.log(`[upsertCustomer] Resolving customer`, {
    restaurantId: params.restaurantId,
    email: maskCustomerContactForLog(normalizedEmail),
    phone: maskCustomerContactForLog(normalizedPhone),
  });

  let customerData = await findCustomerByNormalizedIdentity(
    client,
    params.restaurantId,
    {
      email: normalizedEmail,
      phone: normalizedPhone,
    },
    {
      matchMode: identityMatchMode,
    },
  );

  if (customerData) {
    console.log(`[upsertCustomer] Found existing customer: ${customerData.id}`);
    // 2. Update existing customer only when the caller is trusted to backfill profile fields.
    const updates: TablesUpdate<'customers'> = {};

    if (allowExistingUpdates) {
      if (!customerData.full_name && params.name) {
        updates.full_name = params.name;
      }

      if (marketingOptIn && !customerData.marketing_opt_in) {
        updates.marketing_opt_in = true;
      }

      if (!customerData.phone_normalized && normalizedPhone) {
        updates.phone = phoneForStorage;
      }
    }

    if (Object.keys(updates).length > 0) {
      console.log(
        `[upsertCustomer] Updating customer: ${customerData.id}`,
        customerUpdateSummaryForLog(updates),
      );
      const { data: updated, error: updateError } = await client
        .from('customers')
        .update(updates)
        .eq('id', customerData.id)
        .select(CUSTOMER_COLUMNS)
        .single();

      if (updateError) {
        if (updateError.code === '23505' && updates.phone) {
          console.warn(
            `[upsertCustomer] Skipping conflicting phone update`,
            dbErrorSummaryForLog(updateError),
          );
          return customerData;
        }
        console.error(`[upsertCustomer] Update error`, dbErrorSummaryForLog(updateError));
        throw updateError;
      }
      customerData = updated as CustomerRow;
    }
  } else {
    console.log(`[upsertCustomer] No existing customer found, inserting new.`);
    // 3. Insert new customer
    const insertPayload: TablesInsert<'customers'> = {
      restaurant_id: params.restaurantId,
      email: normalizedEmail,
      phone: phoneForStorage,
      full_name: params.name || '',
      marketing_opt_in: marketingOptIn,
    };

    if (params.authUserId) insertPayload.auth_user_id = params.authUserId;
    if (params.userProfileId) insertPayload.user_profile_id = params.userProfileId;

    const { data: inserted, error: insertError } = await client
      .from('customers')
      .insert(insertPayload)
      .select(CUSTOMER_COLUMNS)
      .single();

    if (insertError) {
      console.warn(
        `[upsertCustomer] Insert error`,
        dbErrorSummaryForLog(insertError),
      );
      // Final fallback for race conditions
      if (insertError.code === '23505') {
        console.log(`[upsertCustomer] Race condition detected, retrying find.`);
        const secondFind = await findCustomerByNormalizedIdentity(
          client,
          params.restaurantId,
          {
            email: normalizedEmail,
            phone: normalizedPhone,
          },
          {
            matchMode: identityMatchMode,
          },
        );

        if (secondFind) {
          return secondFind;
        }
      }
      throw insertError;
    }
    customerData = inserted as CustomerRow;
    console.log(`[upsertCustomer] Created new customer: ${customerData.id}`);
  }

  if (!customerData) {
    throw new Error('Failed to resolve customer record');
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
    status: Tables<'bookings'>['status'];
  },
): Promise<void> {
  const { error } = await (
    client as unknown as {
      rpc: (
        fn: string,
        args: Record<string, unknown>,
      ) => Promise<{ data: unknown; error: unknown }>;
    }
  ).rpc('record_booking_for_customer_profile_atomic', {
    p_customer_id: params.customerId,
    p_created_at: params.createdAt,
    p_party_size: params.partySize,
    p_marketing_opt_in: params.marketingOptIn,
    p_is_cancelled: params.status === 'cancelled',
  });

  if (error) {
    throw error;
  }
}

export async function recordCancellationForCustomerProfile(
  client: DbClient,
  params: { customerId: string; cancelledAt: string },
): Promise<void> {
  const { error } = await (
    client as unknown as {
      rpc: (
        fn: string,
        args: Record<string, unknown>,
      ) => Promise<{ data: unknown; error: unknown }>;
    }
  ).rpc('record_cancellation_for_customer_profile_atomic', {
    p_customer_id: params.customerId,
    p_cancelled_at: params.cancelledAt,
  });

  if (error) {
    throw error;
  }
}
