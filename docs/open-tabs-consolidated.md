# Consolidated Open Tabs

## server/capacity/tables.ts

/\*\*

- Capacity & Availability Engine - Table Assignment Service
- Story 2: Stub for v2 (Manual Assignment Only in v1)
-
- This service will handle:
- - Finding suitable tables for party size
- - Auto-assignment algorithm
- - Table combinability logic
-
- For v1: All table assignments are manual via ops dashboard
- For v2: Implement auto-assignment here
  \*/

import { DateTime } from "luxon";

import { env } from "@/lib/env";
import {
isSelectorScoringEnabled,
isOpsMetricsEnabled,
isAllocatorAdjacencyRequired,
getAllocatorKMax,
isHoldsEnabled,
} from "@/server/feature-flags";
import { getServiceSupabaseClient } from "@/server/supabase";
import {
createTableHold,
confirmTableHold,
releaseTableHold,
listActiveHoldsForBooking,
findHoldConflicts,
HoldNotFoundError,
AssignTablesRpcError,
} from "./holds";
import type { TableHoldSummary, ConfirmHoldResult, HoldConflictInfo } from "./holds";

import {
bandDuration,
defaultVenuePolicy,
getBufferConfig,
getVenuePolicy,
PolicyError,
ServiceNotFoundError,
ServiceOverrunError,
whichService,
serviceWindowFor,
getSelectorScoringConfig,
} from "./policy";
import { buildScoredTablePlans, type RankedTablePlan, type CandidateMetrics, type CandidateDiagnostics } from "./selector";
import {
emitSelectorDecision,
summarizeCandidate,
emitSelectorQuote,
emitHoldCreated,
emitHoldConfirmed,
emitRpcConflict,
type CandidateSummary,
} from "./telemetry";

import type {
ServiceKey,
VenuePolicy} from "./policy";
import type { Database, Tables } from "@/types/supabase";
import type { PostgrestError, SupabaseClient } from "@supabase/supabase-js";

type DbClient = SupabaseClient<Database, "public", any>;

const MISSING_TABLE_ERROR_CODES = new Set(["42P01", "PGRST202"]);
const PERMISSION_DENIED_ERROR_CODES = new Set(["42501", "PGRST301"]);

function isMissingSupabaseTableError(
error: PostgrestError | null | undefined,
table: string,
): boolean {
if (!error) {
return false;
}

const code = typeof error.code === "string" ? error.code.toUpperCase() : "";
if (code && MISSING_TABLE_ERROR_CODES.has(code)) {
return true;
}

const normalizedTable = table.toLowerCase();
const schemaQualified = `public.${normalizedTable}`;

const toText = (value: unknown): string => {
return typeof value === "string" ? value.toLowerCase() : "";
};

const haystacks = [toText(error.message), toText(error.details), toText((error as { hint?: unknown })?.hint)];

return haystacks.some((text) => {
if (!text) {
return false;
}

    const referencesTable =
      text.includes(schemaQualified) ||
      text.includes(`"${schemaQualified}"`) ||
      text.includes(`'${schemaQualified}'`) ||
      text.includes(normalizedTable);

    if (!referencesTable) {
      return false;
    }

    return (
      text.includes("schema cache") ||
      text.includes("does not exist") ||
      text.includes("missing sql table") ||
      text.includes("could not find the table")
    );

});
}

function isPermissionDeniedError(
error: PostgrestError | null | undefined,
table: string,
): boolean {
if (!error) {
return false;
}

const code = typeof error.code === "string" ? error.code.toUpperCase() : "";
if (code && PERMISSION_DENIED_ERROR_CODES.has(code)) {
return true;
}

const normalizedTable = table.toLowerCase();
const message = typeof error.message === "string" ? error.message.toLowerCase() : "";

return message.includes("permission denied") && message.includes(normalizedTable);
}

// =====================================================
// Types
// =====================================================

export type Table = {
id: string;
tableNumber: string;
capacity: number;
minPartySize: number;
maxPartySize: number | null;
section: string | null;
category: string;
seatingType: string;
mobility: string;
zoneId: string;
status: string;
active: boolean;
position: Record<string, any> | null;
};

export type TableMatchParams = {
partySize: number;
seatingPreference?: string;
section?: string;
};

export type TableAssignmentMember = {
tableId: string;
tableNumber: string;
capacity: number | null;
section: string | null;
};

export type TableAssignmentGroup = {
groupId: string | null;
capacitySum: number | null;
members: TableAssignmentMember[];
};

type TableInventoryRecord = {
table_number?: string | null;
capacity?: number | string | null;
section?: string | null;
};
function normalizeRelationshipRecord<T>(
value: T | T[] | null | undefined,
): T | null {
if (!value) {
return null;
}

return Array.isArray(value) ? value[0] ?? null : value;
}

function getNumericCapacity(value: unknown): number | null {
if (value === undefined || value === null) {
return null;
}

const numericCapacity = Number(value);
return Number.isFinite(numericCapacity) ? numericCapacity : null;
}

const INACTIVE_BOOKING_STATUSES = new Set<Tables<"bookings">["status"]>(["cancelled", "no_show"]);
const ASSIGNABLE_BOOKING_STATUSES = new Set<Tables<"bookings">["status"]>([
"pending",
"pending_allocation",
"confirmed",
]);

class AtomicAssignmentError extends Error {
code?: string;
details: string | null;
hint: string | null;

constructor(
message: string,
options: { code?: string; details?: string | null; hint?: string | null; cause?: unknown } = {},
) {
super(message);
this.name = "AtomicAssignmentError";
this.code = options.code;
this.details = options.details ?? null;
this.hint = options.hint ?? null;
if (options.cause !== undefined) {
(this as any).cause = options.cause;
}
}

static fromPostgrest(error: PostgrestError): AtomicAssignmentError {
return new AtomicAssignmentError(error.message ?? "assign_tables_atomic failed", {
code: error.code,
details: error.details ?? null,
hint: error.hint ?? null,
cause: error,
});
}
}

type IntervalMs = {
start: number;
end: number;
};

type BookingRowForAtomic = {
id: string;
restaurant_id: string;
booking_date: string | null;
start_time: string | null;
end_time: string | null;
start_at: string | null;
end_at: string | null;
restaurants?: {
timezone: string | null;
} | null;
};

type BookingRowForAtomicSupabase = Pick<
Tables<"bookings">,
"id" | "restaurant_id" | "booking_date" | "start_time" | "end_time" | "start_at" | "end_at"

> & {
> restaurants?: { timezone: string | null }[] | { timezone: string | null } | null;
> };

type BookingRowForManual = Pick<
Tables<"bookings">,
"id" | "restaurant_id" | "booking_date" | "start_time" | "end_time" | "start_at" | "end_at" | "party_size" | "status"

> ;

type BookingWindow = {
service: ServiceKey;
durationMinutes: number;
dining: {
start: DateTime;
end: DateTime;
};
block: {
start: DateTime;
end: DateTime;
};
};

type TableScheduleEntry = {
bookingId: string;
start: number; // Block start (ms)
end: number; // Block end (ms) — stored as half-open interval [start, end)
status: Tables<"bookings">["status"];
};

type ComputeBookingWindowArgs = {
startISO: string | null | undefined;
bookingDate?: string | null;
startTime?: string | null;
partySize: number;
policy: VenuePolicy;
serviceHint?: ServiceKey | null;
};

export type ManualSelectionCheckId = "sameZone" | "movable" | "adjacency" | "conflict" | "capacity";
export type ManualSelectionCheckStatus = "ok" | "warn" | "error";

export type ManualSelectionCheck = {
id: ManualSelectionCheckId;
status: ManualSelectionCheckStatus;
message: string;
details?: Record<string, unknown>;
};

export type ManualSelectionSummary = {
tableCount: number;
totalCapacity: number;
slack: number;
zoneId: string | null;
tableNumbers: string[];
partySize: number;
};

export type ManualValidationResult = {
ok: boolean;
checks: ManualSelectionCheck[];
summary: ManualSelectionSummary;
};

export type ManualSelectionOptions = {
bookingId: string;
tableIds: string[];
requireAdjacency?: boolean;
excludeHoldId?: string | null;
client?: DbClient;
};

export type ManualHoldOptions = ManualSelectionOptions & {
holdTtlSeconds?: number;
createdBy?: string | null;
};

export type ManualAssignmentHoldState = {
id: string;
bookingId: string | null;
restaurantId: string;
zoneId: string;
startAt: string;
endAt: string;
expiresAt: string;
tableIds: string[];
createdBy: string | null;
createdByName: string | null;
createdByEmail: string | null;
metadata: Record<string, unknown> | null;
countdownSeconds: number | null;
};

export type ManualAssignmentConflict = {
tableId: string;
bookingId: string;
startAt: string;
endAt: string;
status: Tables<"bookings">["status"];
};

export type ManualAssignmentContext = {
booking: {
id: string;
restaurantId: string;
bookingDate: string | null;
startAt: string | null;
endAt: string | null;
partySize: number;
status: Tables<"bookings">["status"];
};
tables: Table[];
bookingAssignments: string[];
holds: ManualAssignmentHoldState[];
activeHold: ManualAssignmentHoldState | null;
conflicts: ManualAssignmentConflict[];
window: {
startAt: string | null;
endAt: string | null;
};
};

export type ManualHoldResult = {
hold: TableHoldSummary | null;
validation: ManualValidationResult;
};

type ManualSelectionContext = {
booking: BookingRowForManual;
restaurantId: string;
selectedTables: Table[];
zoneId: string | null;
window: BookingWindow | null;
};

export class ManualSelectionInputError extends Error {
status: number;
code: string;

constructor(message: string, options: { status?: number; code?: string } = {}) {
super(message);
this.name = "ManualSelectionInputError";
this.status = options.status ?? 400;
this.code = options.code ?? "INVALID_SELECTION";
}
}

function windowsOverlap(a: IntervalMs, b: IntervalMs): boolean {
return a.start < b.end && b.start < a.end;
}

function toInterval(range: { start: DateTime; end: DateTime }): IntervalMs {
return {
start: range.start.toMillis(),
end: range.end.toMillis(),
};
}

function composeAtomicAssignmentIdempotencyKey(params: {
bookingId: string;
window: { start: string; end: string };
tableIds: string[];
}): string {
const bookingSegment = params.bookingId.trim().toLowerCase();
const normalizedTables = [...params.tableIds]
.map((id) => id.trim().toLowerCase())
.filter((id) => id.length > 0)
.sort((a, b) => a.localeCompare(b));

if (normalizedTables.length === 0) {
throw new Error("Idempotency key requires at least one table id");
}

const windowStart = params.window.start;
const windowEnd = params.window.end;
if (!windowStart || !windowEnd) {
throw new Error("Idempotency key requires booking window boundaries");
}

return [bookingSegment, windowStart, windowEnd, normalizedTables.join("+")].join(":");
}

function serializeBookingBlockWindow(window: BookingWindow): { range: string; start: string; end: string } {
const blockStartUtc = window.block.start.setZone("UTC", { keepLocalTime: false });
const blockEndUtc = window.block.end.setZone("UTC", { keepLocalTime: false });

if (!blockStartUtc.isValid || !blockEndUtc.isValid || blockEndUtc <= blockStartUtc) {
throw new Error("Booking block window is invalid; cannot build atomic assignment range");
}

const startIso = blockStartUtc.toISO({ suppressMilliseconds: true });
const endIso = blockEndUtc.toISO({ suppressMilliseconds: true });

if (!startIso || !endIso) {
throw new Error("Unable to serialise booking block window");
}

return {
range: `[${startIso},${endIso})`,
start: startIso,
end: endIso,
};
}

function resolveStartDateTime(args: {
startISO: string | null | undefined;
bookingDate?: string | null;
startTime?: string | null;
policy: VenuePolicy;
}): DateTime | null {
const { startISO, bookingDate, startTime, policy } = args;

if (startISO) {
const start = DateTime.fromISO(startISO, { setZone: true });
if (start.isValid) {
return start.setZone(policy.timezone, { keepLocalTime: false });
}
}

if (bookingDate && startTime) {
const combined = DateTime.fromISO(`${bookingDate}T${startTime}`, {
zone: policy.timezone,
});
if (combined.isValid) {
return combined;
}
}

return null;
}

function parseIsoDateTime(value: string | null | undefined): DateTime | null {
if (!value) {
return null;
}
const parsed = DateTime.fromISO(value, { setZone: true });
return parsed.isValid ? parsed : null;
}

function buildAssignmentWindowRange(booking: BookingRowForAtomic): { range: string; start: string; end: string } {
const startFromIso = parseIsoDateTime(booking.start_at);
const endFromIso = parseIsoDateTime(booking.end_at);

if (startFromIso && endFromIso && endFromIso > startFromIso) {
const startIso = startFromIso.toUTC().toISO({ suppressMilliseconds: true });
const endIso = endFromIso.toUTC().toISO({ suppressMilliseconds: true });
if (!startIso || !endIso) {
throw new Error("Unable to serialize booking window timestamps");
}
return { range: `[${startIso},${endIso})`, start: startIso, end: endIso };
}

const restaurantData = Array.isArray(booking.restaurants)
? booking.restaurants[0]
: booking.restaurants;
const timezone = restaurantData?.timezone ?? "UTC";

const baseDate =
booking.booking_date ??
(startFromIso ? startFromIso.setZone(timezone, { keepLocalTime: true }).toISODate() : null);
const startTime =
booking.start_time ??
(startFromIso ? startFromIso.setZone(timezone, { keepLocalTime: true }).toFormat("HH:mm") : null);

if (!baseDate || !startTime) {
throw new Error("Booking is missing scheduling information (date/time)");
}

let start = DateTime.fromISO(`${baseDate}T${startTime}`, { zone: timezone, setZone: true });
if (!start.isValid && startFromIso) {
start = startFromIso;
}

if (!start.isValid) {
throw new Error("Unable to determine booking start time");
}

let endCandidate: DateTime | null = null;
if (booking.end_time) {
const derived = DateTime.fromISO(`${baseDate}T${booking.end_time}`, { zone: timezone, setZone: true });
endCandidate = derived.isValid ? derived : null;
}

if ((!endCandidate || !endCandidate.isValid) && endFromIso) {
endCandidate = endFromIso;
}

if (!endCandidate || !endCandidate.isValid || endCandidate <= start) {
const defaultDurationMinutes = env.reserve.defaultDurationMinutes ?? 90;
endCandidate = start.plus({ minutes: defaultDurationMinutes });
}

const startUtc = start.setZone("UTC", { keepLocalTime: false });
const endUtc = endCandidate.setZone("UTC", { keepLocalTime: false });

if (!startUtc.isValid || !endUtc.isValid || endUtc <= startUtc) {
throw new Error("Resolved booking window is invalid");
}

const startIso = startUtc.toISO({ suppressMilliseconds: true });
const endIso = endUtc.toISO({ suppressMilliseconds: true });

if (!startIso || !endIso) {
throw new Error("Failed to serialize booking assignment window");
}

return { range: `[${startIso},${endIso})`, start: startIso, end: endIso };
}

