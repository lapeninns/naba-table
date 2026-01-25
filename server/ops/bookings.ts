
import { env } from "@/lib/env";
import { logger } from "@/lib/logger";
import { getDateInTimezone } from "@/lib/utils/datetime";
import { LruCache } from "@/server/capacity/lru-cache";
import { getCustomerProfilesForCustomers } from "@/server/ops/customer-profiles";
import { getLoyaltyPointsForCustomers } from "@/server/ops/loyalty";
import { getServiceSupabaseClient } from "@/server/supabase";

import type { OpsTodayBooking, OpsTodayBookingsSummary } from "@/types/ops";
import type { Database, Tables } from "@/types/supabase";
import type { SupabaseClient } from "@supabase/supabase-js";

type DbClient = SupabaseClient<Database>;

const CANCELLED_STATUSES: Tables<"bookings">["status"][] = ["cancelled", "no_show"];

const opsCacheConfig = env.opsCache;
const SUMMARY_CACHE_TTL_MS = opsCacheConfig.summaryTtlMs;
const CHANGES_CACHE_TTL_MS = opsCacheConfig.changesTtlMs;
const RESTAURANT_META_CACHE_TTL_MS = opsCacheConfig.restaurantMetaTtlMs;
const OPS_CACHE_MAX_ENTRIES = opsCacheConfig.maxEntries;

const summaryCacheEnabled = SUMMARY_CACHE_TTL_MS > 0;
const changesCacheEnabled = CHANGES_CACHE_TTL_MS > 0;
const restaurantMetaCacheEnabled = RESTAURANT_META_CACHE_TTL_MS > 0;

const summaryCache = new LruCache<TodayBookingsSummary>(OPS_CACHE_MAX_ENTRIES, Math.max(SUMMARY_CACHE_TTL_MS, 1));
const summaryInFlight = new Map<string, Promise<TodayBookingsSummary>>();

type RestaurantMeta = {
  timezone: string;
};

const restaurantMetaCache = new LruCache<RestaurantMeta>(OPS_CACHE_MAX_ENTRIES, Math.max(RESTAURANT_META_CACHE_TTL_MS, 1));
const restaurantMetaInFlight = new Map<string, Promise<RestaurantMeta>>();

type BookingChangesPayload = BookingChangeFeedResponse;

const changesCache = new LruCache<BookingChangesPayload>(OPS_CACHE_MAX_ENTRIES, Math.max(CHANGES_CACHE_TTL_MS, 1));
const changesInFlight = new Map<string, Promise<BookingChangesPayload>>();

const opsLogger = logger.child({ module: "ops.bookings" });

type PreferencesJson = {
  allergies?: unknown;
  dietary_restrictions?: unknown;
  seating?: unknown;
  [key: string]: unknown;
};

function parsePreferences(preferencesJson: unknown): {
  allergies: string[] | null;
  dietaryRestrictions: string[] | null;
  seatingPreference: string | null;
} {
  if (!preferencesJson || typeof preferencesJson !== "object") {
    return { allergies: null, dietaryRestrictions: null, seatingPreference: null };
  }

  const prefs = preferencesJson as PreferencesJson;

  const allergies = Array.isArray(prefs.allergies)
    ? prefs.allergies.filter((item): item is string => typeof item === "string")
    : null;

  const dietaryRestrictions = Array.isArray(prefs.dietary_restrictions)
    ? prefs.dietary_restrictions.filter((item): item is string => typeof item === "string")
    : null;

  const seatingPreference = typeof prefs.seating === "string" ? prefs.seating : null;

  return {
    allergies: allergies && allergies.length > 0 ? allergies : null,
    dietaryRestrictions: dietaryRestrictions && dietaryRestrictions.length > 0 ? dietaryRestrictions : null,
    seatingPreference,
  };
}

function normalizeDetails(details: Tables<"bookings">["details"] | null | undefined): Record<string, unknown> | null {
  if (!details || typeof details !== "object" || Array.isArray(details)) {
    return null;
  }
  return details as Record<string, unknown>;
}

