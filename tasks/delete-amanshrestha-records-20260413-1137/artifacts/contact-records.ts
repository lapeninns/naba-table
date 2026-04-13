import process from "node:process";

import { createClient } from "@supabase/supabase-js";

import type { Database } from "../../../types/supabase";

type Supabase = ReturnType<typeof createClient<Database>>;

type CustomerRow = {
  id: string;
  restaurant_id: string;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  auth_user_id: string | null;
  user_profile_id: string | null;
};

type BookingRow = {
  id: string;
  restaurant_id: string;
  customer_id: string;
  reference: string;
  status: string;
  booking_date: string;
  customer_email: string | null;
  customer_phone: string | null;
};

type IdRow = { id: string };

function usage(): never {
  console.error(
    [
      "Usage:",
      "  NEXT_PUBLIC_SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... CONTACT_EMAILS=email1,email2 CONTACT_PHONE=... pnpm -s tsx tasks/.../contact-records.ts [--apply]",
      "",
      "Required env:",
      "  NEXT_PUBLIC_SUPABASE_URL",
      "  SUPABASE_SERVICE_ROLE_KEY",
      "  CONTACT_EMAILS",
      "  CONTACT_PHONE",
      "",
      "Optional env:",
      "  EXPECTED_PROJECT_REF=<ref>",
      "  REPORT_LABEL=<staging|production>",
      "",
      "Behavior:",
      "  - Dry run by default",
      "  - --apply deletes public application data only",
      "  - auth users are inspected best-effort and are not auto-deleted",
    ].join("\n"),
  );
  process.exit(1);
}

function normalizeEmail(value: string | null | undefined): string {
  return (value ?? "").trim().toLowerCase();
}

function parseEmails(raw: string | null | undefined): string[] {
  return unique(
    (raw ?? "")
      .split(",")
      .map((value) => normalizeEmail(value))
      .filter(Boolean),
  );
}

function unique(items: string[]): string[] {
  return [...new Set(items.filter((item) => item.length > 0))];
}

function derivePhoneCandidates(rawPhone: string): string[] {
  const digitsOnly = rawPhone.replace(/\D/g, "");
  const values = unique([rawPhone.trim(), digitsOnly]);

  for (const value of [...values]) {
    if (value.startsWith("44") && value.length > 2) {
      values.push(`0${value.slice(2)}`);
      values.push(`+${value}`);
    }
    if (value.startsWith("+44") && value.length > 3) {
      values.push(value.slice(1));
      values.push(`0${value.slice(3)}`);
    }
    if (value.startsWith("0") && value.length > 1) {
      values.push(`44${value.slice(1)}`);
      values.push(`+44${value.slice(1)}`);
    }
  }

  return unique(values);
}

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

function shouldIgnoreMissingTable(message: string): boolean {
  return /schema cache|does not exist|relation .* does not exist/i.test(message);
}