function computeBookingWindow(args: ComputeBookingWindowArgs): BookingWindow | null {
const { startISO, bookingDate, startTime, partySize, policy, serviceHint } = args;
if (!Number.isFinite(partySize) || partySize <= 0) {
return null;
}

const start = resolveStartDateTime({ startISO, bookingDate, startTime, policy });
if (!start) {
return null;
}

const service =
serviceHint ?? whichService(start, policy);

if (!service) {
throw new ServiceNotFoundError(start);
}

const window = serviceWindowFor(service, start, policy);
const duration = bandDuration(service, partySize, policy);

const diningEnd = start.plus({ minutes: duration });
if (diningEnd > window.end) {
throw new ServiceOverrunError(service, diningEnd, window.end);
}

const buffer = getBufferConfig(service, policy);
const blockStart = buffer.pre > 0 ? start.minus({ minutes: buffer.pre }) : start;
const blockEnd = buffer.post > 0 ? diningEnd.plus({ minutes: buffer.post }) : diningEnd;

if (blockEnd > window.end) {
throw new ServiceOverrunError(
service,
blockEnd,
window.end,
`Reservation plus buffer exceeds ${service} service end (${window.end.toFormat("HH:mm")}).`,
);
}

return {
service,
durationMinutes: duration,
dining: { start, end: diningEnd },
block: { start: blockStart, end: blockEnd },
};
}

function tableWindowIsFree(
tableId: string,
targetInterval: IntervalMs,
schedule: Map<string, TableScheduleEntry[]>,
bookingId?: string,
): boolean {
const entries = schedule.get(tableId);
if (!entries || entries.length === 0) {
return true;
}

return entries.every((entry) => {
if (entry.bookingId === bookingId) {
return true;
}

    if (INACTIVE_BOOKING_STATUSES.has(entry.status)) {
      return true;
    }

    return !windowsOverlap(targetInterval, { start: entry.start, end: entry.end });

});
}

function filterAvailableTables(
tables: Table[],
partySize: number,
window: BookingWindow,
schedule: Map<string, TableScheduleEntry[]>,
preferences: TableMatchParams | undefined,
bookingId?: string,
): Table[] {
const targetInterval = toInterval(window.block);

return tables.filter((table) => {
if (!table || !Number.isFinite(table.capacity) || table.capacity <= 0) {
return false;
}

    if (!table.active) {
      return false;
    }

    if (table.status === "out_of_service" || table.status === "occupied") {
      return false;
    }

    if (
      preferences?.seatingPreference &&
      preferences.seatingPreference !== "any" &&
      table.seatingType &&
      table.seatingType !== preferences.seatingPreference
    ) {
      return false;
    }

    if (preferences?.section && table.section && table.section !== preferences.section) {
      return false;
    }

    if (table.minPartySize && partySize < table.minPartySize) {
      return false;
    }

    return tableWindowIsFree(table.id, targetInterval, schedule, bookingId);

});
}

type TablePlan = {
tables: Table[];
slack: number;
score?: number;
metrics?: CandidateMetrics;
tableKey?: string;
};

type TablePlanResult = {
plans: TablePlan[];
fallbackReason?: string;
diagnostics?: CandidateDiagnostics;
};

function mapPlanToCandidateSummary(plan: TablePlan) {
const tableIds = plan.tables.map((table) => table.id);
const tableNumbers = plan.tables.map((table) => table.tableNumber ?? null);
const totalCapacity = plan.tables.reduce((sum, table) => sum + (table.capacity ?? 0), 0);

return summarizeCandidate({
tableIds,
tableNumbers,
totalCapacity,
tableCount: plan.tables.length,
slack: plan.slack,
score: plan.score,
});
}

function generateLegacyTablePlans(tables: Table[], partySize: number): TablePlanResult {
if (tables.length === 0) {
return { plans: [], fallbackReason: "No tables available for the requested booking window" };
}

const byCapacityAsc = [...tables].sort((a, b) => {
if ((a.capacity ?? 0) === (b.capacity ?? 0)) {
return (a.tableNumber ?? "").localeCompare(b.tableNumber ?? "");
}
return (a.capacity ?? 0) - (b.capacity ?? 0);
});

const plans: TablePlan[] = [];
const seen = new Set<string>();

const registerPlan = (plan: TablePlan) => {
const key = [...plan.tables].map((table) => table.id).sort((a, b) => a.localeCompare(b)).join("|");
if (seen.has(key)) {
return;
}
seen.add(key);
plans.push(plan);
};

const eligibleSingles = byCapacityAsc.filter((table) => {
if (!Number.isFinite(table.capacity) || (table.capacity ?? 0) <= 0) {
return false;
}
if ((table.capacity ?? 0) < partySize) {
return false;
}
if (typeof table.maxPartySize === "number" && table.maxPartySize > 0 && partySize > table.maxPartySize) {
return false;
}
return true;
});

for (const table of eligibleSingles) {
registerPlan({
tables: [table],
slack: (table.capacity ?? 0) - partySize,
});
}

plans.sort((a, b) => {
if (a.slack !== b.slack) {
return a.slack - b.slack;
}
const capacityA = a.tables.reduce((sum, table) => sum + (table.capacity ?? 0), 0);
const capacityB = b.tables.reduce((sum, table) => sum + (table.capacity ?? 0), 0);
if (capacityA !== capacityB) {
return capacityA - capacityB;
}
const nameA = a.tables.map((table) => table.tableNumber ?? "").sort().join("+");
const nameB = b.tables.map((table) => table.tableNumber ?? "").sort().join("+");
return nameA.localeCompare(nameB);
});

return {
plans,
fallbackReason: plans.length === 0 ? "No tables available that satisfy the party size" : undefined,
};
}

function mapRankedPlan(plan: RankedTablePlan): TablePlan {
return {
tables: plan.tables,
slack: plan.slack,
score: plan.score,
metrics: plan.metrics,
tableKey: plan.tableKey,
};
}

function generateScoringTablePlans(
tables: Table[],
partySize: number,
adjacency: Map<string, Set<string>>,
config = getSelectorScoringConfig(),
): TablePlanResult {
const { plans, fallbackReason, diagnostics } = buildScoredTablePlans({
tables,
partySize,
adjacency,
config,
});

return {
plans: plans.map(mapRankedPlan),
fallbackReason,
diagnostics,
};
}

function generateTablePlans(tables: Table[], partySize: number, adjacency: Map<string, Set<string>>): TablePlanResult {
if (isSelectorScoringEnabled()) {
return generateScoringTablePlans(tables, partySize, adjacency);
}
return generateLegacyTablePlans(tables, partySize);
}

type BookingRecordForAssignment = {
id: string;
party_size: number | null;
status: Tables<"bookings">["status"];
start_time: string | null;
end_time: string | null;
seating_preference: string | null;
start_at: string | null;
booking_date: string | null;
};

async function assignTablesForBooking(params: {
booking: BookingRecordForAssignment;
tables: Table[];
schedule: Map<string, TableScheduleEntry[]>;
assignedBy?: string | null;
client: DbClient;
preferences?: TableMatchParams;
policy: VenuePolicy;
adjacency: Map<string, Set<string>>;
restaurantId: string;
}): Promise<{ tableIds: string[] } | { reason: string }> {
const { booking, tables, schedule, assignedBy, client, preferences, policy, adjacency, restaurantId } = params;
const decisionStart = Date.now();
const selectorScoringEnabled = isSelectorScoringEnabled();
const opsMetricsEnabled = isOpsMetricsEnabled();
const partySize = booking.party_size ?? 0;

const logDecision = (
selectedPlan: TablePlan | null,
skipReason: string | null,
candidatePlans: TablePlan[],
bookingWindow?: { start: string | null; end: string | null },
) => {
const durationMs = Date.now() - decisionStart;
const candidates = candidatePlans.slice(0, 3).map(mapPlanToCandidateSummary);
const selected = selectedPlan ? mapPlanToCandidateSummary(selectedPlan) : null;
const windowPayload = bookingWindow ?? {
start: booking.start_at ?? null,
end: booking.end_time ?? null,
};

    void emitSelectorDecision({
      restaurantId,
      bookingId: booking.id,
      partySize,
      window: windowPayload,
      candidates,
      selected,
      skipReason,
      durationMs,
      featureFlags: {
        selectorScoring: selectorScoringEnabled,
        opsMetrics: opsMetricsEnabled,
      },
    });

};

if (!Number.isFinite(partySize) || partySize <= 0) {
const reason = "Party size is not set for this booking";
logDecision(null, reason, []);
return { reason };
}

let window: BookingWindow | null;
try {
window = computeBookingWindow({
startISO: booking.start_at,
bookingDate: booking.booking_date,
startTime: booking.start_time,
partySize,
policy,
});
} catch (error) {
if (error instanceof PolicyError) {
logDecision(null, error.message, []);
return { reason: error.message };
}
throw error;
}

if (!window) {
const reason = "Booking time is incomplete; cannot determine seating window";
logDecision(null, reason, []);
return { reason };
}

const targetInterval = toInterval(window.block);

let effectivePreferences: TableMatchParams | undefined = preferences ? { ...preferences } : undefined;

if (booking.seating_preference && booking.seating_preference !== "any") {
if (!effectivePreferences) {
effectivePreferences = { partySize, seatingPreference: booking.seating_preference };
} else {
effectivePreferences.seatingPreference = booking.seating_preference;
}
}

const availableTables = filterAvailableTables(
tables,
partySize,
window,
schedule,
effectivePreferences,
booking.id,
);

if (availableTables.length === 0) {
const reason = "No suitable tables are available for the booking window";
logDecision(null, reason, [], serializeBookingBlockWindow(window));
return { reason };
}

const { plans: candidatePlans, fallbackReason } = generateTablePlans(availableTables, partySize, adjacency);
if (candidatePlans.length === 0) {
const reason = fallbackReason ?? "Unable to locate a compatible table combination";
logDecision(null, reason, [], serializeBookingBlockWindow(window));
return { reason };
}

const serializedWindow = serializeBookingBlockWindow(window);
let overlapError: AtomicAssignmentError | null = null;

for (const plan of candidatePlans) {
const tableIds = plan.tables.map((table) => table.id);
let idempotencyKey: string;
try {
idempotencyKey = composeAtomicAssignmentIdempotencyKey({
bookingId: booking.id,
window: { start: serializedWindow.start, end: serializedWindow.end },
tableIds,
});
} catch (idKeyError) {
console.error("[capacity][autoAssign] failed to compose idempotency key", {
bookingId: booking.id,
tableIds,
error: idKeyError,
});
const reason = "Failed to build idempotency key for table assignment";
logDecision(plan, reason, candidatePlans, serializedWindow);
return { reason };
}

    try {
      const assignments = await invokeAssignTablesAtomic({
        bookingId: booking.id,
        tableIds,
        assignedBy: assignedBy ?? null,
        idempotencyKey,
        client,
        window: serializedWindow,
        requireAdjacency: plan.tables.length > 1 && isAllocatorAdjacencyRequired(),
      });

      if (assignments.length === 0) {
        throw new Error("assign_tables_atomic returned no assignments");
      }

      const assignmentsByTable = new Map(assignments.map((entry) => [entry.tableId, entry]));

      for (const table of plan.tables) {
        const rpcRow = assignmentsByTable.get(table.id);
        const updateEntry: TableScheduleEntry = {
          bookingId: booking.id,
          start: targetInterval.start,
          end: targetInterval.end,
          status: booking.status,
        };
        const existing = schedule.get(table.id) ?? [];
        existing.push(updateEntry);
        schedule.set(table.id, existing);
      }

      logDecision(plan, null, candidatePlans, serializedWindow);
      return { tableIds };
    } catch (error) {
      if (error instanceof AtomicAssignmentError) {
        const message = (error.message ?? "").toLowerCase();
        if (error.code === "P0001" && message.includes("allocations_no_overlap")) {
          overlapError = error;
          continue;
        }
      }
      console.error("[capacity][autoAssign] atomic assignment failed", {
        bookingId: booking.id,
        tableIds,
        error,
      });
      const reason = error instanceof Error ? error.message : "Failed to assign tables";
      logDecision(plan, reason, candidatePlans, serializedWindow);
      return { reason };
    }

}

if (overlapError) {
const reason = "All candidate table plans conflicted with existing allocations.";
logDecision(null, reason, candidatePlans, serializedWindow);
return { reason };
}

const reason = fallbackReason ?? "Unable to assign tables for the requested booking.";
logDecision(null, reason, candidatePlans, serializedWindow);
return { reason };
}

