import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database, Tables } from "@/types/supabase";
import { getServiceSupabaseClient } from "@/server/supabase";

type DbClient = SupabaseClient<Database, "public", any>;

export type CustomerWithProfile = {
  id: string;
  restaurantId: string;
  name: string;
  email: string;
  phone: string;
  marketingOptIn: boolean;
  createdAt: string;
  updatedAt: string;
  firstBookingAt: string | null;
  lastBookingAt: string | null;
  totalBookings: number;
  totalCovers: number;
  totalCancellations: number;
};

type CustomerRow = Tables<"customers"> & {
  customer_profiles:
    | (Tables<"customer_profiles"> | null)
    | (Tables<"customer_profiles"> | null)[]
    | null;
};

function normalizeCustomerProfile(row: CustomerRow): Tables<"customer_profiles"> | null {
  const relation = row.customer_profiles;
  if (Array.isArray(relation)) {
    return relation[0] ?? null;
  }
  return relation ?? null;
}

function mapCustomerRow(row: CustomerRow): CustomerWithProfile {
  const profile = normalizeCustomerProfile(row);

  return {
    id: row.id,
    restaurantId: row.restaurant_id,
    name: row.full_name,
    email: row.email,
    phone: row.phone,
    marketingOptIn: row.marketing_opt_in,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    firstBookingAt: profile?.first_booking_at ?? null,
    lastBookingAt: profile?.last_booking_at ?? null,
    totalBookings: profile?.total_bookings ?? 0,
    totalCovers: profile?.total_covers ?? 0,
    totalCancellations: profile?.total_cancellations ?? 0,
  };
}

type GetCustomersOptions = {
  restaurantId: string;
  page?: number;
  pageSize?: number;
  sortOrder?: "asc" | "desc";
  client?: DbClient;
  maxPageSize?: number;
};

type GetCustomersResult = {
  customers: CustomerWithProfile[];
  total: number;
  page: number;
  pageSize: number;
  hasNext: boolean;
};

export async function getCustomersWithProfiles(
  options: GetCustomersOptions,
): Promise<GetCustomersResult> {
  const client = options.client ?? getServiceSupabaseClient();
  const page = options.page ?? 1;
  const requestedPageSize = options.pageSize ?? 10;
  const maxPageSize = options.maxPageSize ?? 50;
  const pageSize = Math.min(requestedPageSize, Math.max(1, maxPageSize));
  const sortOrder = options.sortOrder ?? "desc";
  const offset = (page - 1) * pageSize;

  // Query customers with their profiles
  let query = client
    .from("customers")
    .select(
      `
      id,
      restaurant_id,
      full_name,
      email,
      phone,
      marketing_opt_in,
      created_at,
      updated_at,
      customer_profiles (
        first_booking_at,
        last_booking_at,
        total_bookings,
        total_covers,
        total_cancellations
      )
    `,
      { count: "exact" },
    )
    .eq("restaurant_id", options.restaurantId);

  // Apply pagination
  const { data, error, count } = await query
    .order("last_booking_at", {
      ascending: sortOrder === "asc",
      nullsFirst: false,
      foreignTable: "customer_profiles",
    })
    .range(offset, offset + pageSize - 1);

  if (error) {
    throw error;
  }

  const rows = (data ?? []) as CustomerRow[];
  const total = count ?? 0;

  // Transform to our CustomerWithProfile type
  const customers: CustomerWithProfile[] = rows.map(mapCustomerRow);

  const hasNext = offset + customers.length < total;

  return {
    customers,
    total,
    page,
    pageSize,
    hasNext,
  };
}

type GetAllCustomersOptions = GetCustomersOptions & {
  batchSize?: number;
};

export async function getAllCustomersWithProfiles(
  options: GetAllCustomersOptions,
): Promise<CustomerWithProfile[]> {
  const client = options.client ?? getServiceSupabaseClient();
  const sortOrder = options.sortOrder ?? "desc";
  const batchSize = Math.max(1, Math.min(options.batchSize ?? 500, 1000));

  let page = 1;
  let hasNext = true;
  const customers: CustomerWithProfile[] = [];

  while (hasNext) {
    const result = await getCustomersWithProfiles({
      restaurantId: options.restaurantId,
      page,
      pageSize: batchSize,
      maxPageSize: batchSize,
      sortOrder,
      client,
    });

    customers.push(...result.customers);
    hasNext = result.hasNext && result.customers.length > 0;

    if (!hasNext) {
      break;
    }

    page += 1;
  }

  return customers;
}
