import {
  buildCustomerHistoryRecords,
  filterCustomerHistoryRecords,
  isCustomerHistoryBookingStatus,
  sortCustomerHistoryRecords,
  summarizeCustomerHistoryRecords,
  type CustomerBookingRecord,
  type CustomerHistoryLastVisitFilter,
  type CustomerHistoryMarketingFilter,
  type CustomerHistoryRecord,
  type CustomerHistorySortBy,
  type CustomerHistorySortOrder,
  type CustomerIdentityRecord,
} from '@/lib/ops/customer-history';
import { getServiceSupabaseClient } from '@/server/supabase';

import type { OpsCustomersSummary } from '@/types/ops';
import type { Database, Tables } from '@/types/supabase';
import type { SupabaseClient } from '@supabase/supabase-js';

type DbClient = SupabaseClient<Database, 'public'>;

export type CustomerGuestRecord = CustomerHistoryRecord;

type GetCustomersOptions = {
  restaurantId: string;
  page?: number;
  pageSize?: number;
  sortOrder?: CustomerHistorySortOrder;
  sortBy?: CustomerHistorySortBy;
  search?: string | null;
  marketingOptIn?: CustomerHistoryMarketingFilter;
  lastVisit?: CustomerHistoryLastVisitFilter;
  minBookings?: number;
  client?: DbClient;
  maxPageSize?: number;
  includeSummary?: boolean;
  now?: Date;
};

type GetCustomersResult = {
  customers: CustomerGuestRecord[];
  total: number;
  page: number;
  pageSize: number;
  hasNext: boolean;
  summary?: OpsCustomersSummary;
};

type GetAllCustomersOptions = GetCustomersOptions;

type CustomerIdentityRow = Pick<
  Tables<'customers'>,
  'id' | 'restaurant_id' | 'full_name' | 'email' | 'phone' | 'marketing_opt_in' | 'created_at' | 'updated_at'
>;

type BookingHistoryRow = Pick<
  Tables<'bookings'>,
  'id' | 'customer_id' | 'restaurant_id' | 'status' | 'party_size' | 'created_at' | 'start_at'
>;

type CustomerHistoryFeedRow =
  Database['public']['Functions']['ops_customers_history_feed']['Returns'][number];
type CustomerHistorySummaryRow =
  Database['public']['Functions']['ops_customers_history_summary']['Returns'][number];

const CUSTOMER_ID_CHUNK_SIZE = 500;
const CUSTOMER_FETCH_BATCH_SIZE = 1000;
const BOOKING_FETCH_BATCH_SIZE = 1000;
const RPC_EXPORT_BATCH_SIZE = 500;

function normalizePage(page: number | undefined): number {
  return Math.max(1, page ?? 1);
}

function normalizePageSize(requestedPageSize: number | undefined, maxPageSize: number | undefined): number {
  const requested = requestedPageSize ?? 10;
  const maximum = Math.max(1, maxPageSize ?? 50);
  return Math.min(requested, maximum);
}

function normalizeOptionalString(value: string | null | undefined): string | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function isCustomersHistoryRpcUnavailable(error: unknown): boolean {
  if (!error || typeof error !== 'object') {
    return false;
  }

  const anyError = error as {
    code?: unknown;
    message?: unknown;
    details?: unknown;
    hint?: unknown;
  };
  const code = typeof anyError.code === 'string' ? anyError.code : '';
  const message = typeof anyError.message === 'string' ? anyError.message : '';
  const details = typeof anyError.details === 'string' ? anyError.details : '';
  const hint = typeof anyError.hint === 'string' ? anyError.hint : '';

  const haystack = `${code} ${message} ${details} ${hint}`.toLowerCase();

  return (
    haystack.includes('schema cache') ||
    haystack.includes('could not find') ||
    haystack.includes('does not exist') ||
    haystack.includes('function') ||
    haystack.includes('42883')
  );
}

function mapCustomerHistoryFeedRow(row: CustomerHistoryFeedRow): CustomerGuestRecord {
  return {
    id: row.id,
    restaurantId: row.restaurant_id,
    name: row.name,
    email: row.email,
    phone: row.phone,
    marketingOptIn: row.marketing_opt_in,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    firstBookingAt: row.first_booking_at,
    lastVisitAt: row.last_visit_at,
    totalBookings: row.total_bookings,
    totalCovers: row.total_covers,
    totalCancellations: row.total_cancellations,
  };
}

function emptyCustomersSummary(): OpsCustomersSummary {
  return {
    total: 0,
    optedIn: 0,
    optedOut: 0,
    returning: 0,
    vip: 0,
    neverVisited: 0,
  };
}

function mapCustomerHistorySummaryRow(row: CustomerHistorySummaryRow | null | undefined): OpsCustomersSummary {
  if (!row) {
    return emptyCustomersSummary();
  }

  return {
    total: row.total,
    optedIn: row.opted_in,
    optedOut: row.opted_out,
    returning: row.returning,
    vip: row.vip,
    neverVisited: row.never_visited,
  };
}