type BookingRowWithAssignments = BookingRecordForAssignment & {
booking_table_assignments: { table_id: string | null }[] | null;
};

type AssignmentContext = {
tables: Table[];
bookings: BookingRowWithAssignments[];
schedule: Map<string, TableScheduleEntry[]>;
policy: VenuePolicy;
adjacency: Map<string, Set<string>>;
};

async function loadAssignmentContext(params: {
restaurantId: string;
date: string;
client: DbClient;
}): Promise<AssignmentContext> {
const { restaurantId, date, client } = params;

const [tablesResult, bookingsResult, restaurantResult] = await Promise.all([
client
.from("table_inventory")
.select(
`
id,
table_number,
capacity,
min_party_size,
max_party_size,
section,
category,
seating_type,
mobility,
zone_id,
status,
active,
position
`,
)
.eq("restaurant_id", restaurantId)
.order("capacity", { ascending: true }),
client
.from("bookings")
.select(
`
id,
party_size,
status,
start_time,
end_time,
start_at,
booking_date,
seating_preference,
booking_table_assignments (
table_id
)
`,
)
.eq("restaurant_id", restaurantId)
.eq("booking_date", date)
.order("start_time", { ascending: true }),
client
.from("restaurants")
.select("timezone")
.eq("id", restaurantId)
.maybeSingle(),
]);

if (tablesResult.error) {
throw new Error(`Failed to load table inventory: ${tablesResult.error.message}`);
}

if (bookingsResult.error) {
throw new Error(`Failed to load bookings for auto assignment: ${bookingsResult.error.message}`);
}

if (restaurantResult.error) {
throw new Error(`Failed to load restaurant timezone: ${restaurantResult.error.message}`);
}

const timezone = restaurantResult.data?.timezone ?? defaultVenuePolicy.timezone;
const policy = getVenuePolicy({ timezone });

const tables: Table[] = (tablesResult.data ?? []).map((row: any) => ({
id: row.id,
tableNumber: row.table_number,
capacity: row.capacity,
minPartySize: row.min_party_size,
maxPartySize: row.max_party_size,
section: row.section,
category: row.category,
seatingType: row.seating_type,
mobility: row.mobility,
zoneId: row.zone_id,
status: row.status,
active: row.active ?? true,
position: row.position ?? null,
}));

const adjacency = new Map<string, Set<string>>();
const tableIds = tables.map((table) => table.id);

if (tableIds.length > 0) {
const adjacencyResult = await client
.from("table_adjacencies")
.select("table_a, table_b")
.in("table_a", tableIds);

    if (adjacencyResult.error) {
      throw new Error(`Failed to load table adjacency: ${adjacencyResult.error.message}`);
    }

    for (const row of adjacencyResult.data ?? []) {
      const entries = adjacency.get(row.table_a) ?? new Set<string>();
      entries.add(row.table_b);
      adjacency.set(row.table_a, entries);
    }

}

const bookings: BookingRowWithAssignments[] = (bookingsResult.data ?? []) as BookingRowWithAssignments[];
const schedule = new Map<string, TableScheduleEntry[]>();

for (const booking of bookings) {
const assignments = Array.isArray(booking.booking_table_assignments)
? booking.booking_table_assignments
: [];

    if (assignments.length === 0) {
      continue;
    }

    if (INACTIVE_BOOKING_STATUSES.has(booking.status)) {
      continue;
    }

    let window: BookingWindow | null;
    try {
      window = computeBookingWindow({
        startISO: booking.start_at,
        bookingDate: booking.booking_date,
        startTime: booking.start_time,
        partySize: booking.party_size ?? 0,
        policy,
      });
    } catch (error) {
      if (error instanceof PolicyError) {
        // Skip invalid bookings from schedule; operations team should resolve.
        continue;
      }
      throw error;
    }

    if (!window) {
      continue;
    }

    const blockInterval = toInterval(window.block);

    for (const assignment of assignments) {
      if (!assignment?.table_id) {
        continue;
      }

      const existing = schedule.get(assignment.table_id) ?? [];
      existing.push({
        bookingId: booking.id,
        start: blockInterval.start,
        end: blockInterval.end,
        status: booking.status,
      });
      schedule.set(assignment.table_id, existing);
    }

}

return { tables, bookings, schedule, policy, adjacency };
}

type AutoAssignInternalParams = {
restaurantId: string;
date: string;
client: DbClient;
assignedBy?: string | null;
targetBookingIds?: Set<string>;
preferenceOverrides?: Map<string, TableMatchParams>;
};

export type AutoAssignResult = {
assigned: { bookingId: string; tableIds: string[] }[];
skipped: { bookingId: string; reason: string }[];
};

async function autoAssignTablesInternal(params: AutoAssignInternalParams): Promise<AutoAssignResult> {
const { restaurantId, date, client, assignedBy, targetBookingIds, preferenceOverrides } = params;

const { tables, bookings, schedule, policy, adjacency } = await loadAssignmentContext({ restaurantId, date, client });

if (tables.length === 0) {
return {
assigned: [],
skipped: bookings
.filter((booking) => !targetBookingIds || targetBookingIds.has(booking.id))
.map((booking) => ({ bookingId: booking.id, reason: "No tables configured for restaurant" })),
};
}

const bookingsToProcess = bookings
.filter((booking) => {
if (targetBookingIds && !targetBookingIds.has(booking.id)) {
return false;
}

      if (!ASSIGNABLE_BOOKING_STATUSES.has(booking.status)) {
        return false;
      }

      const assignments = Array.isArray(booking.booking_table_assignments)
        ? booking.booking_table_assignments
        : [];

      return assignments.length === 0;
    })
    .sort((a, b) => {
      const sizeA = a.party_size ?? 0;
      const sizeB = b.party_size ?? 0;
      if (sizeA !== sizeB) {
        return sizeB - sizeA; // larger parties first
      }

      const startA =
        resolveStartDateTime({
          startISO: a.start_at,
          bookingDate: a.booking_date,
          startTime: a.start_time,
          policy,
        })?.toMillis() ?? 0;
      const startB =
        resolveStartDateTime({
          startISO: b.start_at,
          bookingDate: b.booking_date,
          startTime: b.start_time,
          policy,
        })?.toMillis() ?? 0;
      return startA - startB;
    });

const results: AutoAssignResult = {
assigned: [],
skipped: [],
};

for (const booking of bookingsToProcess) {
const override = preferenceOverrides?.get(booking.id);
const assignment = await assignTablesForBooking({
booking,
tables,
schedule,
assignedBy,
client,
preferences: override,
policy,
adjacency,
restaurantId,
});

    if ("tableIds" in assignment && assignment.tableIds.length > 0) {
      results.assigned.push({ bookingId: booking.id, tableIds: assignment.tableIds });
    } else {
      const reason = "reason" in assignment ? assignment.reason : "Unable to assign tables";
      results.skipped.push({
        bookingId: booking.id,
        reason,
      });
    }

}

return results;
}

// =====================================================
// Table Finding Functions (v2)
// =====================================================

/\*\*

- Find suitable tables for a party size
-
- v1: Returns empty array (manual assignment only)
- v2: Will implement smart matching algorithm
-
- Algorithm (v2):
- 1.  Exact match: table.capacity === partySize
- 2.  Next size up: table.capacity > partySize (smallest that fits)
- 3.  Combinable tables: 2+ tables that sum to partySize
-
- @param restaurantId - Restaurant ID
- @param params - Party size and preferences
- @param client - Optional Supabase client
- @returns Array of suitable tables
  \*/
  export async function findSuitableTables(
  restaurantId: string,
  params: TableMatchParams,
  client?: DbClient
  ): Promise<Table[]> {
  // v1: Not implemented, return empty array
  // Ops staff will assign tables manually

console.warn(
"[v1] findSuitableTables is not implemented. Use manual table assignment in ops dashboard."
);

return [];

// v2 Implementation Plan:
// const supabase = client ?? getServiceSupabaseClient();
// const { partySize, seatingPreference, section } = params;
//
// // Query available tables
// let query = supabase
// .from("table_inventory")
// .select("\*")
// .eq("restaurant_id", restaurantId)
// .eq("status", "available")
// .gte("capacity", partySize)
// .order("capacity", { ascending: true });
//
// if (seatingPreference && seatingPreference !== "any") {
// query = query.eq("seating_type", seatingPreference);
// }
//
// if (section) {
// query = query.eq("section", section);
// }
//
// const { data, error } = await query.limit(10);
//
// if (error) {
// throw new Error(`Failed to find tables: ${error.message}`);
// }
//
// return data ?? [];
}

/\*\*

- Assign a table to a booking
-
- v1: Throws error (use RPC function assign_table_to_booking directly)
- v2: Wraps assign_tables_atomic_v2 with additional logic
-
- @param bookingId - Booking ID
- @param tableId - Table ID
- @param assignedBy - User ID of assigner
- @param client - Optional Supabase client
- @returns Assignment ID
  \*/
  export async function assignTableToBooking(
  bookingId: string,
  tableId: string,
  assignedBy?: string,
  client?: DbClient,
  options?: { idempotencyKey?: string | null }
  ): Promise<string> {
  const supabase = client ?? getServiceSupabaseClient();
  const assignments = await invokeAssignTablesAtomic({
  bookingId,
  tableIds: [tableId],
  assignedBy: assignedBy ?? null,
  idempotencyKey: options?.idempotencyKey ?? null,
  client: supabase,
  requireAdjacency: false,
  });

const first = assignments[0];
if (!first) {
throw new Error("assign_tables_atomic_v2 returned no assignments");
}
if (!first.assignmentId) {
throw new Error("assign_tables_atomic_v2 did not return assignment id");
}
return first.assignmentId;
}

export type QuoteTablesOptions = {
bookingId: string;
zoneId?: string | null;
maxTables?: number;
requireAdjacency?: boolean;
avoidTables?: string[];
holdTtlSeconds?: number;
createdBy?: string | null;
client?: DbClient;
};

export type QuoteTablesResult = {
hold?: TableHoldSummary;
candidate?: CandidateSummary;
alternates: CandidateSummary[];
nextTimes: string[];
reason?: string;
};

export async function quoteTablesForBooking(options: QuoteTablesOptions): Promise<QuoteTablesResult> {
const {
bookingId,
zoneId,
maxTables,
requireAdjacency,
avoidTables,
holdTtlSeconds = 120,
createdBy,
client,
} = options;

const supabase = client ?? getServiceSupabaseClient();
const quoteStart = Date.now();

const bookingQuery = await supabase
.from("bookings")
.select(
`         id,
        restaurant_id,
        party_size,
        status,
        start_time,
        end_time,
        start_at,
        end_at,
        booking_date,
        seating_preference
      `,
)
.eq("id", bookingId)
.maybeSingle();

if (bookingQuery.error) {
throw new Error(`Failed to load booking ${bookingId}: ${bookingQuery.error.message}`);
}

const bookingRow = bookingQuery.data;
if (!bookingRow) {
throw new Error(`Booking ${bookingId} not found`);
}

if (!ASSIGNABLE_BOOKING_STATUSES.has(bookingRow.status as Tables<"bookings">["status"])) {
return {
alternates: [],
nextTimes: [],
reason: `Booking status ${bookingRow.status} is not eligible for auto assignment`,
};
}

const restaurantId = bookingRow.restaurant_id;
if (!restaurantId) {
throw new Error("Booking is missing restaurant_id");
}

const partySize = bookingRow.party_size ?? 0;
if (!Number.isFinite(partySize) || partySize <= 0) {
return {
alternates: [],
nextTimes: [],
reason: "Booking has no party size configured",
};
}

const assignmentDate = bookingRow.booking_date;
if (!assignmentDate) {
return {
alternates: [],
nextTimes: [],
reason: "Booking date is not set; unable to compute availability",
};
}

const { tables, bookings, schedule, policy, adjacency } = await loadAssignmentContext({
restaurantId,
date: assignmentDate,
client: supabase,
});

const bookingRecord = bookings.find((entry) => entry.id === bookingId);
const selectorScoringEnabled = isSelectorScoringEnabled();
const opsMetricsEnabled = isOpsMetricsEnabled();

let window: BookingWindow | null;
try {
window = computeBookingWindow({
startISO: bookingRow.start_at,
bookingDate: bookingRow.booking_date,
startTime: bookingRow.start_time,
partySize,
policy,
});
} catch (error) {
const message = error instanceof PolicyError ? error.message : "Unable to compute booking window";
await emitSelectorQuote({
restaurantId,
bookingId,
partySize,
window: { start: bookingRow.start_at, end: bookingRow.end_at },
candidates: [],
selected: null,
skipReason: message,
durationMs: Date.now() - quoteStart,
featureFlags: {
selectorScoring: selectorScoringEnabled,
opsMetrics: opsMetricsEnabled,
},
});
return { alternates: [], nextTimes: [], reason: message };
}

if (!window) {
const reason = "Booking time is incomplete; cannot determine seating window";
await emitSelectorQuote({
restaurantId,
bookingId,
partySize,
window: { start: bookingRow.start_at, end: bookingRow.end_at },
candidates: [],
selected: null,
skipReason: reason,
durationMs: Date.now() - quoteStart,
featureFlags: {
selectorScoring: selectorScoringEnabled,
opsMetrics: opsMetricsEnabled,
},
});
return { alternates: [], nextTimes: [], reason };
}

const targetZoneFilter = zoneId ?? null;
const avoidSet = new Set((avoidTables ?? []).filter(Boolean));
const candidateTables = tables.filter((table) => {
if (targetZoneFilter && table.zoneId !== targetZoneFilter) {
return false;
}
if (avoidSet.has(table.id)) {
return false;
}
return true;
});

const availableTables = filterAvailableTables(
candidateTables,
partySize,
window,
schedule,
bookingRecord?.seating_preference
? { partySize, seatingPreference: bookingRecord.seating_preference }
: undefined,
bookingId,
);

if (availableTables.length === 0) {
const reason = "No suitable tables are available for the booking window";
await emitSelectorQuote({
restaurantId,
bookingId,
partySize,
window: serializeBookingBlockWindow(window),
candidates: [],
selected: null,
skipReason: reason,
durationMs: Date.now() - quoteStart,
featureFlags: {
selectorScoring: selectorScoringEnabled,
opsMetrics: opsMetricsEnabled,
},
});
return { alternates: [], nextTimes: [], reason };
}

const { plans: candidatePlans, fallbackReason } = generateTablePlans(availableTables, partySize, adjacency);

const maxCombinationSize = Math.max(1, Math.min(maxTables ?? getAllocatorKMax(), getAllocatorKMax()));
const filteredPlans = candidatePlans.filter((plan) => plan.tables.length <= maxCombinationSize);

if (filteredPlans.length === 0) {
const reason = fallbackReason ?? "Unable to locate a compatible table combination";
await emitSelectorQuote({
restaurantId,
bookingId,
partySize,
window: serializeBookingBlockWindow(window),
candidates: [],
selected: null,
skipReason: reason,
durationMs: Date.now() - quoteStart,
featureFlags: {
selectorScoring: selectorScoringEnabled,
opsMetrics: opsMetricsEnabled,
},
});
return { alternates: [], nextTimes: [], reason };
}

const candidatePlan = filteredPlans[0];
const alternatePlans = filteredPlans.slice(1, 3);
const candidateSummary = mapPlanToCandidateSummary(candidatePlan);
const alternateSummaries = alternatePlans.map(mapPlanToCandidateSummary);

const quoteDuration = Date.now() - quoteStart;
await emitSelectorQuote({
restaurantId,
bookingId,
partySize,
window: serializeBookingBlockWindow(window),
candidates: [candidateSummary, ...alternateSummaries],
selected: candidateSummary,
skipReason: null,
durationMs: quoteDuration,
featureFlags: {
selectorScoring: selectorScoringEnabled,
opsMetrics: opsMetricsEnabled,
},
});

const holdZoneId = candidatePlan.tables[0]?.zoneId;
if (!holdZoneId) {
throw new Error("Selected candidate is missing zone information");
}

const expiresAt = DateTime.utc().plus({ seconds: holdTtlSeconds }).toISO();
if (!expiresAt) {
throw new Error("Failed to compute hold expiry timestamp");
}

const holdMetadata = {
source: "auto-quote",
candidate: candidateSummary,
alternates: alternateSummaries,
requireAdjacency: requireAdjacency ?? null,
} as const;

const blockStartIso = window.block.start.toISO();
const blockEndIso = window.block.end.toISO();
if (!blockStartIso || !blockEndIso) {
throw new Error("Failed to serialize booking window for hold creation");
}

const hold = await createTableHold({
bookingId,
restaurantId,
zoneId: holdZoneId,
tableIds: candidatePlan.tables.map((table) => table.id),
startAt: blockStartIso,
endAt: blockEndIso,
expiresAt,
createdBy: createdBy ?? null,
metadata: holdMetadata,
client: supabase,
});

await emitHoldCreated({
holdId: hold.id,
bookingId: hold.bookingId,
restaurantId: hold.restaurantId,
zoneId: hold.zoneId,
tableIds: hold.tableIds,
startAt: hold.startAt,
endAt: hold.endAt,
expiresAt: hold.expiresAt,
actorId: createdBy ?? null,
metadata: holdMetadata,
});

return {
hold,
candidate: candidateSummary,
alternates: alternateSummaries,
nextTimes: [],
};
}

