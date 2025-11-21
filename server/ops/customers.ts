import { getServiceSupabaseClient } from "@/server/supabase";

import type { Database, Tables } from "@/types/supabase";
import type { SupabaseClient } from "@supabase/supabase-js";


type DbClient = SupabaseClient<Database, "public">;

type MarketingOptInFilter = "all" | "opted_in" | "opted_out";
type LastVisitFilter = "any" | "30d" | "90d" | "365d" | "never";
type CustomerSortBy = "last_visit" | "bookings";

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

function escapeIlikeTerm(term: string): string | null {
  const trimmed = term.trim();
  if (!trimmed) return null;

  const escaped = trimmed.replace(/[%_]/g, "\\$&");
  return `%${escaped}%`;
}

function resolveLastVisitCutoff(lastVisit: LastVisitFilter): string | null {
  const daysLookup: Record<Exclude<LastVisitFilter, "any" | "never">, number> = {
    "30d": 30,
    "90d": 90,
    "365d": 365,
  };

  const days = daysLookup[lastVisit as keyof typeof daysLookup];
  if (!days) return null;

  const date = new Date();
  date.setDate(date.getDate() - days);
  return date.toISOString();
}

type GetCustomersOptions = {
  restaurantId: string;
  page?: number;
  pageSize?: number;
  sortOrder?: "asc" | "desc";
  sortBy?: CustomerSortBy;
  search?: string | null;
  marketingOptIn?: MarketingOptInFilter;
  lastVisit?: LastVisitFilter;
  minBookings?: number;
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
  const sortBy = options.sortBy ?? "last_visit";
  const marketingOptIn = options.marketingOptIn ?? "all";
  const lastVisit = options.lastVisit ?? "any";
  const minBookings = Math.max(0, options.minBookings ?? 0);
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

  if (marketingOptIn === "opted_in") {
    query = query.eq("marketing_opt_in", true);
  } else if (marketingOptIn === "opted_out") {
    query = query.eq("marketing_opt_in", false);
  }

  if (minBookings > 0) {
    query = query.gte("customer_profiles.total_bookings", minBookings);
  }

  if (lastVisit === "never") {
    query = query.is("customer_profiles.last_booking_at", null);
  } else {
    const cutoff = resolveLastVisitCutoff(lastVisit);
    if (cutoff) {
      query = query.gte("customer_profiles.last_booking_at", cutoff);
    }
  }

  const searchPattern = escapeIlikeTerm(options.search ?? "");
  if (searchPattern) {
    query = query.or(
      `full_name.ilike.${searchPattern},email.ilike.${searchPattern},phone.ilike.${searchPattern}`,
    );
  }

  // Apply pagination
  const orderColumn = sortBy === "bookings" ? "total_bookings" : "last_booking_at";
  const { data, error, count } = await query
    .order(orderColumn, {
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
      sortBy: options.sortBy,
      marketingOptIn: options.marketingOptIn,
      lastVisit: options.lastVisit,
      minBookings: options.minBookings,
      search: options.search,
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
