import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { config as loadEnv } from "dotenv";
import { createClient } from "@supabase/supabase-js";

type Row = Record<string, unknown>;

const EMAIL = "ebrain@doctors.org.uk";
const RESTAURANT_QUERY = "old crown";
const EXPECTED_REF = "vrdiqfudmwydclqpydee";

function ensureArray(value: unknown): Row[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter((item): item is Row => Boolean(item) && typeof item === "object");
}

async function main() {
  const modulePath = fileURLToPath(import.meta.url);
  const taskArtifactsDir = path.dirname(modulePath);
  const taskDir = path.dirname(taskArtifactsDir);
  const repoRoot = path.resolve(taskDir, "..", "..");
  const envPath = path.join(repoRoot, ".env.vercel-production.live");

  if (!fs.existsSync(envPath)) {
    throw new Error(`Missing env file: ${envPath}`);
  }

  loadEnv({ path: envPath, override: true });

  const supabaseUrl = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("SUPABASE_URL/NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required");
  }

  if (!supabaseUrl.includes(EXPECTED_REF)) {
    throw new Error(`Supabase URL does not match expected production ref ${EXPECTED_REF}`);
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { "x-incident-debug": "old-crown-missing-assignment" } },
  });

  const { data: restaurants, error: restaurantsError } = await supabase
    .from("restaurants")
    .select("id,name,slug,timezone,is_active,updated_at")
    .ilike("name", `%${RESTAURANT_QUERY}%`)
    .order("name", { ascending: true });

  if (restaurantsError) {
    throw new Error(`restaurants query failed: ${restaurantsError.message}`);
  }

  const restaurantRows = ensureArray(restaurants);
  const targetRestaurant = restaurantRows.find((r) => String((r as Row).slug ?? "").includes("old-crown")) ?? restaurantRows[0] ?? null;
  if (!targetRestaurant) {
    throw new Error("No restaurant rows found for Old Crown query");
  }

  const restaurantId = String((targetRestaurant as Row).id);

  const bookingSelect = [
    "id",
    "reference",
    "restaurant_id",
    "customer_id",
    "customer_name",
    "customer_email",
    "customer_phone",
    "status",
    "source",
    "booking_type",
    "party_size",
    "booking_date",
    "start_time",
    "end_time",
    "start_at",
    "end_at",
    "created_at",
    "updated_at",
    "assigned_zone_id",
    "assignment_strategy",
    "assignment_state_version",
    "auto_assign_idempotency_key",
    "auto_assign_last_result",
    "details",
  ].join(",");

  const { data: bookings, error: bookingsError } = await supabase
    .from("bookings")
    .select(bookingSelect)
    .eq("restaurant_id", restaurantId)
    .eq("customer_email", EMAIL)
    .order("start_at", { ascending: false });

  if (bookingsError) {
    throw new Error(`bookings query failed: ${bookingsError.message}`);
  }

  const bookingRows = ensureArray(bookings);
  const bookingIds = bookingRows.map((b) => String(b.id));

  let assignments: Row[] = [];
  let assignmentTableIds: string[] = [];
  if (bookingIds.length > 0) {
    const { data: assignmentRows, error: assignmentError } = await supabase
      .from("booking_table_assignments")
      .select("id,booking_id,table_id,assigned_at,assigned_by,start_at,end_at,idempotency_key,merge_group_id,created_at,updated_at")
      .in("booking_id", bookingIds)
      .order("assigned_at", { ascending: true });

    if (assignmentError) {
      throw new Error(`booking_table_assignments query failed: ${assignmentError.message}`);
    }

    assignments = ensureArray(assignmentRows) as Row[];
    assignmentTableIds = Array.from(new Set(assignments.map((a) => String(a.table_id)).filter(Boolean)));
  }

  let assignmentTables: Row[] = [];
  if (assignmentTableIds.length > 0) {
    const { data: tableRows, error: tableError } = await supabase
      .from("table_inventory")
      .select("id,restaurant_id,table_number,capacity,section,zone_id,category,seating_type,mobility,active,status")
      .in("id", assignmentTableIds)
      .order("table_number", { ascending: true });

    if (tableError) {
      throw new Error(`table_inventory assignment-table query failed: ${tableError.message}`);
    }

    assignmentTables = ensureArray(tableRows) as Row[];
  }

  let observabilityEvents: Row[] = [];
  if (bookingIds.length > 0) {
    const { data: eventRows, error: eventError } = await supabase
      .from("observability_events")
      .select("id,source,event_type,severity,restaurant_id,booking_id,context,created_at")
      .in("booking_id", bookingIds)
      .order("created_at", { ascending: true });

    if (eventError) {
      throw new Error(`observability_events query failed: ${eventError.message}`);
    }

    observabilityEvents = ensureArray(eventRows) as Row[];
  }

  let stateHistory: Row[] = [];
  let stateHistoryOrderColumn: string | null = null;
  if (bookingIds.length > 0) {
    const historyQueries: Array<{ select: string; orderBy: string }> = [
      {
        select: "id,booking_id,from_status,to_status,reason,metadata,changed_at,changed_by",
        orderBy: "changed_at",
      },
      {
        select: "id,booking_id,from_status,to_status,reason,metadata,created_at",
        orderBy: "created_at",
      },
    ];
    let loaded = false;

    for (const query of historyQueries) {
      const { data: historyRows, error: historyError } = await supabase
        .from("booking_state_history")
        .select(query.select)
        .in("booking_id", bookingIds)
        .order(query.orderBy, { ascending: true });

      if (historyError) {
        continue;
      }

      stateHistory = ensureArray(historyRows) as Row[];
      stateHistoryOrderColumn = query.orderBy;
      loaded = true;
      break;
    }

    if (!loaded) {
      // Keep diagnosis progressing if this table differs across environments.
      stateHistory = [];
      stateHistoryOrderColumn = null;
    }
  }

  const { data: allTables, error: allTablesError } = await supabase
    .from("table_inventory")
    .select("id,table_number,zone_id,active,status")
    .eq("restaurant_id", restaurantId)
    .eq("active", true)
    .order("table_number", { ascending: true });

  if (allTablesError) {
    throw new Error(`table_inventory full query failed: ${allTablesError.message}`);
  }

  const restaurantTableRows = ensureArray(allTables) as Row[];
  const restaurantTableIds = restaurantTableRows.map((t) => String(t.id));

  let adjacencyFrom: Row[] = [];
  let adjacencyTo: Row[] = [];
  if (restaurantTableIds.length > 0) {
    const { data: fromRows, error: fromError } = await supabase
      .from("table_adjacencies")
      .select("table_a,table_b,created_at")
      .in("table_a", restaurantTableIds);

    if (fromError) {
      throw new Error(`table_adjacencies from query failed: ${fromError.message}`);
    }
    adjacencyFrom = ensureArray(fromRows) as Row[];

    const { data: toRows, error: toError } = await supabase
      .from("table_adjacencies")
      .select("table_a,table_b,created_at")
      .in("table_b", restaurantTableIds);

    if (toError) {
      throw new Error(`table_adjacencies to query failed: ${toError.message}`);
    }
    adjacencyTo = ensureArray(toRows) as Row[];
  }

  const adjacencyEdgeSet = new Set<string>();
  for (const edge of [...adjacencyFrom, ...adjacencyTo]) {
    const from = String(edge.table_a ?? "");
    const to = String(edge.table_b ?? "");
    if (!from || !to) continue;
    adjacencyEdgeSet.add(`${from}->${to}`);
  }

  const eventsByBooking: Record<string, number> = {};
  for (const row of observabilityEvents) {
    const bookingId = String(row.booking_id ?? "");
    if (!bookingId) continue;
    eventsByBooking[bookingId] = (eventsByBooking[bookingId] ?? 0) + 1;
  }

  const assignmentsByBooking: Record<string, number> = {};
  for (const row of assignments) {
    const bookingId = String(row.booking_id ?? "");
    if (!bookingId) continue;
    assignmentsByBooking[bookingId] = (assignmentsByBooking[bookingId] ?? 0) + 1;
  }

  const report = {
    generatedAt: new Date().toISOString(),
    environment: {
      expectedProjectRef: EXPECTED_REF,
      supabaseHost: new URL(supabaseUrl).host,
    },
    input: {
      email: EMAIL,
      restaurantNameQuery: RESTAURANT_QUERY,
    },
    restaurants: restaurantRows,
    targetRestaurant,
    summary: {
      bookingCountForEmail: bookingRows.length,
      bookingIds,
      assignmentRowCount: assignments.length,
      observabilityEventCount: observabilityEvents.length,
      stateHistoryCount: stateHistory.length,
      stateHistoryOrderColumn,
      activeTableCount: restaurantTableRows.length,
      adjacencyDirectedEdgeCount: adjacencyEdgeSet.size,
      unassignedBookingIds: bookingIds.filter((id) => !assignmentsByBooking[id]),
      eventsByBooking,
      assignmentsByBooking,
    },
    bookings: bookingRows,
    bookingTableAssignments: assignments,
    assignmentTables,
    observabilityEvents,
    bookingStateHistory: stateHistory,
    restaurantTableInventory: restaurantTableRows,
    tableAdjacencies: {
      fromRows: adjacencyFrom,
      toRows: adjacencyTo,
      directedEdgeCount: adjacencyEdgeSet.size,
    },
  };

  const outJsonPath = path.join(taskArtifactsDir, "incident-evidence.json");
  fs.writeFileSync(outJsonPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");

  const summaryLines = [
    `generated_at=${report.generatedAt}`,
    `supabase_host=${report.environment.supabaseHost}`,
    `target_restaurant_id=${String((targetRestaurant as Row).id ?? "")}`,
    `target_restaurant_name=${String((targetRestaurant as Row).name ?? "")}`,
    `booking_count_for_email=${report.summary.bookingCountForEmail}`,
    `assignment_row_count=${report.summary.assignmentRowCount}`,
    `observability_event_count=${report.summary.observabilityEventCount}`,
    `state_history_count=${report.summary.stateHistoryCount}`,
    `active_table_count=${report.summary.activeTableCount}`,
    `adjacency_directed_edge_count=${report.summary.adjacencyDirectedEdgeCount}`,
    `unassigned_booking_ids=${report.summary.unassignedBookingIds.join(",")}`,
  ];

  const outSummaryPath = path.join(taskArtifactsDir, "incident-evidence-summary.txt");
  fs.writeFileSync(outSummaryPath, `${summaryLines.join("\n")}\n`, "utf8");

  console.log(`Wrote ${outJsonPath}`);
  console.log(`Wrote ${outSummaryPath}`);
}

void main().catch((error) => {
  console.error(`[incident-evidence] ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