export async function confirmHoldAssignment(options: {
holdId: string;
bookingId: string;
idempotencyKey: string;
requireAdjacency?: boolean;
assignedBy?: string | null;
client?: DbClient;
}): Promise<ConfirmHoldResult[]> {
const { holdId, bookingId, idempotencyKey, requireAdjacency, assignedBy, client } = options;
const supabase = client ?? getServiceSupabaseClient();

const holdLookup = await supabase
.from("table_holds")
.select("id, booking_id, restaurant_id, zone_id, start_at, end_at, expires_at, table_hold_members(table_id)")
.eq("id", holdId)
.maybeSingle();

if (holdLookup.error) {
throw new Error(`Failed to load hold ${holdId}: ${holdLookup.error.message}`);
}

const holdRow = holdLookup.data;
if (!holdRow) {
throw new HoldNotFoundError(`Hold ${holdId} not found`);
}

const tableIds =
holdRow.table_hold_members?.map((member) => member.table_id).filter((value): value is string => !!value) ?? [];

try {
const assignments = await confirmTableHold({
holdId,
bookingId,
idempotencyKey,
requireAdjacency,
assignedBy,
client: supabase,
});

    await emitHoldConfirmed({
      holdId,
      bookingId: holdRow.booking_id ?? null,
      restaurantId: holdRow.restaurant_id,
      zoneId: holdRow.zone_id,
      tableIds,
      startAt: holdRow.start_at,
      endAt: holdRow.end_at,
      expiresAt: holdRow.expires_at ?? null,
      actorId: assignedBy ?? null,
    });

    return assignments;

} catch (error) {
if (error instanceof AssignTablesRpcError) {
await emitRpcConflict({
source: "assign_tables_atomic_v2",
bookingId,
restaurantId: holdRow.restaurant_id,
tableIds,
idempotencyKey,
holdId,
error: {
code: error.code ?? null,
message: error.message,
details: error.details ?? null,
hint: error.hint ?? null,
},
});
}

    throw error;

}
}

const MANUAL_HOLD_DEFAULT_TTL_SECONDS = 120;
const MANUAL_HOLD_MIN_TTL_SECONDS = 30;
const MANUAL_HOLD_MAX_TTL_SECONDS = 600;
const MANUAL_HOLD_METADATA_SOURCE = "manual-selection";

function clampManualHoldTtlSeconds(value: number | undefined): number {
if (typeof value !== "number" || Number.isNaN(value) || !Number.isFinite(value)) {
return MANUAL_HOLD_DEFAULT_TTL_SECONDS;
}
const normalized = Math.trunc(value);
return Math.min(MANUAL_HOLD_MAX_TTL_SECONDS, Math.max(MANUAL_HOLD_MIN_TTL_SECONDS, normalized));
}

type ManualSelectionComputation = {
context: ManualSelectionContext;
validation: ManualValidationResult;
};

function evaluateAdjacencyConnectivity(
tables: Table[],
adjacency: Map<string, Set<string>>,
): { connected: boolean; disconnected: string[] } {
if (tables.length <= 1) {
return { connected: true, disconnected: [] };
}

const tableSet = new Set(tables.map((table) => table.id));
const graph = new Map<string, Set<string>>();

for (const tableId of tableSet) {
graph.set(tableId, new Set<string>());
}

for (const [source, neighbors] of adjacency.entries()) {
if (!tableSet.has(source)) {
continue;
}
for (const neighbor of neighbors ?? []) {
if (!tableSet.has(neighbor)) {
continue;
}
graph.get(source)!.add(neighbor);
if (!graph.has(neighbor)) {
graph.set(neighbor, new Set<string>());
}
graph.get(neighbor)!.add(source);
}
}

const start = tables[0]?.id;
if (!start) {
return { connected: true, disconnected: [] };
}

const visited = new Set<string>([start]);
const queue: string[] = [start];

while (queue.length > 0) {
const current = queue.shift()!;
const neighbors = graph.get(current);
if (!neighbors) {
continue;
}
for (const neighbor of neighbors) {
if (!visited.has(neighbor)) {
visited.add(neighbor);
queue.push(neighbor);
}
}
}

const disconnected: string[] = [];
for (const tableId of tableSet) {
if (!visited.has(tableId)) {
disconnected.push(tableId);
}
}

return { connected: disconnected.length === 0, disconnected };
}

async function computeManualSelection(
supabase: DbClient,
options: ManualSelectionOptions,
): Promise<ManualSelectionComputation> {
const { bookingId, requireAdjacency, excludeHoldId } = options;
const normalizedTableIds = Array.from(
new Set(
(options.tableIds ?? []).filter((value): value is string => typeof value === "string" && value.length > 0),
),
);

if (normalizedTableIds.length === 0) {
throw new ManualSelectionInputError("At least one table must be selected", {
status: 400,
code: "NO_TABLES",
});
}

const bookingQuery = await supabase
.from("bookings")
.select("id, restaurant_id, booking_date, start_time, end_time, start_at, end_at, party_size, status")
.eq("id", bookingId)
.maybeSingle();

if (bookingQuery.error) {
throw new Error(`Failed to load booking ${bookingId}: ${bookingQuery.error.message}`);
}

const bookingRow = bookingQuery.data as BookingRowForManual | null;
if (!bookingRow) {
throw new ManualSelectionInputError("Booking not found", { status: 404, code: "BOOKING_NOT_FOUND" });
}

const restaurantId = bookingRow.restaurant_id;
if (!restaurantId) {
throw new Error("Booking is missing restaurant_id");
}

let assignmentDate = bookingRow.booking_date ?? null;
if (!assignmentDate && bookingRow.start_at) {
const parsed = DateTime.fromISO(bookingRow.start_at);
if (parsed.isValid) {
assignmentDate = parsed.toISODate();
}
}

if (!assignmentDate) {
throw new ManualSelectionInputError("Booking date is not set; unable to compute availability window", {
status: 409,
code: "BOOKING_DATE_MISSING",
});
}

const { tables, schedule, policy, adjacency } = await loadAssignmentContext({
restaurantId,
date: assignmentDate,
client: supabase,
});

const tableMap = new Map<string, Table>(tables.map((table) => [table.id, table]));
const selectedTables: Table[] = [];
const missingTableIds: string[] = [];

for (const tableId of normalizedTableIds) {
const table = tableMap.get(tableId);
if (!table) {
missingTableIds.push(tableId);
} else {
selectedTables.push(table);
}
}

if (missingTableIds.length > 0) {
throw new ManualSelectionInputError("One or more selected tables were not found for this restaurant", {
status: 404,
code: "TABLE_NOT_FOUND",
});
}

const zoneIds = new Set(selectedTables.map((table) => table.zoneId).filter((value): value is string => !!value));
const zoneId = zoneIds.size === 1 ? selectedTables[0]?.zoneId ?? null : null;

let window: BookingWindow | null = null;
let windowError: string | null = null;

try {
window = computeBookingWindow({
startISO: bookingRow.start_at,
bookingDate: bookingRow.booking_date,
startTime: bookingRow.start_time,
partySize: bookingRow.party_size ?? 0,
policy,
});
} catch (error) {
windowError = error instanceof Error ? error.message : "Unable to compute booking window";
window = null;
}

const partySize = bookingRow.party_size ?? 0;
const summary: ManualSelectionSummary = {
tableCount: selectedTables.length,
totalCapacity: selectedTables.reduce((sum, table) => sum + (table.capacity ?? 0), 0),
slack: 0,
zoneId,
tableNumbers: selectedTables.map((table) => table.tableNumber ?? table.id),
partySize,
};
summary.slack = summary.totalCapacity - partySize;

const checks: ManualSelectionCheck[] = [];

if (selectedTables.length <= 1) {
checks.push({
id: "sameZone",
status: "ok",
message: "Single table selection",
});
} else if (!zoneId) {
checks.push({
id: "sameZone",
status: "error",
message: "Selected tables do not share a zone",
details: { zones: Array.from(zoneIds) },
});
} else {
checks.push({
id: "sameZone",
status: "ok",
message: "All tables share the same zone",
details: { zoneId },
});
}

const immobileTables = selectedTables.filter((table) => table.mobility !== "movable");
checks.push(
immobileTables.length === 0 || selectedTables.length <= 1
? {
id: "movable",
status: "ok",
message: "Tables meet merge mobility requirements",
}
: {
id: "movable",
status: "error",
message: "Merged selections require movable tables",
details: {
tableIds: immobileTables.map((table) => table.id),
tableNumbers: immobileTables.map((table) => table.tableNumber ?? table.id),
},
},
);

const adjacencyRequired = typeof requireAdjacency === "boolean" ? requireAdjacency : isAllocatorAdjacencyRequired();
const adjacencyResult = evaluateAdjacencyConnectivity(selectedTables, adjacency);

if (selectedTables.length <= 1) {
checks.push({
id: "adjacency",
status: "ok",
message: "Single table selection",
});
} else {
const adjacencyStatus: ManualSelectionCheckStatus = adjacencyResult.connected
? "ok"
: adjacencyRequired
? "error"
: "warn";

    checks.push({
      id: "adjacency",
      status: adjacencyStatus,
      message: adjacencyResult.connected
        ? "Tables form a connected cluster"
        : adjacencyRequired
        ? "Selected tables are not adjacent; adjacency is required"
        : "Selected tables are not adjacent",
      details: adjacencyResult.connected ? undefined : { disconnected: adjacencyResult.disconnected },
    });

}

const windowRange = window ? toInterval(window.block) : null;
const windowStartIso = window?.block.start.toISO() ?? null;
const windowEndIso = window?.block.end.toISO() ?? null;

const tableStatusIssues: { tableId: string; status: string; active: boolean }[] = [];
const assignmentConflicts: { tableId: string; bookingId: string; startAt: string; endAt: string }[] = [];

for (const table of selectedTables) {
if (!table.active) {
tableStatusIssues.push({ tableId: table.id, status: "inactive", active: false });
}
if (table.status && table.status !== "available") {
tableStatusIssues.push({ tableId: table.id, status: table.status, active: table.active });
}

    if (!windowRange) {
      continue;
    }

    const entries = schedule.get(table.id) ?? [];
    for (const entry of entries) {
      if (entry.bookingId === bookingId) {
        continue;
      }
      if (INACTIVE_BOOKING_STATUSES.has(entry.status)) {
        continue;
      }
      if (!windowsOverlap(windowRange, { start: entry.start, end: entry.end })) {
        continue;
      }

      const startIso = DateTime.fromMillis(entry.start).toISO();
      const endIso = DateTime.fromMillis(entry.end).toISO();
      assignmentConflicts.push({
        tableId: table.id,
        bookingId: entry.bookingId,
        startAt: startIso ?? "",
        endAt: endIso ?? "",
      });
    }

}

let holdConflicts: HoldConflictInfo[] = [];
if (windowStartIso && windowEndIso && zoneId) {
holdConflicts = await findHoldConflicts({
restaurantId,
zoneId,
tableIds: normalizedTableIds,
startAt: windowStartIso,
endAt: windowEndIso,
excludeHoldId: excludeHoldId ?? null,
ignoreBookingId: bookingId,
client: supabase,
});
}

const conflictDetails: Record<string, unknown> = {};
if (tableStatusIssues.length > 0) {
conflictDetails.tableStatus = tableStatusIssues;
}
if (assignmentConflicts.length > 0) {
conflictDetails.assignments = assignmentConflicts;
}
if (holdConflicts.length > 0) {
conflictDetails.holds = holdConflicts.map((conflict) => ({
holdId: conflict.holdId,
bookingId: conflict.bookingId,
tableIds: conflict.tableIds,
startAt: conflict.startAt,
endAt: conflict.endAt,
expiresAt: conflict.expiresAt,
}));
}
if (windowError) {
conflictDetails.window = { message: windowError };
}

const bookingStatusIssue = ASSIGNABLE_BOOKING_STATUSES.has(bookingRow.status) ? null : bookingRow.status;
if (bookingStatusIssue) {
conflictDetails.bookingStatus = { status: bookingRow.status };
}

const hasHardConflicts =
tableStatusIssues.length > 0 || assignmentConflicts.length > 0 || holdConflicts.length > 0 || !!windowError;

let conflictStatus: ManualSelectionCheckStatus = "ok";
let conflictMessage = "No conflicts detected";

if (hasHardConflicts) {
conflictStatus = "error";
conflictMessage = "Conflicts detected with existing assignments or holds";
} else if (bookingStatusIssue) {
conflictStatus = "warn";
conflictMessage = `Booking status ${bookingRow.status} may not be assignable`;
}

checks.push({
id: "conflict",
status: conflictStatus,
message: conflictMessage,
details: Object.keys(conflictDetails).length > 0 ? conflictDetails : undefined,
});

const maxPartyBreaches = selectedTables
.filter((table) => typeof table.maxPartySize === "number" && partySize > (table.maxPartySize ?? 0))
.map((table) => ({
tableId: table.id,
tableNumber: table.tableNumber ?? table.id,
maxPartySize: table.maxPartySize,
}));

let capacityStatus: ManualSelectionCheckStatus = "ok";
let capacityMessage = "Capacity requirements satisfied";

if (!Number.isFinite(partySize) || partySize <= 0) {
capacityStatus = "warn";
capacityMessage = "Booking party size is missing or invalid";
} else if (summary.totalCapacity < partySize) {
capacityStatus = "error";
capacityMessage = "Selected tables do not meet the requested party size";
} else if (maxPartyBreaches.length > 0) {
capacityStatus = "error";
capacityMessage = "Party size exceeds maximum for one or more tables";
}

checks.push({
id: "capacity",
status: capacityStatus,
message: capacityMessage,
details: {
partySize,
totalCapacity: summary.totalCapacity,
slack: summary.slack,
maxPartyBreaches,
},
});

const validationOk = checks.every((check) => check.status !== "error");

return {
context: {
booking: bookingRow,
restaurantId,
selectedTables,
zoneId,
window,
},
validation: {
ok: validationOk,
checks,
summary,
},
};
}