function escapeIlikeTerm(term: string): string | null {
  const trimmed = term.trim();
  if (!trimmed) {
    return null;
  }

  const escaped = trimmed.replace(/[%_]/g, '\\$&');
  return `%${escaped}%`;
}

function buildCustomerIdentityQuery(
  client: DbClient,
  restaurantId: string,
  options: {
    search?: string | null;
    marketingOptIn: CustomerHistoryMarketingFilter;
  },
) {
  let query = client
    .from('customers')
    .select(
      'id, restaurant_id, full_name, email, phone, marketing_opt_in, created_at, updated_at',
    )
    .eq('restaurant_id', restaurantId);

  if (options.marketingOptIn === 'opted_in') {
    query = query.eq('marketing_opt_in', true);
  } else if (options.marketingOptIn === 'opted_out') {
    query = query.eq('marketing_opt_in', false);
  }

  const searchPattern = escapeIlikeTerm(options.search ?? '');
  if (searchPattern) {
    query = query.or(
      `full_name.ilike.${searchPattern},email.ilike.${searchPattern},phone.ilike.${searchPattern}`,
    );
  }

  return query;
}

async function fetchQueryPages<TRow>(
  queryFactory: () => {
    range(from: number, to: number): PromiseLike<{ data: TRow[] | null; error: unknown }>;
  },
  batchSize: number,
): Promise<TRow[]> {
  const rows: TRow[] = [];
  let offset = 0;

  while (true) {
    const { data, error } = await queryFactory().range(offset, offset + batchSize - 1);
    if (error) {
      throw error;
    }

    const page = data ?? [];
    rows.push(...page);

    if (page.length < batchSize) {
      break;
    }

    offset += batchSize;
  }

  return rows;
}