export type TodayBooking = OpsTodayBooking;

export type TodayBookingsSummary = OpsTodayBookingsSummary;

type BookingSummaryTableInventory = Pick<Tables<"table_inventory">, "table_number" | "capacity" | "section">;

type BookingSummaryTableAssignment = {
  table_id: string | null;
  table_inventory: BookingSummaryTableInventory | BookingSummaryTableInventory[] | null;
};

type BookingSummaryQueryRow = Pick<
  Tables<"bookings">,
  | "id"
  | "status"
  | "start_time"
  | "end_time"
  | "party_size"
  | "customer_name"
  | "customer_email"
  | "customer_phone"
  | "notes"
  | "reference"
  | "details"
  | "source"
  | "checked_in_at"
  | "checked_out_at"
  | "customer_id"
> & {
  booking_table_assignments: BookingSummaryTableAssignment[] | null;
};

type SummaryOptions = {
  client?: DbClient;
  referenceDate?: Date;
  targetDate?: string;
};

function resolveTimezone(value: string | null | undefined): string {
  return value && value.trim().length > 0 ? value : "UTC";
}

function isValidDateString(value: string | undefined): value is string {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function buildSummaryCacheKey(restaurantId: string, date: string): string {
  return `${restaurantId}:${date}`;
}

function buildChangesCacheKey(restaurantId: string, date: string, limit: number): string {
  return `${restaurantId}:${date}:limit=${limit}`;
}

export function invalidateOpsBookingsSummaryCache(restaurantId: string, date?: string | null): void {
  if (!summaryCacheEnabled || !restaurantId) return;

  if (date && isValidDateString(date)) {
    const key = buildSummaryCacheKey(restaurantId, date);
    summaryCache.delete(key);
    summaryInFlight.delete(key);
    return;
  }

  const prefix = `${restaurantId}:`;
  for (const key of summaryCache.keys()) {
    if (key.startsWith(prefix)) {
      summaryCache.delete(key);
      summaryInFlight.delete(key);
    }
  }
}

export function invalidateOpsBookingChangesCache(restaurantId: string, date?: string | null): void {
  if (!changesCacheEnabled || !restaurantId) return;

  const prefix = date && isValidDateString(date) ? `${restaurantId}:${date}:` : `${restaurantId}:`;
  for (const key of changesCache.keys()) {
    if (key.startsWith(prefix)) {
      changesCache.delete(key);
      changesInFlight.delete(key);
    }
  }
}

async function getRestaurantMeta(restaurantId: string, client: DbClient): Promise<RestaurantMeta> {
  if (restaurantMetaCacheEnabled) {
    const cached = restaurantMetaCache.get(restaurantId);
    if (cached) {
      return cached;
    }

    const pending = restaurantMetaInFlight.get(restaurantId);
    if (pending) {
      return pending;
    }
  }

  const fetchPromise = (async () => {
    const { data, error } = await client
      .from("restaurants")
      .select("timezone")
      .eq("id", restaurantId)
      .maybeSingle();

    if (error) {
      throw error;
    }

    const meta: RestaurantMeta = {
      timezone: resolveTimezone(data?.timezone),
    };

    if (restaurantMetaCacheEnabled) {
      restaurantMetaCache.set(restaurantId, meta, RESTAURANT_META_CACHE_TTL_MS);
    }

    return meta;
  })().finally(() => {
    restaurantMetaInFlight.delete(restaurantId);
  });

  if (restaurantMetaCacheEnabled) {
    restaurantMetaInFlight.set(restaurantId, fetchPromise);
  }

  return fetchPromise;
}

// Test helper to reset caches between runs
export function __resetOpsBookingsCachesForTest(): void {
  summaryCache.clear();
  summaryInFlight.clear();
  restaurantMetaCache.clear();
  restaurantMetaInFlight.clear();
  changesCache.clear();
  changesInFlight.clear();
}

export async function getTodayBookingsSummary(
  restaurantId: string,
  options: SummaryOptions = {},
): Promise<TodayBookingsSummary> {
  const client = options.client ?? getServiceSupabaseClient();
  const referenceDate = options.referenceDate ?? new Date();
  const restaurantMeta = await getRestaurantMeta(restaurantId, client);
  const timezone = restaurantMeta.timezone;
  const reportDate = isValidDateString(options.targetDate)
    ? options.targetDate
    : getDateInTimezone(referenceDate, timezone);

  const cacheKey = buildSummaryCacheKey(restaurantId, reportDate);

  if (summaryCacheEnabled) {
    const cached = summaryCache.get(cacheKey);
    if (cached) {
      opsLogger.debug("summary cache hit", { restaurantId, reportDate });
      return cached;
    }

    const pending = summaryInFlight.get(cacheKey);
    if (pending) {
      return pending;
    }
  }

  const fetchPromise = (async () => {
    const start = Date.now();
    const { data, error } = await client
      .from("bookings")
      .select(
        `
        id,
        status,
        start_time,
        end_time,
        party_size,
        customer_name,
        customer_email,
        customer_phone,
        notes,
        reference,
        details,
        source,
        checked_in_at,
        checked_out_at,
        customer_id,
        booking_table_assignments (
          table_id,
          table_inventory (
            table_number,
            capacity,
            section
          )
        )
      `,
      )
      .eq("restaurant_id", restaurantId)
      .eq("booking_date", reportDate)
      .order("start_time", { ascending: true });

    if (error) {
      throw error;
    }

    const bookings = (data ?? []) as BookingSummaryQueryRow[];

    const customerIds = bookings
      .map((booking) => booking.customer_id)
      .filter((customerId): customerId is string => typeof customerId === "string" && customerId.length > 0);

    const [loyaltyPointsMap, customerProfilesMap] = await Promise.all([
      getLoyaltyPointsForCustomers({
        restaurantId,
        customerIds,
        client,
      }),
      getCustomerProfilesForCustomers({
        customerIds,
        client,
      }),
    ]);

    const summaryBookings: TodayBooking[] = bookings.map((booking) => {
      const loyaltyData = booking.customer_id ? loyaltyPointsMap.get(booking.customer_id) ?? null : null;
      const profileData = booking.customer_id ? customerProfilesMap.get(booking.customer_id) ?? null : null;
      const parsedPreferences = parsePreferences(profileData?.preferences);

      const rawAssignments = Array.isArray(booking.booking_table_assignments)
        ? booking.booking_table_assignments
        : [];

      const assignmentGroups = new Map<string, TodayBooking["tableAssignments"][number]>();

      for (const assignment of rawAssignments) {
        if (!assignment?.table_id) {
          continue;
        }

        const tableMetaArray = Array.isArray(assignment.table_inventory)
          ? assignment.table_inventory
          : assignment.table_inventory
            ? [assignment.table_inventory]
            : [];
        const tableMeta = tableMetaArray[0] ?? null;
        const groupKey = assignment.table_id;
        let group = assignmentGroups.get(groupKey);

        if (!group) {
          group = {
            groupId: null,
            capacitySum: null,
            members: [],
          };

          if (typeof tableMeta?.capacity === "number") {
            group.capacitySum = tableMeta.capacity;
          }

          assignmentGroups.set(groupKey, group);
        }

        group.members.push({
          tableId: assignment.table_id,
          tableNumber: tableMeta?.table_number ?? "Unknown",
          capacity: typeof tableMeta?.capacity === "number" ? tableMeta.capacity : null,
          section: tableMeta?.section ?? null,
        });
      }

      const tableAssignments = Array.from(assignmentGroups.values()).map((group) => {
        if (group.capacitySum === null) {
          const computed = group.members.reduce((sum, member) => sum + (member.capacity ?? 0), 0);
          group.capacitySum = computed > 0 ? computed : null;
        }
        return group;
      });

      const requiresTableAssignment = tableAssignments.length === 0;

      return {
        id: booking.id,
        status: booking.status,
        startTime: booking.start_time,
        endTime: booking.end_time,
        partySize: booking.party_size,
        customerName: booking.customer_name,
        notes: booking.notes ?? null,
        customerEmail: booking.customer_email ?? null,
        customerPhone: booking.customer_phone ?? null,
        reference: booking.reference ?? null,
        details: normalizeDetails(booking.details),
        source: (booking.source as Tables<"bookings">["source"]) ?? null,
        loyaltyTier: (loyaltyData?.tier as Tables<"loyalty_points">["tier"] | null) ?? null,
        loyaltyPoints: loyaltyData?.totalPoints ?? null,
        profileNotes: profileData?.notes ?? null,
        allergies: parsedPreferences.allergies,
        dietaryRestrictions: parsedPreferences.dietaryRestrictions,
        seatingPreference: parsedPreferences.seatingPreference,
        marketingOptIn: profileData?.marketingOptIn ?? null,
        tableAssignments,
        requiresTableAssignment,
        checkedInAt: booking.checked_in_at ?? null,
        checkedOutAt: booking.checked_out_at ?? null,
      };
    });

    const totals = summaryBookings.reduce(
      (acc, booking) => {
        acc.total += 1;

        switch (booking.status) {
          case "pending":
          case "pending_allocation":
            acc.pending += 1;
            acc.upcoming += 1;
            break;
          case "confirmed":
            acc.confirmed += 1;
            acc.upcoming += 1;
            break;
          case "checked_in":
            acc.confirmed += 1;
            acc.completed += 1;
            break;
          case "completed":
            acc.confirmed += 1;
            acc.completed += 1;
            break;
          case "cancelled":
            acc.cancelled += 1;
            break;
          case "no_show":
            acc.noShow += 1;
            break;
          default:
            break;
        }

        if (!CANCELLED_STATUSES.includes(booking.status)) {
          acc.covers += booking.partySize;
        }

        return acc;
      },
      {
        total: 0,
        confirmed: 0,
        completed: 0,
        pending: 0,
        cancelled: 0,
        noShow: 0,
        upcoming: 0,
        covers: 0,
      },
    );

    const result = {
      date: reportDate,
      timezone,
      restaurantId,
      totals,
      bookings: summaryBookings,
    } satisfies TodayBookingsSummary;

    const durationMs = Date.now() - start;
    opsLogger.info("ops.summary.fetch", {
      restaurantId,
      reportDate,
      duration_ms: durationMs,
      bookings: summaryBookings.length,
      source: "db",
    });

    if (summaryCacheEnabled) {
      summaryCache.set(cacheKey, result, SUMMARY_CACHE_TTL_MS);
    }

    return result;
  })().finally(() => {
    summaryInFlight.delete(cacheKey);
  });

  if (summaryCacheEnabled) {
    summaryInFlight.set(cacheKey, fetchPromise);
  }

  return fetchPromise;
}

export type BookingHeatmap = Record<
  string,
  {
    covers: number;
    bookings: number;
  }
>;

export type BookingChange = {
  versionId: string;
  bookingId: string;
  bookingReference: string | null;
  customerName: string | null;
  changeType: "created" | "updated" | "cancelled" | "status_changed";
  changedAt: string;
  changedBy: string | null;
  oldData: Record<string, unknown> | null;
  newData: Record<string, unknown> | null;
};

export type BookingChangeFeedResponse = {
  date: string;
  changes: BookingChange[];
  totalChanges: number;
};

type BookingVersionRow = Pick<
  Tables<"booking_versions">,
  "version_id" | "booking_id" | "change_type" | "changed_at" | "changed_by" | "old_data" | "new_data"
> & {
  bookings: Pick<Tables<"bookings">, "customer_name" | "reference"> |
    Pick<Tables<"bookings">, "customer_name" | "reference">[];
};

type HeatmapOptions = {
  startDate: string;
  endDate: string;
  client?: DbClient;
};

export async function getBookingsHeatmap(
  restaurantId: string,
  options: HeatmapOptions,
): Promise<BookingHeatmap> {
  const client = options.client ?? getServiceSupabaseClient();

  const { data, error } = await client
    .from("bookings")
    .select("booking_date, party_size, status")
    .eq("restaurant_id", restaurantId)
    .gte("booking_date", options.startDate)
    .lte("booking_date", options.endDate);

  if (error) {
    throw error;
  }

  const entries = (data ?? []) as Pick<Tables<"bookings">, "booking_date" | "party_size" | "status">[];

  return entries.reduce<BookingHeatmap>((acc, booking) => {
    const key = booking.booking_date;
    if (!acc[key]) {
      acc[key] = { covers: 0, bookings: 0 };
    }

    acc[key]!.bookings += 1;
    if (!CANCELLED_STATUSES.includes(booking.status)) {
      acc[key]!.covers += booking.party_size ?? 0;
    }

    return acc;
  }, {});
}

type ChangeFeedOptions = {
  date: string;
  limit?: number;
  client?: DbClient;
};

export async function getTodayBookingChanges(
  restaurantId: string,
  options: ChangeFeedOptions,
): Promise<BookingChangeFeedResponse> {
  const client = options.client ?? getServiceSupabaseClient();
  const limit = options.limit ?? 50;
  const targetDate = options.date;

  const startOfDay = `${targetDate}T00:00:00`;
  const endOfDay = `${targetDate}T23:59:59`;

  const cacheKey = buildChangesCacheKey(restaurantId, targetDate, limit);

  if (changesCacheEnabled) {
    const cached = changesCache.get(cacheKey);
    if (cached) {
      opsLogger.debug("changes cache hit", { restaurantId, date: targetDate, limit });
      return cached;
    }

    const pending = changesInFlight.get(cacheKey);
    if (pending) {
      return pending;
    }
  }

  const fetchPromise = (async () => {
    const start = Date.now();

    const { data, error } = await client
      .from("booking_versions")
      .select(
        `version_id, booking_id, change_type, changed_at, changed_by, old_data, new_data,
      bookings!inner(customer_name, reference)`,
      )
      .eq("restaurant_id", restaurantId)
      .gte("changed_at", startOfDay)
      .lte("changed_at", endOfDay)
      .order("changed_at", { ascending: false })
      .limit(limit);

    if (error) {
      throw error;
    }

    const changes: BookingChange[] = (data ?? []).map((version: BookingVersionRow) => {
      const booking = Array.isArray(version.bookings) ? version.bookings[0] : version.bookings;

      return {
        versionId: version.version_id,
        bookingId: version.booking_id,
        bookingReference: booking?.reference ?? null,
        customerName: booking?.customer_name ?? null,
        changeType: version.change_type as BookingChange["changeType"],
        changedAt: version.changed_at,
        changedBy: version.changed_by,
        oldData: (version.old_data as Record<string, unknown>) ?? null,
        newData: (version.new_data as Record<string, unknown>) ?? null,
      };
    });

    const result = {
      date: targetDate,
      changes,
      totalChanges: changes.length,
    } satisfies BookingChangeFeedResponse;

    const durationMs = Date.now() - start;
    opsLogger.info("ops.changes.fetch", {
      restaurantId,
      date: targetDate,
      duration_ms: durationMs,
      changes: changes.length,
      source: "db",
    });

    if (changesCacheEnabled) {
      changesCache.set(cacheKey, result, CHANGES_CACHE_TTL_MS);
    }

    return result;
  })().finally(() => {
    changesInFlight.delete(cacheKey);
  });

  if (changesCacheEnabled) {
    changesInFlight.set(cacheKey, fetchPromise);
  }

  return fetchPromise;
}