export async function evaluateManualSelection(options: ManualSelectionOptions): Promise<ManualValidationResult> {
const supabase = options.client ?? getServiceSupabaseClient();
const { validation } = await computeManualSelection(supabase, options);
return validation;
}

export async function createManualHold(options: ManualHoldOptions): Promise<ManualHoldResult> {
const supabase = options.client ?? getServiceSupabaseClient();
const computation = await computeManualSelection(supabase, options);
const { context, validation } = computation;

if (!validation.ok || !context.window || !context.zoneId) {
return { hold: null, validation };
}

const holdStartIso = context.window.block.start.toISO();
const holdEndIso = context.window.block.end.toISO();
if (!holdStartIso || !holdEndIso) {
throw new Error("Computed booking window is invalid");
}

const ttlSeconds = clampManualHoldTtlSeconds(options.holdTtlSeconds);
const expiry = DateTime.utc().plus({ seconds: ttlSeconds });
const expiresAt = expiry.toISO();
if (!expiresAt) {
throw new Error("Failed to compute hold expiry timestamp");
}

const existingHolds = await listActiveHoldsForBooking({ bookingId: context.booking.id, client: supabase });

for (const hold of existingHolds) {
try {
await releaseTableHold({ holdId: hold.id, client: supabase });
} catch (error) {
console.error("[capacity][manual][hold] failed to release existing hold", {
bookingId: context.booking.id,
holdId: hold.id,
error,
});
}
}

const metadata = {
source: MANUAL_HOLD_METADATA_SOURCE,
selection: {
tableIds: context.selectedTables.map((table) => table.id),
summary: validation.summary,
},
requireAdjacency: typeof options.requireAdjacency === "boolean" ? options.requireAdjacency : null,
};

const hold = await createTableHold({
bookingId: context.booking.id,
restaurantId: context.restaurantId,
zoneId: context.zoneId,
tableIds: context.selectedTables.map((table) => table.id),
startAt: holdStartIso,
endAt: holdEndIso,
expiresAt,
createdBy: options.createdBy ?? null,
metadata,
client: supabase,
});

await emitHoldCreated({
holdId: hold.id,
bookingId: hold.bookingId,
restaurantId: hold.restaurantId,
zoneId: hold.zoneId,
tableIds: hold.tableIds,
startAt: hold.startAt,
endAt: hold.endAt,
expiresAt: hold.expiresAt,
actorId: options.createdBy ?? null,
metadata,
});

return {
hold,
validation,
};
}

export async function getManualAssignmentContext(options: {
bookingId: string;
client?: DbClient;
}): Promise<ManualAssignmentContext> {
const { bookingId, client } = options;
const supabase = client ?? getServiceSupabaseClient();

const bookingQuery = await supabase
.from("bookings")
.select(
"id, restaurant_id, booking_date, start_time, end_time, start_at, end_at, party_size, status",
)
.eq("id", bookingId)
.maybeSingle();

if (bookingQuery.error) {
throw new Error(`Failed to load booking ${bookingId}: ${bookingQuery.error.message}`);
}

const bookingRow = bookingQuery.data as BookingRowForManual | null;
if (!bookingRow) {
throw new ManualSelectionInputError("Booking not found", { status: 404, code: "BOOKING_NOT_FOUND" });
}

const restaurantId = bookingRow.restaurant_id;
if (!restaurantId) {
throw new ManualSelectionInputError("Booking is missing restaurant_id", {
status: 422,
code: "BOOKING_RESTAURANT_MISSING",
});
}

let assignmentDate = bookingRow.booking_date ?? null;
if (!assignmentDate && bookingRow.start_at) {
const parsed = DateTime.fromISO(bookingRow.start_at);
if (parsed.isValid) {
assignmentDate = parsed.toISODate();
}
}

if (!assignmentDate) {
throw new ManualSelectionInputError("Booking date is not set; unable to load manual assignment context", {
status: 409,
code: "BOOKING_DATE_MISSING",
});
}

const { tables, schedule, policy } = await loadAssignmentContext({
restaurantId,
date: assignmentDate,
client: supabase,
});

let bookingWindow: BookingWindow | null = null;
try {
bookingWindow = computeBookingWindow({
startISO: bookingRow.start_at,
bookingDate: bookingRow.booking_date,
startTime: bookingRow.start_time,
partySize: bookingRow.party_size ?? 0,
policy,
});
} catch (error) {
console.warn("[capacity][manual][context] failed to compute booking window", {
bookingId,
error,
});
}

const windowStartIso = bookingWindow?.block.start.toISO() ?? null;
const windowEndIso = bookingWindow?.block.end.toISO() ?? null;
const windowRange = bookingWindow ? toInterval(bookingWindow.block) : null;

const { data: assignmentRows, error: assignmentError } = await supabase
.from("booking_table_assignments")
.select("table_id")
.eq("booking_id", bookingId);

if (assignmentError) {
throw new Error(`Failed to load booking assignments for ${bookingId}: ${assignmentError.message}`);
}

const bookingAssignments = new Set<string>(
(assignmentRows ?? [])
.map((row) => (typeof row?.table_id === "string" ? row.table_id : null))
.filter((value): value is string => !!value),
);

const now = DateTime.utc();
const nowIso = now.toISO();
const holdsFeatureEnabled = isHoldsEnabled();

type HoldRowWithMembers = Tables<"table_holds"> & {
table_hold_members: { table_id: string }[] | null;
};

let holdRows: HoldRowWithMembers[] = [];

if (holdsFeatureEnabled) {
let holdQuery = supabase
.from("table_holds")
.select(
"id, booking_id, restaurant_id, zone_id, start_at, end_at, expires_at, created_by, metadata, table_hold_members(table_id)",
)
.eq("restaurant_id", restaurantId)
.gt("expires_at", nowIso);

    if (windowStartIso && windowEndIso) {
      holdQuery = holdQuery.lt("start_at", windowEndIso).gt("end_at", windowStartIso);
    }

    const { data, error } = await holdQuery;

    if (error) {
      if (isMissingSupabaseTableError(error, "table_holds") || isPermissionDeniedError(error, "table_holds")) {
        console.warn("[capacity][manual][context] holds table unavailable or access denied; skipping hold hydration", {
          bookingId,
          restaurantId,
          error,
        });
      } else {
        throw new Error(`Failed to load active holds for manual assignment context: ${error.message}`);
      }
    } else if (Array.isArray(data) && data.length > 0) {
      holdRows = (data as HoldRowWithMembers[]).filter(
        (value): value is HoldRowWithMembers => Boolean(value),
      );
    }

}

const creatorIds = new Set<string>();
for (const hold of holdRows) {
if (hold?.created_by && typeof hold.created_by === "string") {
creatorIds.add(hold.created_by);
}
}

const creatorProfiles = new Map<string, { name: string | null; email: string | null }>();
if (creatorIds.size > 0) {
const { data: profileRows, error: profileError } = await supabase
.from("profiles")
.select("id, name, email")
.in("id", Array.from(creatorIds));

    if (profileError) {
      console.warn("[capacity][manual][context] failed to load hold owner profiles", {
        error: profileError,
      });
    } else {
      for (const profile of profileRows ?? []) {
        if (profile?.id && typeof profile.id === "string") {
          creatorProfiles.set(profile.id, {
            name: typeof profile.name === "string" ? profile.name : null,
            email: typeof profile.email === "string" ? profile.email : null,
          });
        }
      }
    }

}

const holds: ManualAssignmentHoldState[] = holdRows.map((hold) => {
const tableIds =
hold.table_hold_members
?.map((member) => (typeof member?.table_id === "string" ? member.table_id : null))
.filter((value): value is string => !!value) ?? [];

    const profile = hold.created_by ? creatorProfiles.get(hold.created_by) ?? null : null;
    const expires = typeof hold.expires_at === "string" ? DateTime.fromISO(hold.expires_at) : null;
    const countdownSeconds =
      expires && expires.isValid ? Math.max(0, Math.trunc(expires.diff(now, "seconds").seconds ?? 0)) : null;

    const metadata =
      hold.metadata && typeof hold.metadata === "object" && !Array.isArray(hold.metadata)
        ? (hold.metadata as Record<string, unknown>)
        : null;

    return {
      id: hold.id,
      bookingId: hold.booking_id ?? null,
      restaurantId: hold.restaurant_id,
      zoneId: hold.zone_id,
      startAt: hold.start_at,
      endAt: hold.end_at,
      expiresAt: hold.expires_at,
      tableIds,
      createdBy: hold.created_by ?? null,
      createdByName: profile?.name ?? null,
      createdByEmail: profile?.email ?? null,
      metadata,
      countdownSeconds,
    };

});

const activeHold = holds.find((hold) => hold.bookingId === bookingId) ?? null;

const conflicts: ManualAssignmentConflict[] = [];
if (windowRange) {
for (const [tableId, entries] of schedule.entries()) {
for (const entry of entries) {
if (entry.bookingId === bookingId) {
continue;
}
if (!windowsOverlap(windowRange, { start: entry.start, end: entry.end })) {
continue;
}

        const startIso = DateTime.fromMillis(entry.start).toISO();
        const endIso = DateTime.fromMillis(entry.end).toISO();

        if (!startIso || !endIso) {
          continue;
        }

        conflicts.push({
          tableId,
          bookingId: entry.bookingId,
          startAt: startIso,
          endAt: endIso,
          status: entry.status,
        });
      }
    }

}

return {
booking: {
id: bookingRow.id,
restaurantId,
bookingDate: bookingRow.booking_date ?? null,
startAt: bookingRow.start_at ?? null,
endAt: bookingRow.end_at ?? null,
partySize: bookingRow.party_size ?? 0,
status: bookingRow.status,
},
tables,
bookingAssignments: Array.from(bookingAssignments),
holds,
activeHold,
conflicts,
window: {
startAt: windowStartIso,
endAt: windowEndIso,
},
};
}

/\*\*

