
import { getDateInTimezone } from "@/lib/utils/datetime";
import { getCustomerProfilesForCustomers } from "@/server/ops/customer-profiles";
import { getLoyaltyPointsForCustomers } from "@/server/ops/loyalty";
import { getServiceSupabaseClient } from "@/server/supabase";

import type { OpsTodayBooking, OpsTodayBookingsSummary } from "@/types/ops";
import type { Database, Tables } from "@/types/supabase";
import type { SupabaseClient } from "@supabase/supabase-js";

type DbClient = SupabaseClient<Database, "public", any>;

const CANCELLED_STATUSES: Tables<"bookings">["status"][] = ["cancelled", "no_show"];

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

export async function getTodayBookingsSummary(
  restaurantId: string,
  options: SummaryOptions = {},
): Promise<TodayBookingsSummary> {
  const client = options.client ?? getServiceSupabaseClient();
  const referenceDate = options.referenceDate ?? new Date();

  const { data: restaurant, error: restaurantError } = await client
    .from("restaurants")
    .select("id, timezone")
    .eq("id", restaurantId)
    .maybeSingle();

  if (restaurantError) {
    throw restaurantError;
  }

  const timezone = resolveTimezone(restaurant?.timezone);
  const reportDate = isValidDateString(options.targetDate)
    ? options.targetDate
    : getDateInTimezone(referenceDate, timezone);

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

    const assignmentGroups = new Map<string, TodayBooking['tableAssignments'][number]>();

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

      if (typeof tableMeta?.capacity === 'number') {
        group.capacitySum = tableMeta.capacity;
      }

      assignmentGroups.set(groupKey, group);
    }

      group.members.push({
        tableId: assignment.table_id,
        tableNumber: tableMeta?.table_number ?? 'Unknown',
        capacity: typeof tableMeta?.capacity === 'number' ? tableMeta.capacity : null,
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

  return {
    date: reportDate,
    timezone,
    restaurantId,
    totals,
    bookings: summaryBookings,
  };
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

  const { data: restaurant, error: restaurantError } = await client
    .from("restaurants")
    .select("timezone")
    .eq("id", restaurantId)
    .maybeSingle();

  if (restaurantError) {
    throw restaurantError;
  }

  const timezone = resolveTimezone(restaurant?.timezone);
  const targetDate = options.date;

  const startOfDay = `${targetDate}T00:00:00`;
  const endOfDay = `${targetDate}T23:59:59`;

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

  const changes: BookingChange[] = (data ?? []).map((version: any) => {
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

  return {
    date: targetDate,
    changes,
    totalChanges: changes.length,
  };
}