function quote(value: string): string {
  return `"${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}

function buildEqOr(column: string, values: string[]): string {
  return values.map((value) => `${column}.eq.${quote(value)}`).join(",");
}

async function fetchByIds<T extends { id: string }>(
  fetcher: (ids: string[]) => Promise<T[]>,
  ids: string[],
): Promise<T[]> {
  if (ids.length === 0) return [];
  const rows: T[] = [];
  for (const group of chunk(ids, 100)) {
    rows.push(...(await fetcher(group)));
  }
  return [...new Map(rows.map((row) => [row.id, row])).values()].sort((a, b) => a.id.localeCompare(b.id));
}

async function countByColumn(
  client: Supabase,
  table: keyof Database["public"]["Tables"],
  column: string,
  ids: string[],
): Promise<number> {
  if (ids.length === 0) return 0;
  let total = 0;
  for (const group of chunk(ids, 100)) {
    const { count, error } = await client.from(table).select(column, { head: true, count: "exact" }).in(column, group);
    if (error) throw new Error(`Failed to count ${String(table)}: ${error.message}`);
    total += count ?? 0;
  }
  return total;
}

async function deleteByColumn(
  client: Supabase,
  table: keyof Database["public"]["Tables"],
  column: string,
  ids: string[],
): Promise<number> {
  if (ids.length === 0) return 0;
  let total = 0;
  for (const group of chunk(ids, 100)) {
    const { count, error } = await client.from(table).delete({ count: "exact" }).in(column, group);
    if (error) {
      if (shouldIgnoreMissingTable(error.message)) {
        return total;
      }
      throw new Error(`Failed to delete from ${String(table)}: ${error.message}`);
    }
    total += count ?? 0;
  }
  return total;
}

async function fetchCustomers(client: Supabase, emails: string[], phoneCandidates: string[]): Promise<CustomerRow[]> {
  const orFilter = [
    buildEqOr("email", emails),
    buildEqOr("email_normalized", emails),
    buildEqOr("phone", phoneCandidates),
    buildEqOr("phone_normalized", phoneCandidates),
  ]
    .filter(Boolean)
    .join(",");

  const { data, error } = await client
    .from("customers")
    .select("id,restaurant_id,full_name,email,phone,auth_user_id,user_profile_id")
    .or(orFilter)
    .order("created_at", { ascending: true });

  if (error) throw new Error(`Failed to fetch customers: ${error.message}`);
  return (data ?? []) as CustomerRow[];
}

async function fetchBookings(
  client: Supabase,
  emails: string[],
  phoneCandidates: string[],
  customerIds: string[],
): Promise<BookingRow[]> {
  const rows: BookingRow[] = [];

  if (customerIds.length > 0) {
    rows.push(
      ...(await fetchByIds<BookingRow>(async (ids) => {
        const { data, error } = await client
          .from("bookings")
          .select("id,restaurant_id,customer_id,reference,status,booking_date,customer_email,customer_phone")
          .in("customer_id", ids)
          .order("created_at", { ascending: true });
        if (error) throw new Error(`Failed to fetch bookings by customer_id: ${error.message}`);
        return (data ?? []) as BookingRow[];
      }, customerIds)),
    );
  }

  const directOr = [buildEqOr("customer_email", emails), buildEqOr("customer_phone", phoneCandidates)]
    .filter(Boolean)
    .join(",");
  const { data, error } = await client
    .from("bookings")
    .select("id,restaurant_id,customer_id,reference,status,booking_date,customer_email,customer_phone")
    .or(directOr)
    .order("created_at", { ascending: true });
  if (error) throw new Error(`Failed to fetch direct-contact bookings: ${error.message}`);
  rows.push(...(((data ?? []) as BookingRow[]) ?? []));

  return [...new Map(rows.map((row) => [row.id, row])).values()].sort((a, b) => a.id.localeCompare(b.id));
}

async function fetchAnalyticsEventIds(client: Supabase, customerIds: string[], bookingIds: string[]): Promise<IdRow[]> {
  const rows: IdRow[] = [];

  if (customerIds.length > 0) {
    rows.push(
      ...(await fetchByIds<IdRow>(async (ids) => {
        const { data, error } = await client.from("analytics_events").select("id").in("customer_id", ids);
        if (error) throw new Error(`Failed to fetch analytics_events by customer_id: ${error.message}`);
        return (data ?? []) as IdRow[];
      }, customerIds)),
    );
  }

  if (bookingIds.length > 0) {
    rows.push(
      ...(await fetchByIds<IdRow>(async (ids) => {
        const { data, error } = await client.from("analytics_events").select("id").in("booking_id", ids);
        if (error) throw new Error(`Failed to fetch analytics_events by booking_id: ${error.message}`);
        return (data ?? []) as IdRow[];
      }, bookingIds)),
    );
  }

  return [...new Map(rows.map((row) => [row.id, row])).values()].sort((a, b) => a.id.localeCompare(b.id));
}

async function fetchEmailDeliveryLogIds(client: Supabase, bookingIds: string[], emails: string[]): Promise<IdRow[]> {
  const rows: IdRow[] = [];

  if (bookingIds.length > 0) {
    rows.push(
      ...(await fetchByIds<IdRow>(async (ids) => {
        const { data, error } = await client.from("email_delivery_log").select("id").in("booking_id", ids);
        if (error) throw new Error(`Failed to fetch email_delivery_log by booking_id: ${error.message}`);
        return (data ?? []) as IdRow[];
      }, bookingIds)),
    );
  }

  const { data, error } = await client
    .from("email_delivery_log")
    .select("id")
    .in("recipient_email", emails);
  if (error) throw new Error(`Failed to fetch email_delivery_log by recipient_email: ${error.message}`);
  rows.push(...(((data ?? []) as IdRow[]) ?? []));

  return [...new Map(rows.map((row) => [row.id, row])).values()].sort((a, b) => a.id.localeCompare(b.id));
}

async function fetchWaitingListIds(client: Supabase, emails: string[], phoneCandidates: string[]): Promise<IdRow[]> {
  const orFilter = [buildEqOr("customer_email", emails), buildEqOr("customer_phone", phoneCandidates)]
    .filter(Boolean)
    .join(",");
  const { data, error } = await client.from("waiting_list").select("id").or(orFilter);
  if (error) throw new Error(`Failed to fetch waiting_list rows: ${error.message}`);
  return ((data ?? []) as IdRow[]).sort((a, b) => a.id.localeCompare(b.id));
}

async function fetchLeadIds(client: Supabase, emails: string[]): Promise<IdRow[]> {
  const { data, error } = await client.from("leads").select("id").in("email", emails);
  if (error) throw new Error(`Failed to fetch leads: ${error.message}`);
  return ((data ?? []) as IdRow[]).sort((a, b) => a.id.localeCompare(b.id));
}

async function fetchRestaurants(client: Supabase, ids: string[]) {
  if (ids.length === 0) return [];
  const rows: Array<{ id: string; slug: string; name: string }> = [];
  for (const group of chunk(ids, 100)) {
    const { data, error } = await client.from("restaurants").select("id,slug,name").in("id", group).order("name");
    if (error) throw new Error(`Failed to fetch restaurants: ${error.message}`);
    rows.push(...(((data ?? []) as Array<{ id: string; slug: string; name: string }>) ?? []));
  }
  return rows.sort((a, b) => a.name.localeCompare(b.name) || a.slug.localeCompare(b.slug));
}

async function listAuthUsersBestEffort(client: Supabase, emails: string[], phoneCandidates: string[]) {
  try {
    const matches: Array<{ id: string; email: string | null; phone: string | null }> = [];
    let page = 1;

    for (;;) {
      const { data, error } = await client.auth.admin.listUsers({ page, perPage: 200 });
      if (error) throw error;
      const batch = data?.users ?? [];
      matches.push(
        ...batch
          .filter(
            (user) => emails.includes(normalizeEmail(user.email)) || phoneCandidates.includes((user.phone ?? "").trim()),
          )
          .map((user) => ({ id: user.id, email: user.email ?? null, phone: user.phone ?? null })),
      );
      if (batch.length < 200) break;
      page += 1;
    }

    return {
      rows: matches.sort((a, b) => a.id.localeCompare(b.id)),
      error: null as string | null,
    };
  } catch (error) {
    return {
      rows: [] as Array<{ id: string; email: string | null; phone: string | null }>,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

async function main(): Promise<void> {
  const apply = process.argv.includes("--apply");
  const reportLabel = process.env.REPORT_LABEL?.trim() || "unknown";
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() || "";
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() || "";
  const expectedProjectRef = process.env.EXPECTED_PROJECT_REF?.trim() || "";
  const emails = parseEmails(process.env.CONTACT_EMAILS);
  const phone = (process.env.CONTACT_PHONE ?? "").trim();

  if (!url || !key || emails.length === 0 || !phone) {
    usage();
  }

  if (expectedProjectRef && !url.includes(expectedProjectRef)) {
    throw new Error(`NEXT_PUBLIC_SUPABASE_URL does not match expected project ref ${expectedProjectRef}.`);
  }

  const phoneCandidates = derivePhoneCandidates(phone);
  const client = createClient<Database>(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const customers = await fetchCustomers(client, emails, phoneCandidates);
  const customerIds = unique(customers.map((row) => row.id));
  const authUserIds = unique(customers.map((row) => row.auth_user_id ?? ""));
  const userProfileIds = unique(customers.map((row) => row.user_profile_id ?? ""));

  const bookings = await fetchBookings(client, emails, phoneCandidates, customerIds);
  const bookingIds = unique(bookings.map((row) => row.id));

  const [restaurants, analyticsEventIds, emailDeliveryLogIds, waitingListIds, leadIds, authUsers] = await Promise.all([
    fetchRestaurants(client, unique([...customers.map((row) => row.restaurant_id), ...bookings.map((row) => row.restaurant_id)])),
    fetchAnalyticsEventIds(client, customerIds, bookingIds),
    fetchEmailDeliveryLogIds(client, bookingIds, emails),
    fetchWaitingListIds(client, emails, phoneCandidates),
    fetchLeadIds(client, emails),
    listAuthUsersBestEffort(client, emails, phoneCandidates),
  ]);

  const bookingScopedCounts = {
    customer_profiles: await countByColumn(client, "customer_profiles", "customer_id", customerIds),
    booking_assignment_attempts: await countByColumn(client, "booking_assignment_attempts", "booking_id", bookingIds),
    booking_assignment_idempotency: await countByColumn(client, "booking_assignment_idempotency", "booking_id", bookingIds),
    booking_confirmation_results: await countByColumn(client, "booking_confirmation_results", "booking_id", bookingIds),
    booking_state_history: await countByColumn(client, "booking_state_history", "booking_id", bookingIds),
    booking_table_assignments: await countByColumn(client, "booking_table_assignments", "booking_id", bookingIds),
    booking_versions: await countByColumn(client, "booking_versions", "booking_id", bookingIds),
    manual_assignment_sessions: await countByColumn(client, "manual_assignment_sessions", "booking_id", bookingIds),
    table_holds: await countByColumn(client, "table_holds", "booking_id", bookingIds),
    table_soft_holds: await countByColumn(client, "table_soft_holds", "booking_id", bookingIds),
    allocations: await countByColumn(client, "allocations", "booking_id", bookingIds),
    capacity_outbox: await countByColumn(client, "capacity_outbox", "booking_id", bookingIds),
    email_dispatch_intents: await countByColumn(client, "email_dispatch_intents", "booking_id", bookingIds),
  };

  const output = {
    reportLabel,
    mode: apply ? "apply" : "dry-run",
    contact: {
      emails,
      rawPhone: phone,
      phoneCandidates,
    },
    restaurants,
    counts: {
      customers: customers.length,
      bookings: bookings.length,
      analytics_events: analyticsEventIds.length,
      email_delivery_log: emailDeliveryLogIds.length,
      waiting_list: waitingListIds.length,
      leads: leadIds.length,
      auth_users: authUsers.rows.length,
      auth_users_from_customers: authUsers.rows.filter((row) => authUserIds.includes(row.id)).length,
      user_profiles_from_customers: userProfileIds.length,
      ...bookingScopedCounts,
    },
    authInspectionError: authUsers.error,
    samples: {
      customers: customers.slice(0, 10),
      bookings: bookings.slice(0, 10),
      authUsers: authUsers.rows.slice(0, 10),
    },
    ids: {
      customerIds,
      bookingIds,
      authUserIds,
      userProfileIds,
    },
    notes: [
      "auth users are reported best-effort for inspection but are not auto-deleted by this script.",
    ],
  };

  if (!apply) {
    console.log(JSON.stringify(output, null, 2));
    return;
  }

  const deletions = {
    leads: await deleteByColumn(client, "leads", "id", leadIds.map((row) => row.id)),
    waiting_list: await deleteByColumn(client, "waiting_list", "id", waitingListIds.map((row) => row.id)),
    manual_assignment_sessions: await deleteByColumn(client, "manual_assignment_sessions", "booking_id", bookingIds),
    booking_table_assignments: await deleteByColumn(client, "booking_table_assignments", "booking_id", bookingIds),
    booking_state_history: await deleteByColumn(client, "booking_state_history", "booking_id", bookingIds),
    booking_assignment_attempts: await deleteByColumn(client, "booking_assignment_attempts", "booking_id", bookingIds),
    booking_assignment_idempotency: await deleteByColumn(client, "booking_assignment_idempotency", "booking_id", bookingIds),
    booking_confirmation_results: await deleteByColumn(client, "booking_confirmation_results", "booking_id", bookingIds),
    booking_versions: await deleteByColumn(client, "booking_versions", "booking_id", bookingIds),
    analytics_events: await deleteByColumn(client, "analytics_events", "id", analyticsEventIds.map((row) => row.id)),
    table_soft_holds: await deleteByColumn(client, "table_soft_holds", "booking_id", bookingIds),
    table_holds: await deleteByColumn(client, "table_holds", "booking_id", bookingIds),
    email_dispatch_intents: await deleteByColumn(client, "email_dispatch_intents", "booking_id", bookingIds),
    email_delivery_log: await deleteByColumn(client, "email_delivery_log", "id", emailDeliveryLogIds.map((row) => row.id)),
    allocations: await deleteByColumn(client, "allocations", "booking_id", bookingIds),
    capacity_outbox: await deleteByColumn(client, "capacity_outbox", "booking_id", bookingIds),
    customer_profiles: await deleteByColumn(client, "customer_profiles", "customer_id", customerIds),
    bookings: await deleteByColumn(client, "bookings", "id", bookingIds),
    customers: await deleteByColumn(client, "customers", "id", customerIds),
  };

  console.log(
    JSON.stringify(
      {
        ...output,
        mode: "apply",
        deletions,
      },
      null,
      2,
    ),
  );
}

void main().catch((error) => {
  const message = error instanceof Error ? error.stack ?? error.message : String(error);
  console.error(message);
  process.exit(1);
});