- Unassign a table from a booking
-
- v1: Calls RPC function
- v2: Will add business logic
-
- @param bookingId - Booking ID
- @param tableId - Table ID
- @param client - Optional Supabase client
- @returns Success boolean
  \*/
  export async function unassignTableFromBooking(
  bookingId: string,
  tableId: string,
  client?: DbClient
  ): Promise<boolean> {
  const supabase = client ?? getServiceSupabaseClient();
  const result = await invokeUnassignTablesAtomic({
  bookingId,
  tableIds: [tableId],
  client: supabase,
  });
  return result.length > 0;
  }

type AtomicAssignmentResult = {
tableId: string;
assignmentId?: string;
startAt?: string;
endAt?: string;
mergeGroupId?: string | null;
};

async function fetchBookingForAtomic(bookingId: string, client: DbClient): Promise<BookingRowForAtomic> {
const { data, error } = await client
.from("bookings")
.select("id, restaurant_id, booking_date, start_time, end_time, start_at, end_at, restaurants(timezone)")
.eq("id", bookingId)
.maybeSingle();

if (error) {
throw new Error(`Failed to load booking for atomic assignment: ${error.message}`);
}

if (!data) {
throw new Error(`Booking ${bookingId} not found`);
}

const bookingRow = data as BookingRowForAtomicSupabase;
const restaurant = Array.isArray(bookingRow.restaurants)
? bookingRow.restaurants[0] ?? null
: bookingRow.restaurants ?? null;

return {
id: bookingRow.id,
restaurant_id: bookingRow.restaurant_id,
booking_date: bookingRow.booking_date,
start_time: bookingRow.start_time,
end_time: bookingRow.end_time,
start_at: bookingRow.start_at,
end_at: bookingRow.end_at,
restaurants: restaurant,
};
}

async function invokeAssignTablesAtomic(params: {
bookingId: string;
tableIds: string[];
assignedBy?: string | null;
idempotencyKey?: string | null;
client: DbClient;
window?: { range: string; start: string; end: string };
requireAdjacency?: boolean;
}): Promise<AtomicAssignmentResult[]> {
const { bookingId, tableIds, assignedBy, idempotencyKey, client, window, requireAdjacency } = params;

if (!Array.isArray(tableIds) || tableIds.length === 0) {
throw new Error("assign_tables_atomic requires at least one table id");
}

const adjacencyRequired =
typeof requireAdjacency === "boolean" ? requireAdjacency : isAllocatorAdjacencyRequired();

const { data, error } = await client.rpc("assign_tables_atomic_v2", {
p_booking_id: bookingId,
p_table_ids: tableIds,
p_idempotency_key: idempotencyKey ?? null,
p_require_adjacency: adjacencyRequired,
p_assigned_by: assignedBy ?? null,
});

if (error) {
const wrapped = AtomicAssignmentError.fromPostgrest(error);
if (wrapped.code === "42883") {
throw new AtomicAssignmentError(
"assign_tables_atomic_v2 RPC is not available; run the latest Supabase migrations.",
{
code: wrapped.code,
details: wrapped.details ?? null,
hint: "Apply migration 20251026105000_assign_tables_atomic_v2.sql and confirm service role grants.",
cause: wrapped,
},
);
}
throw wrapped;
}

const rows = Array.isArray(data) ? data : [];
if (rows.length === 0) {
return [];
}

const { data: assignmentRows, error: assignmentError } = await client
.from("booking_table_assignments")
.select("table_id, id")
.eq("booking_id", bookingId)
.in("table_id", tableIds);

if (assignmentError) {
throw new Error(`assign_tables_atomic_v2 succeeded but fetching assignments failed: ${assignmentError.message}`);
}

const assignmentByTable = new Map<string, string>();
for (const row of assignmentRows ?? []) {
if (row && typeof row.table_id === "string" && typeof row.id === "string") {
assignmentByTable.set(row.table_id, row.id);
}
}

return rows.map((row: any) => ({
tableId: row.table_id as string,
assignmentId: assignmentByTable.get(row.table_id as string),
startAt: row.start_at ?? null,
endAt: row.end_at ?? null,
mergeGroupId: row.merge_group_id ?? null,
}));
}

async function invokeUnassignTablesAtomic(params: {
bookingId: string;
tableIds?: string[];
client: DbClient;
}): Promise<string[]> {
const { bookingId, tableIds, client } = params;

const { data, error } = await client.rpc("unassign_tables_atomic", {
p_booking_id: bookingId,
p_table_ids: tableIds && tableIds.length > 0 ? tableIds : null,
});

if (error) {
throw new Error(`Failed to unassign tables atomically: ${error.message}`);
}

const rows = Array.isArray(data) ? data : [];
return rows.map((row: any) => row.table_id as string);
}

/\*\*

- Get table assignments for a booking
-
- @param bookingId - Booking ID
- @param client - Optional Supabase client
- @returns Array of table assignments
  \*/
  export async function getBookingTableAssignments(
  bookingId: string,
  client?: DbClient
  ): Promise<TableAssignmentGroup[]> {
  const supabase = client ?? getServiceSupabaseClient();

const { data, error } = await supabase
.from("booking_table_assignments")
.select(`       table_id,
      table_inventory (
        table_number,
        capacity,
        section
      )
    `)
.eq("booking_id", bookingId);

if (error) {
throw new Error(`Failed to get table assignments: ${error.message}`);
}

const groups = new Map<string, TableAssignmentGroup>();

for (const assignment of data ?? []) {
const tableId: string = assignment.table_id;
const tableMeta = normalizeRelationshipRecord<TableInventoryRecord>(assignment.table_inventory);
const groupKey = tableId;

    let group = groups.get(groupKey);
    if (!group) {
      group = {
        groupId: null,
        capacitySum: null,
        members: [],
      };
      const tableCapacity = getNumericCapacity(tableMeta?.capacity);
      if (tableCapacity !== null) {
        group.capacitySum = tableCapacity;
      }
      groups.set(groupKey, group);
    }

    group.members.push({
      tableId,
      tableNumber: typeof tableMeta?.table_number === "string" ? tableMeta.table_number : "Unknown",
      capacity: typeof tableMeta?.capacity === "number" ? tableMeta.capacity : null,
      section: tableMeta?.section ?? null,
    });

}

return Array.from(groups.values()).map((group) => {
if (group.capacitySum === null) {
const computed = group.members.reduce((sum, member) => sum + (member.capacity ?? 0), 0);
group.capacitySum = computed > 0 ? computed : null;
}
return {
groupId: group.groupId,
capacitySum: group.capacitySum,
members: group.members,
};
});
}

// =====================================================
// Auto-Assignment Algorithm
// =====================================================

export type AutoAssignTablesOptions = {
restaurantId: string;
date: string;
assignedBy?: string | null;
client?: DbClient;
};

/\*\*

- Auto-assign tables for a single booking.
-
- @param bookingId - Booking identifier
- @param \_partySize - (legacy) desired party size, fetched from booking record instead
- @param preferences - Optional preference overrides (e.g., seating type)
- @param options - Restaurant/date context for the assignment run
  \*/
  export async function autoAssignTables(
  bookingId: string,
  \_partySize: number,
  preferences?: TableMatchParams,
  options?: AutoAssignTablesOptions,
  ): Promise<string[]> {
  if (!options) {
  throw new Error("autoAssignTables requires restaurantId and date options");
  }

const supabase = options.client ?? getServiceSupabaseClient();
const preferenceOverrides = new Map<string, TableMatchParams>();

if (preferences) {
preferenceOverrides.set(bookingId, preferences);
}

const result = await autoAssignTablesInternal({
restaurantId: options.restaurantId,
date: options.date,
assignedBy: options.assignedBy,
client: supabase,
targetBookingIds: new Set([bookingId]),
preferenceOverrides,
});

const success = result.assigned.find((entry) => entry.bookingId === bookingId);
if (success) {
return success.tableIds;
}

const failure = result.skipped.find((entry) => entry.bookingId === bookingId);
if (failure) {
throw new Error(failure.reason || "Unable to assign tables to booking");
}

return [];
}

export type AutoAssignTablesForDateParams = {
restaurantId: string;
date: string;
assignedBy?: string | null;
client?: DbClient;
};

export async function autoAssignTablesForDate(params: AutoAssignTablesForDateParams): Promise<AutoAssignResult> {
const { restaurantId, date, assignedBy, client } = params;
const supabase = client ?? getServiceSupabaseClient();

return autoAssignTablesInternal({
restaurantId,
date,
assignedBy,
client: supabase,
});
}

// =====================================================
// Helper Functions
// =====================================================

/\*\*

- Check if a table is available at a specific time
-
- v1: Basic implementation
- v2: Add slot-level checking
  \*/
  export async function isTableAvailable(
  tableId: string,
  date: string,
  startTime: string,
  endTime: string,
  client?: DbClient
  ): Promise<boolean> {
  const supabase = client ?? getServiceSupabaseClient();

// Check if table has any conflicting assignments
const { data, error } = await supabase
.from("booking_table_assignments")
.select(`       id,
      bookings!inner (
        booking_date,
        start_time,
        end_time,
        status
      )
    `)
.eq("table_id", tableId);

if (error) {
throw new Error(`Failed to check table availability: ${error.message}`);
}

// Check for time overlaps with active bookings
const hasConflict = (data ?? []).some((assignment: any) => {
const booking = assignment.bookings;

    // Skip cancelled/no-show bookings
    if (["cancelled", "no_show"].includes(booking.status)) {
      return false;
    }

    // Same date?
    if (booking.booking_date !== date) {
      return false;
    }

    // Time overlap?
    // Booking: [booking.start_time, booking.end_time)
    // Requested: [startTime, endTime)
    // Overlap if: booking.start_time < endTime AND startTime < booking.end_time
    return booking.start_time < endTime && startTime < booking.end_time;

});

return !hasConflict;
}

export const \_\_internal = {
computeBookingWindow,
windowsOverlap,
resolveStartDateTime,
};

## server/capacity/holds.ts

import { DateTime } from "luxon";

import { isAllocatorAdjacencyRequired } from "@/server/feature-flags";
import { getServiceSupabaseClient } from "@/server/supabase";

import type { Database, Json, Tables } from "@/types/supabase";
import type { PostgrestError, SupabaseClient } from "@supabase/supabase-js";

type DbClient = SupabaseClient<Database, "public", any>;

const MISSING_TABLE_ERROR_CODES = new Set(["42P01", "PGRST202"]);
const PERMISSION_DENIED_ERROR_CODES = new Set(["42501", "PGRST301"]);

function isMissingSupabaseTableError(
error: PostgrestError | null | undefined,
table: string,
): boolean {
if (!error) {
return false;
}

const code = typeof error.code === "string" ? error.code.toUpperCase() : "";
if (code && MISSING_TABLE_ERROR_CODES.has(code)) {
return true;
}

const normalizedTable = table.toLowerCase();
const schemaQualified = `public.${normalizedTable}`;

const toText = (value: unknown): string => {
return typeof value === "string" ? value.toLowerCase() : "";
};

const haystacks = [toText(error.message), toText(error.details), toText((error as { hint?: unknown })?.hint)];

return haystacks.some((text) => {
if (!text) {
return false;
}

    const referencesTable =
      text.includes(schemaQualified) ||
      text.includes(`"${schemaQualified}"`) ||
      text.includes(`'${schemaQualified}'`) ||
      text.includes(normalizedTable);

    if (!referencesTable) {
      return false;
    }

    return (
      text.includes("schema cache") ||
      text.includes("does not exist") ||
      text.includes("missing sql table") ||
      text.includes("could not find the table")
    );

});
}

function isPermissionDeniedError(
error: PostgrestError | null | undefined,
table: string,
): boolean {
if (!error) {
return false;
}

const code = typeof error.code === "string" ? error.code.toUpperCase() : "";
if (code && PERMISSION_DENIED_ERROR_CODES.has(code)) {
return true;
}

const normalizedTable = table.toLowerCase();
const message = typeof error.message === "string" ? error.message.toLowerCase() : "";

return message.includes("permission denied") && message.includes(normalizedTable);
}

export class HoldConflictError extends Error {
holdId?: string;
constructor(message: string, holdId?: string) {
super(message);
this.name = "HoldConflictError";
this.holdId = holdId;
}
}

export class HoldNotFoundError extends Error {
constructor(message: string) {
super(message);
this.name = "HoldNotFoundError";
}
}

export type TableHoldSummary = {
id: string;
bookingId: string | null;
restaurantId: string;
zoneId: string;
startAt: string;
endAt: string;
expiresAt: string;
tableIds: string[];
};

export type ConfirmHoldResult = {
tableId: string;
assignmentId?: string;
startAt?: string | null;
endAt?: string | null;
mergeGroupId?: string | null;
};

type HoldRow = Tables<"table_holds"> & {
table_hold_members: { table_id: string }[] | null;
};

function mapHoldRow(row: HoldRow): TableHoldSummary {
const members = Array.isArray(row.table_hold_members) ? row.table_hold_members : [];
const tableIds = members
.map((member) => member.table_id)
.filter((value): value is string => typeof value === "string" && value.length > 0);

return {
id: row.id,
bookingId: row.booking_id ?? null,
restaurantId: row.restaurant_id,
zoneId: row.zone_id,
startAt: row.start_at,
endAt: row.end_at,
expiresAt: row.expires_at,
tableIds,
};
}

function resolveClient(client?: DbClient): DbClient {
return client ?? getServiceSupabaseClient();
}

function toRange(startAt: string, endAt: string): string {
return `[${startAt},${endAt})`;
}

async function cleanupHoldArtifacts(client: DbClient, holdId: string): Promise<void> {
try {
await client.from("allocations").delete().match({
resource_type: "hold",
resource_id: holdId,
});
} catch (error) {
console.error("[capacity][holds] failed to remove mirrored allocation", { holdId, error });
}

try {
await client.from("table_holds").delete().eq("id", holdId);
} catch (error) {
console.error("[capacity][holds] failed to delete hold shell during cleanup", { holdId, error });
}
}