function mapCustomerIdentityRows(rows: CustomerIdentityRow[]): CustomerIdentityRecord[] {
  return rows.map((row) => ({
    id: row.id,
    restaurantId: row.restaurant_id,
    name: row.full_name,
    email: row.email,
    phone: row.phone,
    marketingOptIn: row.marketing_opt_in,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));
}

function mapBookingHistoryRows(rows: BookingHistoryRow[]): CustomerBookingRecord[] {
  const records: CustomerBookingRecord[] = [];

  for (const row of rows) {
    if (!isCustomerHistoryBookingStatus(row.status)) {
      continue;
    }

    records.push({
      id: row.id,
      customerId: row.customer_id,
      restaurantId: row.restaurant_id,
      status: row.status,
      partySize: row.party_size,
      createdAt: row.created_at,
      startAt: row.start_at ?? null,
    });
  }

  return records;
}

async function fetchCustomerIdentitiesFallback(
  client: DbClient,
  restaurantId: string,
  options: {
    search?: string | null;
    marketingOptIn: CustomerHistoryMarketingFilter;
  },
): Promise<CustomerIdentityRecord[]> {
  const rows = await fetchQueryPages<CustomerIdentityRow>(
    () =>
      buildCustomerIdentityQuery(client, restaurantId, options).order('id', {
        ascending: true,
      }),
    CUSTOMER_FETCH_BATCH_SIZE,
  );

  return mapCustomerIdentityRows(rows);
}

async function fetchBookingsForCustomerIdsFallback(
  client: DbClient,
  restaurantId: string,
  customerIds: string[],
): Promise<CustomerBookingRecord[]> {
  if (customerIds.length === 0) {
    return [];
  }

  const bookingRows: CustomerBookingRecord[] = [];

  for (let index = 0; index < customerIds.length; index += CUSTOMER_ID_CHUNK_SIZE) {
    const chunk = customerIds.slice(index, index + CUSTOMER_ID_CHUNK_SIZE);
    const rows = await fetchQueryPages<BookingHistoryRow>(
      () =>
        client
          .from('bookings')
          .select('id, customer_id, restaurant_id, status, party_size, created_at, start_at')
          .eq('restaurant_id', restaurantId)
          .in('customer_id', chunk)
          .order('id', { ascending: true }),
      BOOKING_FETCH_BATCH_SIZE,
    );

    bookingRows.push(...mapBookingHistoryRows(rows));
  }

  return bookingRows;
}

function paginateCustomerHistory(
  records: CustomerGuestRecord[],
  page: number,
  pageSize: number,
): {
  pageItems: CustomerGuestRecord[];
  total: number;
  hasNext: boolean;
} {
  const total = records.length;
  const offset = (page - 1) * pageSize;
  const pageItems = records.slice(offset, offset + pageSize);
  const hasNext = offset + pageItems.length < total;

  return {
    pageItems,
    total,
    hasNext,
  };
}

async function getCustomersWithHistoryFallback(
  options: GetCustomersOptions,
): Promise<GetCustomersResult> {
  const client = options.client ?? getServiceSupabaseClient();
  const page = normalizePage(options.page);
  const pageSize = normalizePageSize(options.pageSize, options.maxPageSize);
  const sortOrder = options.sortOrder ?? 'desc';
  const sortBy = options.sortBy ?? 'last_visit';
  const marketingOptIn = options.marketingOptIn ?? 'all';
  const lastVisit = options.lastVisit ?? 'any';
  const minBookings = Math.max(0, options.minBookings ?? 0);
  const now = options.now ?? new Date();

  const customerRows = await fetchCustomerIdentitiesFallback(client, options.restaurantId, {
    search: options.search ?? null,
    marketingOptIn,
  });

  if (customerRows.length === 0) {
    return {
      customers: [],
      total: 0,
      page,
      pageSize,
      hasNext: false,
      summary: options.includeSummary ? emptyCustomersSummary() : undefined,
    };
  }

  const bookingRows = await fetchBookingsForCustomerIdsFallback(
    client,
    options.restaurantId,
    customerRows.map((row) => row.id),
  );

  const historyRecords = buildCustomerHistoryRecords(customerRows, bookingRows, now);
  const filteredRecords = filterCustomerHistoryRecords(
    historyRecords,
    {
      lastVisit,
      minBookings,
    },
    now,
  );
  const sortedRecords = sortCustomerHistoryRecords(filteredRecords, sortBy, sortOrder);
  const { pageItems, total, hasNext } = paginateCustomerHistory(sortedRecords, page, pageSize);

  return {
    customers: pageItems,
    total,
    page,
    pageSize,
    hasNext,
    summary: options.includeSummary ? summarizeCustomerHistoryRecords(filteredRecords) : undefined,
  };
}

async function getCustomersWithHistoryFromRpc(
  options: GetCustomersOptions,
): Promise<GetCustomersResult> {
  const client = options.client ?? getServiceSupabaseClient();
  const page = normalizePage(options.page);
  const pageSize = normalizePageSize(options.pageSize, options.maxPageSize);
  const sortOrder = options.sortOrder ?? 'desc';
  const sortBy = options.sortBy ?? 'last_visit';
  const marketingOptIn = options.marketingOptIn ?? 'all';
  const lastVisit = options.lastVisit ?? 'any';
  const minBookings = Math.max(0, options.minBookings ?? 0);

  const { data: feedData, error: feedError } = await client.rpc('ops_customers_history_feed', {
    p_restaurant_id: options.restaurantId,
    p_search: normalizeOptionalString(options.search),
    p_marketing_opt_in: marketingOptIn,
    p_last_visit: lastVisit,
    p_min_bookings: minBookings,
    p_sort_by: sortBy,
    p_sort_order: sortOrder,
    p_page: page,
    p_page_size: pageSize,
  });

  if (feedError) {
    throw feedError;
  }

  const feedRows = Array.isArray(feedData) ? (feedData as CustomerHistoryFeedRow[]) : [];
  const hasNext = feedRows.length > pageSize;
  const pageRows = hasNext ? feedRows.slice(0, pageSize) : feedRows;
  const total = pageRows[0]?.total_count ?? 0;

  let summary: OpsCustomersSummary | undefined;
  if (options.includeSummary) {
    const { data: summaryData, error: summaryError } = await client.rpc(
      'ops_customers_history_summary',
      {
        p_restaurant_id: options.restaurantId,
        p_search: normalizeOptionalString(options.search),
        p_marketing_opt_in: marketingOptIn,
        p_last_visit: lastVisit,
        p_min_bookings: minBookings,
      },
    );

    if (summaryError) {
      throw summaryError;
    }

    const summaryRow = Array.isArray(summaryData)
      ? (summaryData[0] as CustomerHistorySummaryRow | undefined)
      : (summaryData as CustomerHistorySummaryRow | null | undefined);
    summary = mapCustomerHistorySummaryRow(summaryRow);
  }

  return {
    customers: pageRows.map(mapCustomerHistoryFeedRow),
    total,
    page,
    pageSize,
    hasNext,
    summary,
  };
}

export async function getCustomersWithHistory(
  options: GetCustomersOptions,
): Promise<GetCustomersResult> {
  try {
    return await getCustomersWithHistoryFromRpc(options);
  } catch (error) {
    if (isCustomersHistoryRpcUnavailable(error)) {
      return getCustomersWithHistoryFallback(options);
    }

    throw error;
  }
}

export async function getAllCustomersWithHistory(
  options: GetAllCustomersOptions,
): Promise<CustomerGuestRecord[]> {
  const customers: CustomerGuestRecord[] = [];
  let page = 1;
  let hasNext = true;

  while (hasNext) {
    const result = await getCustomersWithHistory({
      ...options,
      page,
      pageSize: RPC_EXPORT_BATCH_SIZE,
      maxPageSize: RPC_EXPORT_BATCH_SIZE,
      includeSummary: false,
    });

    customers.push(...result.customers);
    hasNext = result.hasNext && result.customers.length > 0;
    page += 1;
  }

  return customers;
}