function normalizeTableIds(tableIds: string[]): string[] {
const unique = new Set(tableIds.filter((value) => typeof value === "string" && value.length > 0));
return Array.from(unique);
}

export type HoldConflictInfo = {
holdId: string;
bookingId: string | null;
tableIds: string[];
startAt: string;
endAt: string;
expiresAt: string;
};

export async function listActiveHoldsForBooking(params: { bookingId: string; client?: DbClient }): Promise<TableHoldSummary[]> {
const { bookingId, client } = params;
const supabase = resolveClient(client);
const nowIso = new Date().toISOString();

const { data, error } = await supabase
.from("table_holds")
.select("id, booking_id, restaurant_id, zone_id, start_at, end_at, expires_at, table_hold_members(table_id)")
.eq("booking_id", bookingId)
.gt("expires_at", nowIso);

if (error) {
if (isMissingSupabaseTableError(error, "table_holds") || isPermissionDeniedError(error, "table_holds")) {
console.warn("[capacity][holds] table_holds unavailable or access denied; returning empty holds list", {
bookingId,
error,
});
// Return empty array when table is unavailable
return [];
}
throw new Error(`Failed to list active holds for booking ${bookingId}: ${error.message}`);
}

return (data ?? []).map((row) => mapHoldRow(row as HoldRow));
}

export async function findHoldConflicts(params: {
restaurantId: string;
zoneId: string;
tableIds: string[];
startAt: string;
endAt: string;
excludeHoldId?: string | null;
ignoreBookingId?: string | null;
client?: DbClient;
}): Promise<HoldConflictInfo[]> {
const { restaurantId, zoneId, tableIds, startAt, endAt, excludeHoldId, ignoreBookingId, client } = params;
const supabase = resolveClient(client);

if (tableIds.length === 0) {
return [];
}

const nowIso = new Date().toISOString();

let query = supabase
.from("table_holds")
.select("id, booking_id, restaurant_id, zone_id, start_at, end_at, expires_at, table_hold_members(table_id)")
.eq("restaurant_id", restaurantId)
.eq("zone_id", zoneId)
.gt("expires_at", nowIso)
.lt("start_at", endAt)
.gt("end_at", startAt);

if (excludeHoldId) {
query = query.neq("id", excludeHoldId);
}

const { data, error } = await query;

if (error) {
if (isMissingSupabaseTableError(error, "table_holds") || isPermissionDeniedError(error, "table_holds")) {
console.warn("[capacity][holds] table_holds unavailable or access denied; skipping conflict check", {
restaurantId,
zoneId,
error,
});
// Return empty conflicts array when table is unavailable
return [];
}
throw new Error(`Failed to inspect hold conflicts: ${error.message}`);
}

const selection = new Set(tableIds.filter((value) => typeof value === "string" && value.length > 0));
const conflicts: HoldConflictInfo[] = [];

for (const entry of data ?? []) {
const hold = mapHoldRow(entry as HoldRow);

    if (ignoreBookingId && hold.bookingId && hold.bookingId === ignoreBookingId) {
      continue;
    }

    const intersects = hold.tableIds.some((tableId) => selection.has(tableId));
    if (!intersects) {
      continue;
    }

    conflicts.push({
      holdId: hold.id,
      bookingId: hold.bookingId,
      tableIds: hold.tableIds,
      startAt: hold.startAt,
      endAt: hold.endAt,
      expiresAt: hold.expiresAt,
    });

}

return conflicts;
}

export class AssignTablesRpcError extends Error {
code?: string | null;
details?: string | null;
hint?: string | null;

constructor(error: PostgrestError) {
const missingRpc = error.code === "42883";
const message = missingRpc
? "assign_tables_atomic_v2 RPC is not available; run the latest Supabase migrations."
: error.message ?? "assign_tables_atomic_v2 failed";
super(message);
this.name = "AssignTablesRpcError";
this.code = error.code;
this.details = error.details ?? null;
this.hint = missingRpc
? "Apply migration 20251026105000_assign_tables_atomic_v2.sql and ensure service role grants."
: error.hint ?? null;
}
}

export async function createTableHold(params: {
bookingId: string | null;
restaurantId: string;
zoneId: string;
tableIds: string[];
startAt: string;
endAt: string;
expiresAt: string;
createdBy?: string | null;
metadata?: Json | null;
client?: DbClient;
}): Promise<TableHoldSummary> {
const {
bookingId,
restaurantId,
zoneId,
tableIds: rawTableIds,
startAt,
endAt,
expiresAt,
createdBy,
metadata,
client,
} = params;

const tableIds = normalizeTableIds(rawTableIds);
if (tableIds.length === 0) {
throw new Error("createTableHold requires at least one table id");
}

if (!startAt || !endAt || DateTime.fromISO(startAt) >= DateTime.fromISO(endAt)) {
throw new Error("Invalid hold window");
}

if (!expiresAt || DateTime.fromISO(expiresAt) <= DateTime.utc()) {
throw new Error("ExpiresAt must be in the future");
}

const supabase = resolveClient(client);
const nowIso = new Date().toISOString();

const { data: overlapping, error: overlapError } = await supabase
.from("table_holds")
.select("id, booking_id, start_at, end_at, table_hold_members(table_id)")
.eq("zone_id", zoneId)
.gt("expires_at", nowIso)
.lt("start_at", endAt)
.gt("end_at", startAt);

if (overlapError) {
if (isMissingSupabaseTableError(overlapError, "table_holds") || isPermissionDeniedError(overlapError, "table_holds")) {
console.warn("[capacity][holds] table_holds unavailable or access denied; skipping overlap check for createTableHold", {
restaurantId,
zoneId,
error: overlapError,
});
// Continue without overlap check if table is unavailable
} else {
throw new Error(`Failed to inspect existing holds: ${overlapError.message}`);
}
}

const tableIdSet = new Set(tableIds);
const conflicting = (overlapping ?? []).find((hold) => {
const members = hold.table_hold_members ?? [];
const intersects = members.some((member) => tableIdSet.has(member.table_id ?? ""));
if (!intersects) {
return false;
}

    if (hold.booking_id && bookingId && hold.booking_id === bookingId) {
      // Same booking; treat as conflict so caller can reuse existing hold explicitly.
      return true;
    }
    return true;

});

if (conflicting) {
throw new HoldConflictError("Hold already exists for requested tables/window", conflicting.id ?? undefined);
}

const holdInsert = await supabase
.from("table_holds")
.insert({
booking_id: bookingId,
restaurant_id: restaurantId,
zone_id: zoneId,
start_at: startAt,
end_at: endAt,
expires_at: expiresAt,
created_by: createdBy ?? null,
metadata: (metadata ?? null) as Tables<"table_holds">["metadata"],
})
.select("id, booking_id, restaurant_id, zone_id, start_at, end_at, expires_at")
.maybeSingle();

if (holdInsert.error || !holdInsert.data) {
const error = holdInsert.error;
if (error && (isMissingSupabaseTableError(error, "table_holds") || isPermissionDeniedError(error, "table_holds"))) {
throw new Error(`Cannot create hold: table_holds is unavailable or access is denied. Please check database permissions.`);
}
throw new Error(`Failed to create hold: ${holdInsert.error?.message ?? "unknown error"}`);
}

const hold = holdInsert.data;

const memberRows = tableIds.map((tableId) => ({
hold_id: hold.id,
table_id: tableId,
}));

const membersInsert = await supabase.from("table_hold_members").insert(memberRows);
if (membersInsert.error) {
await cleanupHoldArtifacts(supabase, hold.id);
throw new Error(`Failed to register hold members: ${membersInsert.error.message}`);
}

const allocationInsert = await supabase.from("allocations").insert({
booking_id: bookingId,
restaurant_id: restaurantId,
resource_type: "hold",
resource_id: hold.id,
window: toRange(startAt, endAt),
created_by: createdBy ?? null,
shadow: false,
is_maintenance: false,
});

if (allocationInsert.error) {
await cleanupHoldArtifacts(supabase, hold.id);
throw new Error(`Failed to mirror hold into allocations: ${allocationInsert.error.message}`);
}

return {
id: hold.id,
bookingId: hold.booking_id ?? null,
restaurantId: hold.restaurant_id,
zoneId: hold.zone_id,
startAt: hold.start_at,
endAt: hold.end_at,
expiresAt: hold.expires_at,
tableIds,
};
}

function mapAssignmentsToResult(tableIds: string[], rows: any[], assignmentRows: any[]): ConfirmHoldResult[] {
const assignmentByTable = new Map<string, string>();
for (const row of assignmentRows ?? []) {
if (row && typeof row.table_id === "string" && typeof row.id === "string") {
assignmentByTable.set(row.table_id, row.id);
}
}

return rows.map((row: any) => ({
tableId: row.table_id as string,
assignmentId: assignmentByTable.get(row.table_id as string),
startAt: row.start_at ?? null,
endAt: row.end_at ?? null,
mergeGroupId: row.merge_group_id ?? null,
}));
}

export async function confirmTableHold(params: {
holdId: string;
bookingId: string;
idempotencyKey: string;
requireAdjacency?: boolean;
assignedBy?: string | null;
client?: DbClient;
}): Promise<ConfirmHoldResult[]> {
const { holdId, bookingId, idempotencyKey, requireAdjacency, assignedBy, client } = params;

const supabase = resolveClient(client);
const now = DateTime.utc();

const { data: holdRow, error: holdError } = await supabase
.from("table_holds")
.select("id, booking_id, restaurant_id, zone_id, start_at, end_at, expires_at, table_hold_members(table_id)")
.eq("id", holdId)
.maybeSingle();

if (holdError) {
if (isMissingSupabaseTableError(holdError, "table_holds") || isPermissionDeniedError(holdError, "table_holds")) {
throw new Error(`Cannot confirm hold: table_holds is unavailable or access is denied. Please check database permissions.`);
}
throw new Error(`Failed to load hold ${holdId}: ${holdError.message}`);
}

if (!holdRow) {
throw new HoldNotFoundError(`Hold ${holdId} not found`);
}

if (holdRow.booking_id && holdRow.booking_id !== bookingId) {
throw new HoldConflictError("Hold belongs to a different booking", holdRow.id ?? undefined);
}

if (DateTime.fromISO(holdRow.expires_at ?? "").diff(now).milliseconds <= 0) {
await cleanupHoldArtifacts(supabase, holdRow.id);
throw new HoldConflictError("Hold has already expired", holdRow.id ?? undefined);
}

const memberTableIds =
holdRow.table_hold_members?.map((member) => member.table_id).filter((value): value is string => !!value) ?? [];
if (memberTableIds.length === 0) {
await cleanupHoldArtifacts(supabase, holdRow.id);
throw new Error("Hold has no table members");
}

const adjacencyRequired =
typeof requireAdjacency === "boolean" ? requireAdjacency : isAllocatorAdjacencyRequired();

const { data, error } = await supabase.rpc("assign_tables_atomic_v2", {
p_booking_id: bookingId,
p_table_ids: memberTableIds,
p_idempotency_key: idempotencyKey,
p_require_adjacency: adjacencyRequired,
p_assigned_by: assignedBy ?? null,
});

if (error) {
throw new AssignTablesRpcError(error);
}

const rows = Array.isArray(data) ? data : [];
if (rows.length === 0) {
throw new Error("assign_tables_atomic_v2 returned no assignments");
}

const { data: assignmentRows, error: assignmentError } = await supabase
.from("booking_table_assignments")
.select("table_id, id")
.eq("booking_id", bookingId)
.in("table_id", memberTableIds);

if (assignmentError) {
throw new Error(`Failed to fetch assignment ids after confirming hold: ${assignmentError.message}`);
}

await cleanupHoldArtifacts(supabase, holdRow.id);

return mapAssignmentsToResult(memberTableIds, rows, assignmentRows ?? []);
}

export async function releaseTableHold(params: { holdId: string; client?: DbClient }): Promise<void> {
const { holdId, client } = params;
const supabase = resolveClient(client);
await cleanupHoldArtifacts(supabase, holdId);
}

export async function sweepExpiredHolds(params?: {
now?: string;
limit?: number;
client?: DbClient;
}): Promise<{ total: number; deleted: number }> {
const { now, limit = 50, client } = params ?? {};
const supabase = resolveClient(client);
const cutoff = now ?? new Date().toISOString();

const { data: holds, error } = await supabase
.from("table_holds")
.select("id")
.lte("expires_at", cutoff)
.order("expires_at", { ascending: true })
.limit(limit);

if (error) {
if (isMissingSupabaseTableError(error, "table_holds") || isPermissionDeniedError(error, "table_holds")) {
console.warn("[capacity][holds] table_holds unavailable or access denied; skipping expired holds cleanup", {
error,
});
return { total: 0, deleted: 0 };
}
throw new Error(`Failed to list expired holds: ${error.message}`);
}

const holdIds = (holds ?? []).map((hold) => hold.id).filter((value): value is string => !!value);

for (const holdId of holdIds) {
await cleanupHoldArtifacts(supabase, holdId);
}

return { total: holdIds.length, deleted: holdIds.length };
}

## server/capacity/selector.ts

import type { SelectorScoringConfig, SelectorScoringWeights } from "./policy";
import type { Table } from "./tables";

export type CandidateMetrics = {
overage: number;
tableCount: number;
fragmentation: number;
zoneBalance: number;
adjacencyCost: number;
};

export type RankedTablePlan = {
tables: Table[];
totalCapacity: number;
slack: number;
metrics: CandidateMetrics;
score: number;
tableKey: string;
};

export type CandidateDiagnostics = {
singlesConsidered: number;
skipped: Record<string, number>;
};

export type BuildCandidatesOptions = {
tables: Table[];
partySize: number;
adjacency: Map<string, Set<string>>;
config: SelectorScoringConfig;
};

export type BuildCandidatesResult = {
plans: RankedTablePlan[];
fallbackReason?: string;
diagnostics: CandidateDiagnostics;
};

const FALLBACK_NO_TABLES = "No tables meet the capacity requirements for this party size.";

export function buildScoredTablePlans(options: BuildCandidatesOptions): BuildCandidatesResult {
const { tables, partySize, config } = options;
const { maxOverage, weights } = config;

const plans: RankedTablePlan[] = [];
const diagnostics: CandidateDiagnostics = {
singlesConsidered: 0,
skipped: Object.create(null) as Record<string, number>,
};

const maxAllowedCapacity = partySize + Math.max(maxOverage, 0);

const singleTableCandidates = tables.filter((table) => {
const capacity = table.capacity ?? 0;
if (!Number.isFinite(capacity) || capacity <= 0) {
return false;
}
if (capacity < partySize) {
return false;
}
if (capacity > maxAllowedCapacity) {
return false;
}
if (typeof table.maxPartySize === "number" && table.maxPartySize > 0 && partySize > table.maxPartySize) {
return false;
}
return true;
});

diagnostics.singlesConsidered = singleTableCandidates.length;

for (const table of singleTableCandidates) {
const adjacencyDepths = new Map<string, number>([[table.id, 0]]);
const metrics = computeMetrics([table], partySize, adjacencyDepths);
const score = computeScore(metrics, weights);
const totalCapacity = metrics.overage + partySize;
const tableKey = buildTableKey([table]);

    plans.push({
      tables: [table],
      totalCapacity,
      slack: metrics.overage,
      metrics,
      score,
      tableKey,
    });

}

plans.sort((a, b) => comparePlans(a, b, weights));

const fallbackReason = plans.length > 0 ? undefined : FALLBACK_NO_TABLES;

return { plans, fallbackReason, diagnostics };
}

function computeMetrics(tables: Table[], partySize: number, adjacencyDepths: Map<string, number>): CandidateMetrics {
const capacities = tables.map((table) => table.capacity ?? 0);
const totalCapacity = capacities.reduce((sum, capacity) => sum + capacity, 0);
const maxCapacity = capacities.length > 0 ? Math.max(...capacities) : 0;
const overage = Math.max(totalCapacity - partySize, 0);
const fragmentation = Math.max(totalCapacity - maxCapacity, 0);
const zoneIds = new Set(tables.map((table) => table.zoneId ?? null));
const zoneBalance = Math.max(zoneIds.size - 1, 0);
const adjacencyCost = Math.max(...(adjacencyDepths.size > 0 ? [...adjacencyDepths.values()] : [0]));

return {
overage,
tableCount: tables.length,
fragmentation,
zoneBalance,
adjacencyCost,
};
}

function computeScore(metrics: CandidateMetrics, weights: SelectorScoringWeights): number {
return (
metrics.overage _ weights.overage +
(metrics.tableCount - 1) _ weights.tableCount +
metrics.fragmentation _ weights.fragmentation +
metrics.zoneBalance _ weights.zoneBalance +
metrics.adjacencyCost \* weights.adjacencyCost
);
}

function comparePlans(a: RankedTablePlan, b: RankedTablePlan, weights: SelectorScoringWeights): number {
if (a.score !== b.score) {
return a.score - b.score;
}

if (a.metrics.overage !== b.metrics.overage) {
return a.metrics.overage - b.metrics.overage;
}

if (a.metrics.tableCount !== b.metrics.tableCount) {
return a.metrics.tableCount - b.metrics.tableCount;
}

if (a.totalCapacity !== b.totalCapacity) {
return a.totalCapacity - b.totalCapacity;
}

if (a.metrics.fragmentation !== b.metrics.fragmentation) {
return a.metrics.fragmentation - b.metrics.fragmentation;
}

if (a.metrics.adjacencyCost !== b.metrics.adjacencyCost) {
return a.metrics.adjacencyCost - b.metrics.adjacencyCost;
}

return a.tableKey.localeCompare(b.tableKey, "en");
}

function buildTableKey(tables: Table[]): string {
return tables
.map((table) => table.tableNumber ?? table.id)
.sort((a, b) => a.localeCompare(b))
.join("+");
}

## src/app/api/staff/manual/hold/route.ts

import { NextResponse } from "next/server";
import { z } from "zod";

import { HoldConflictError, releaseTableHold } from "@/server/capacity/holds";
import { ManualSelectionInputError, createManualHold } from "@/server/capacity/tables";
import { getRouteHandlerSupabaseClient, getServiceSupabaseClient } from "@/server/supabase";

import type { NextRequest } from "next/server";

const holdPayloadSchema = z.object({
bookingId: z.string().uuid(),
tableIds: z.array(z.string().uuid()).min(1),
holdTtlSeconds: z.number().int().min(30).max(600).optional(),
requireAdjacency: z.boolean().optional(),
excludeHoldId: z.string().uuid().optional(),
});

const holdReleaseSchema = z.object({
holdId: z.string().uuid(),
bookingId: z.string().uuid(),
});

export async function POST(req: NextRequest) {
const supabase = await getRouteHandlerSupabaseClient();

const {
data: { user },
error: authError,
} = await supabase.auth.getUser();

if (authError || !user) {
return NextResponse.json({ error: "Unauthorized", code: "UNAUTHORIZED" }, { status: 401 });
}

const body = await req.json().catch(() => null);
const parsed = holdPayloadSchema.safeParse(body);

if (!parsed.success) {
return NextResponse.json(
{ error: "Invalid request payload", code: "INVALID_PAYLOAD", details: parsed.error.flatten() },
{ status: 400 },
);
}

const { bookingId, tableIds, holdTtlSeconds, requireAdjacency, excludeHoldId } = parsed.data;

const bookingLookup = await supabase
.from("bookings")
.select("restaurant_id")
.eq("id", bookingId)
.maybeSingle();

if (bookingLookup.error) {
console.error("[staff/manual/hold] booking lookup failed", { bookingId, error: bookingLookup.error });
return NextResponse.json({ error: "Failed to load booking", code: "BOOKING_LOOKUP_FAILED" }, { status: 500 });
}

const bookingRow = bookingLookup.data;
if (!bookingRow?.restaurant_id) {
return NextResponse.json({ error: "Booking not found", code: "BOOKING_NOT_FOUND" }, { status: 404 });
}

const membership = await supabase
.from("restaurant_memberships")
.select("role")
.eq("restaurant_id", bookingRow.restaurant_id)
.eq("user_id", user.id)
.maybeSingle();

if (membership.error) {
console.error("[staff/manual/hold] membership lookup failed", { bookingId, error: membership.error });
return NextResponse.json({ error: "Failed to verify access", code: "ACCESS_LOOKUP_FAILED" }, { status: 500 });
}

if (!membership.data) {
return NextResponse.json({ error: "Access denied", code: "ACCESS_DENIED" }, { status: 403 });
}

const serviceClient = getServiceSupabaseClient();

try {
const result = await createManualHold({
bookingId,
tableIds,
holdTtlSeconds,
requireAdjacency,
excludeHoldId,
createdBy: user.id,
client: serviceClient,
});

    if (!result.hold) {
      const summary = result.validation.summary;
      return NextResponse.json(
        {
          error: "Validation failed",
          code: "VALIDATION_FAILED",
          validation: result.validation,
          summary,
          details: {
            validation: result.validation,
            summary,
          },
        },
        { status: 409 },
      );
    }

    return NextResponse.json({
      hold: {
        id: result.hold.id,
        expiresAt: result.hold.expiresAt,
        startAt: result.hold.startAt,
        endAt: result.hold.endAt,
        zoneId: result.hold.zoneId,
        tableIds: result.hold.tableIds,
      },
      summary: result.validation.summary,
      validation: result.validation,
    });

} catch (error) {
if (error instanceof ManualSelectionInputError) {
return NextResponse.json(
{ error: error.message, code: error.code },
{ status: error.status },
);
}

    if (error instanceof HoldConflictError) {
      return NextResponse.json(
        {
          error: error.message,
          code: "HOLD_CONFLICT",
          holdId: error.holdId ?? null,
        },
        { status: 409 },
      );
    }

    console.error("[staff/manual/hold] unexpected error", { error, bookingId, userId: user.id });
    const message = error instanceof Error ? error.message : "Unexpected error";
    return NextResponse.json({ error: message, code: "INTERNAL_ERROR" }, { status: 500 });

}
}

export async function DELETE(req: NextRequest) {
const supabase = await getRouteHandlerSupabaseClient();

const {
data: { user },
error: authError,
} = await supabase.auth.getUser();

if (authError || !user) {
return NextResponse.json({ error: "Unauthorized", code: "UNAUTHORIZED" }, { status: 401 });
}

const body = await req.json().catch(() => null);
const parsed = holdReleaseSchema.safeParse(body);

if (!parsed.success) {
return NextResponse.json(
{ error: "Invalid request payload", code: "INVALID_PAYLOAD", details: parsed.error.flatten() },
{ status: 400 },
);
}

const { holdId, bookingId } = parsed.data;

const holdLookup = await supabase
.from("table_holds")
.select("restaurant_id, booking_id")
.eq("id", holdId)
.maybeSingle();

if (holdLookup.error) {
console.error("[staff/manual/hold][delete] hold lookup failed", { holdId, error: holdLookup.error });
return NextResponse.json({ error: "Failed to load hold", code: "HOLD_LOOKUP_FAILED" }, { status: 500 });
}

const holdRow = holdLookup.data;
if (!holdRow?.restaurant_id) {
return NextResponse.json({ error: "Hold not found", code: "HOLD_NOT_FOUND" }, { status: 404 });
}

if (holdRow.booking_id && holdRow.booking_id !== bookingId) {
return NextResponse.json(
{ error: "Hold belongs to a different booking", code: "HOLD_BOOKING_MISMATCH" },
{ status: 409 },
);
}

const membership = await supabase
.from("restaurant_memberships")
.select("role")
.eq("restaurant_id", holdRow.restaurant_id)
.eq("user_id", user.id)
.maybeSingle();

if (membership.error) {
console.error("[staff/manual/hold][delete] membership lookup failed", { holdId, error: membership.error });
return NextResponse.json({ error: "Failed to verify access", code: "ACCESS_LOOKUP_FAILED" }, { status: 500 });
}

if (!membership.data) {
return NextResponse.json({ error: "Access denied", code: "ACCESS_DENIED" }, { status: 403 });
}

const serviceClient = getServiceSupabaseClient();

try {
await releaseTableHold({ holdId, client: serviceClient });
return NextResponse.json({ holdId, released: true });
} catch (error) {
console.error("[staff/manual/hold][delete] failed to release hold", { holdId, error });
const message = error instanceof Error ? error.message : "Unexpected error";
return NextResponse.json({ error: message, code: "RELEASE_FAILED" }, { status: 500 });
}
}

## src/app/api/staff/auto/confirm/route.ts

import { NextResponse } from "next/server";
import { z } from "zod";

import { AssignTablesRpcError, HoldNotFoundError } from "@/server/capacity/holds";
import { confirmHoldAssignment } from "@/server/capacity/tables";
import { getRouteHandlerSupabaseClient, getServiceSupabaseClient } from "@/server/supabase";

import type { NextRequest } from "next/server";

const confirmPayloadSchema = z.object({
holdId: z.string().uuid(),
bookingId: z.string().uuid(),
idempotencyKey: z.string().min(1),
requireAdjacency: z.boolean().optional(),
});

export async function POST(req: NextRequest) {
const supabase = await getRouteHandlerSupabaseClient();

const {
data: { user },
error: authError,
} = await supabase.auth.getUser();

if (authError || !user) {
return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

const body = await req.json().catch(() => null);
const parsed = confirmPayloadSchema.safeParse(body);

if (!parsed.success) {
return NextResponse.json({ error: "Invalid request payload", details: parsed.error.flatten() }, { status: 400 });
}

const { holdId, bookingId, idempotencyKey, requireAdjacency } = parsed.data;

const holdLookup = await supabase
.from("table_holds")
.select("id, restaurant_id")
.eq("id", holdId)
.maybeSingle();

if (holdLookup.error) {
return NextResponse.json({ error: holdLookup.error.message }, { status: 500 });
}

const holdRow = holdLookup.data;
if (!holdRow || !holdRow.restaurant_id) {
return NextResponse.json({ error: "Hold not found" }, { status: 404 });
}

const membership = await supabase
.from("restaurant_memberships")
.select("role")
.eq("restaurant_id", holdRow.restaurant_id)
.eq("user_id", user.id)
.maybeSingle();

if (membership.error) {
return NextResponse.json({ error: membership.error.message }, { status: 500 });
}

if (!membership.data) {
return NextResponse.json({ error: "Access denied" }, { status: 403 });
}

try {
const serviceClient = getServiceSupabaseClient();
const assignments = await confirmHoldAssignment({
holdId,
bookingId,
idempotencyKey,
requireAdjacency,
assignedBy: user.id,
client: serviceClient,
});

    return NextResponse.json({
      holdId,
      bookingId,
      assignments,
    });

} catch (error) {
if (error instanceof HoldNotFoundError) {
return NextResponse.json({ error: "Hold not found" }, { status: 404 });
}

    if (error instanceof AssignTablesRpcError) {
      return NextResponse.json(
        {
          error: error.message,
          code: error.code,
          details: error.details,
          hint: error.hint,
        },
        { status: 409 },
      );
    }

    console.error("[staff/auto/confirm] unexpected error", { error, holdId, bookingId });
    const message = error instanceof Error ? error.message : "Unexpected error";
    return NextResponse.json({ error: message }, { status: 500 });

}
}
