import { config as loadEnv } from "dotenv";
import { resolve as resolvePath } from "node:path";

loadEnv({ path: resolvePath(process.cwd(), ".env.local") });
loadEnv({ path: resolvePath(process.cwd(), ".env.development") });
loadEnv({ path: resolvePath(process.cwd(), ".env") });

import { randomUUID } from "node:crypto";
import { setTimeout as delay } from "node:timers/promises";
import { DateTime } from "luxon";

import { parseAutoAssignLastResult } from "@/server/capacity/auto-assign-last-result";
import { autoAssignAndConfirmIfPossible } from "@/server/jobs/auto-assign";
import { BOOKING_BLOCKING_STATUSES, getServiceSupabaseClient } from "@/server/supabase";
import { isBookingType, isSeatingPreference, type BookingType, type SeatingPreference, type BookingStatus } from "@/lib/enums";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Tables } from "@/types/supabase";

type BookingRow = Tables<"bookings">;
type AssignmentRow = Tables<"booking_table_assignments"> & {
  table_inventory?: {
    table_number: string | null;
    zone_id: string | null;
    capacity: number | null;
  } | null;
};
type AssignmentStateHistoryRow = Tables<"booking_assignment_state_history">;

const BLOCKING_STATUS_SET = new Set(BOOKING_BLOCKING_STATUSES as BookingStatus[]);
const DEFAULT_MAX_TIMEOUT_MS = 90_000;
const DEFAULT_INLINE_WINDOW_MS = 25_000;
const DEFAULT_POLL_INTERVAL_MS = 2_000;
const DEFAULT_BASE_URL = "http://localhost:3000";
const DEFAULT_CUSTOMER_EMAIL = process.env.TEST_CUSTOMER_EMAIL ?? "booking-flow-script@example.com";
const DEFAULT_CUSTOMER_PHONE = process.env.TEST_CUSTOMER_PHONE ?? "+447700900123";
const DEFAULT_CUSTOMER_NAME = process.env.TEST_CUSTOMER_NAME ?? "Booking Flow Tester";

type CliArgs = {
  help?: boolean;
  restaurantSlug?: string;
  restaurantId?: string;
  date?: string;
  time?: string;
  partySize?: number;
  bookingType?: BookingType;
  seating?: SeatingPreference;
  timeoutMs?: number;
  inlineWindowMs?: number;
  pollIntervalMs?: number;
  baseUrl?: string;
  notes?: string | null;
  name?: string;
  email?: string;
  phone?: string;
  pretty?: boolean;
  marketingOptIn?: boolean;
  count?: number;
  stress?: boolean;
  stressMax?: number;
  randomizeIdentity?: boolean;
};

type AutoAssignResult = ReturnType<typeof parseAutoAssignLastResult>;

type BookingSnapshot = {
  booking: BookingRow;
  assignments: AssignmentRow[];
  autoAssignLastResult: AutoAssignResult;
};

type PollOutcome =
  | { state: "confirmed"; snapshot: BookingSnapshot; attempts: number; durationMs: number }
  | { state: "terminal"; snapshot: BookingSnapshot; attempts: number; durationMs: number }
  | { state: "timeout"; snapshot: BookingSnapshot | null; attempts: number; durationMs: number };

type FlowMetrics = {
  iteration: number;
  correlationId: string;
  submitDurationMs: number;
  inlineAttempts: number;
  inlineDurationMs: number;
  postJobAttempts: number;
  postJobDurationMs: number;
  backgroundInvoked: boolean;
  backgroundDurationMs: number | null;
  totalDurationMs: number;
  tablesAssigned: number;
  totalCapacity: number;
  seatWaste: number;
  tableNumbers: string[];
  partySize: number;
  duplicateRequest: boolean;
  status: string;
  failureReason?: string;
};

type FlowResult = {
  success: boolean;
  snapshot: BookingSnapshot | null;
  metrics: FlowMetrics;
};

type ResolvedOptions = {
  baseUrl: string;
  booking: {
    restaurantSlug: string | null;
    restaurantId: string | null;
    date: string;
    time: string;
    party: number;
    bookingType: BookingType;
    seating: SeatingPreference;
    notes: string | null;
    name: string;
    email: string;
    phone: string;
    marketingOptIn: boolean;
  };
  pretty: boolean;
  timeoutMs: number;
  inlineWindowMs: number;
  pollIntervalMs: number;
  count: number;
  stress: boolean;
  stressMaxRuns: number | null;
  randomizeIdentity: boolean;
};

type LoggerPhase =
  | "bootstrap"
  | "submit"
  | "inline_poll"
  | "background_job"
  | "post_job_poll"
  | "final_summary"
  | "diagnostics";

type Logger = {
  info: (phase: LoggerPhase, message: string, meta?: Record<string, unknown>) => void;
  warn: (phase: LoggerPhase, message: string, meta?: Record<string, unknown>) => void;
  error: (phase: LoggerPhase, message: string, meta?: Record<string, unknown>) => void;
  setBookingId: (bookingId: string) => void;
};

type LoggerOptions = {
  pretty: boolean;
  correlationId: string;
};

type RandomizedIdentityOptions = {
  email: string;
  phone: string;
  name: string;
  iteration: number;
  correlationId: string;
};

function parseCliArgs(argv: string[]): CliArgs {
  const args: CliArgs = {};
  for (let i = 0; i < argv.length; i += 1) {
    const raw = argv[i];
    if (!raw.startsWith("--")) continue;
    const [keyPart, inlineValue] = raw.split("=", 2);
    const key = keyPart.slice(2);
    const consumesNext = typeof inlineValue === "undefined";
    const nextValue = consumesNext ? argv[i + 1] : inlineValue;
    const advance = () => {
      if (consumesNext && typeof nextValue !== "undefined") {
        i += 1;
      }
    };

    switch (key) {
      case "help":
        args.help = true;
        break;
      case "restaurant-slug":
        args.restaurantSlug = nextValue ?? undefined;
        advance();
        break;
      case "restaurant-id":
        args.restaurantId = nextValue ?? undefined;
        advance();
        break;
      case "date":
        args.date = nextValue ?? undefined;
        advance();
        break;
      case "time":
        args.time = nextValue ?? undefined;
        advance();
        break;
      case "party":
      case "party-size":
        if (!nextValue) throw new Error("--party-size requires a value");
        args.partySize = Number(nextValue);
        advance();
        break;
      case "booking-type":
        if (!nextValue) throw new Error("--booking-type requires a value");
        args.bookingType = nextValue as BookingType;
        advance();
        break;
      case "seating":
        if (!nextValue) throw new Error("--seating requires a value");
        args.seating = nextValue as SeatingPreference;
        advance();
        break;
      case "timeout":
        if (!nextValue) throw new Error("--timeout requires seconds");
        args.timeoutMs = Number(nextValue) * 1000;
        advance();
        break;
      case "timeout-ms":
        if (!nextValue) throw new Error("--timeout-ms requires milliseconds");
        args.timeoutMs = Number(nextValue);
        advance();
        break;
      case "inline-window-ms":
        if (!nextValue) throw new Error("--inline-window-ms requires milliseconds");
        args.inlineWindowMs = Number(nextValue);
        advance();
        break;
      case "poll-interval-ms":
        if (!nextValue) throw new Error("--poll-interval-ms requires milliseconds");
        args.pollIntervalMs = Number(nextValue);
        advance();
        break;
      case "base-url":
        args.baseUrl = nextValue ?? undefined;
        advance();
        break;
      case "notes":
        args.notes = nextValue ?? null;
        advance();
        break;
      case "name":
      case "customer-name":
        args.name = nextValue ?? undefined;
        advance();
        break;
      case "email":
        args.email = nextValue ?? undefined;
        advance();
        break;
      case "phone":
        args.phone = nextValue ?? undefined;
        advance();
        break;
      case "pretty":
        args.pretty = nextValue ? nextValue !== "false" : true;
        if (consumesNext && typeof nextValue !== "undefined" && !nextValue.startsWith("--")) {
          i += 1;
        }
        break;
      case "marketing-opt-in":
        args.marketingOptIn = nextValue ? nextValue !== "false" : true;
        if (consumesNext && typeof nextValue !== "undefined" && !nextValue.startsWith("--")) {
          i += 1;
        }
        break;
      case "count":
      case "repeat":
        if (!nextValue) throw new Error(`--${key} requires a positive integer`);
        args.count = Number(nextValue);
        advance();
        break;
      case "stress":
        args.stress = true;
        break;
      case "stress-max":
        if (!nextValue) throw new Error("--stress-max requires a positive integer");
        args.stressMax = Number(nextValue);
        advance();
        break;
      case "randomize-contact":
      case "randomize-identity":
        args.randomizeIdentity = nextValue ? nextValue !== "false" : true;
        if (consumesNext && typeof nextValue !== "undefined" && !nextValue.startsWith("--")) {
          i += 1;
        }
        break;
      default:
        throw new Error(`Unknown flag: --${key}`);
    }
  }
  return args;
}

function printHelp(): void {
  const lines = [
    "Usage: pnpm booking:flow [options]",
    "",
    "Options:",
    "  --restaurant-slug <slug>       Restaurant slug (default: demo-restaurant)",
    "  --restaurant-id <uuid>        Restaurant ID (overrides slug)",
    "  --date <YYYY-MM-DD>           Booking date (default: tomorrow)",
    "  --time <HH:mm>                Booking time (default: 19:00)",
    "  --party-size <number>         Party size (default: 2)",
    "  --booking-type <type>         breakfast|lunch|dinner|drinks (default: dinner)",
    "  --seating <option>            any|indoor|outdoor|window|booth|bar|quiet (default: any)",
    "  --notes <text>                Optional notes",
    "  --name <text>                 Customer name (default test name)",
    "  --email <text>                Customer email (default test email)",
    "  --phone <text>                Customer phone (default test phone)",
    "  --marketing-opt-in            Enable marketing opt-in (default: false)",
    "  --base-url <url>              Booking API base URL (default: http://localhost:3000)",
    "  --timeout <seconds>           Overall timeout in seconds (default: 90)",
    "  --inline-window-ms <ms>       How long to wait for inline assignment before job (default: 25000)",
    "  --poll-interval-ms <ms>       Poll interval (default: 2000)",
    "  --pretty                      Pretty-print logs",
    "  --count <n>                   Number of sequential bookings to run (default: 1)",
    "  --stress                      Run indefinitely until a booking fails (ignores --count)",
    "  --stress-max <n>              Cap total runs when --stress is enabled",
    "  --randomize-contact           Randomize guest identity each run (default: on when stress)",
    "  --help                        Show this help",
  ];
  // eslint-disable-next-line no-console
  console.log(lines.join("\n"));
}

function computeDefaultSlot() {
  const slot = DateTime.now().plus({ days: 1 }).set({ hour: 19, minute: 0, second: 0, millisecond: 0 });
  return {
    date: slot.toISODate() ?? DateTime.now().toISODate()!,
    time: slot.toFormat("HH:mm"),
  };
}

function sanitizeBaseUrl(url: string): string {
  const trimmed = url.trim();
  const normalized = trimmed.endsWith("/") ? trimmed.slice(0, -1) : trimmed;
  if (!normalized.startsWith("http")) {
    throw new Error(`Invalid base URL: ${url}`);
  }
  return normalized;
}

function maskEmail(email: string): string {
  const [local, domain] = email.split("@");
  if (!domain) return email;
  const maskedLocal = local.length <= 3 ? `${local[0] ?? ""}***` : `${local.slice(0, 2)}***${local.slice(-1)}`;
  return `${maskedLocal}@${domain}`;
}

function maskPhone(phone: string): string {
  const digits = phone.replace(/\D+/g, "");
  if (digits.length <= 4) return phone;
  return `${"*".repeat(Math.max(0, digits.length - 4))}${digits.slice(-4)}`;
}

function buildRandomizedIdentity(
  options: RandomizedIdentityOptions,
): Pick<ResolvedOptions["booking"], "email" | "phone" | "name"> {
  const { email, phone, name, iteration, correlationId } = options;
  const timestamp = DateTime.now().toUTC().toFormat("yyyyLLddHHmmss");
  const token = `${timestamp}-${iteration}-${correlationId.slice(0, 8)}`;
  const slug = token.toLowerCase().replace(/[^a-z0-9]/g, "");
  const [local, domain] = email.includes("@") ? email.split("@") : [email, ""];
  const taggedLocal = domain.length > 0 ? `${local}+${slug}` : `${local}+${slug}`;
  const randomizedEmail = domain.length > 0 ? `${taggedLocal}@${domain}` : taggedLocal;

  const slugDigits = slug
    .split("")
    .map((char) => {
      if (char >= "0" && char <= "9") return char;
      return ((char.charCodeAt(0) - 97 + 10) % 10).toString();
    })
    .join("");
  const suffixDigits = slugDigits.slice(-6).padStart(6, "0");
  const digitsOnly = phone.replace(/\D+/g, "");
  const baseDigits =
    digitsOnly.length > 6 ? `${digitsOnly.slice(0, -6)}${suffixDigits}` : `${digitsOnly}${suffixDigits}`;
  const hasPlusPrefix = phone.trim().startsWith("+");
  const randomizedPhone = baseDigits ? `${hasPlusPrefix ? "+" : ""}${baseDigits}` : phone;

  const randomizedName = `${name} #${iteration} (${slug.slice(0, 4).toUpperCase()})`;

  return {
    email: randomizedEmail,
    phone: randomizedPhone,
    name: randomizedName,
  };
}

function createLogger(options: LoggerOptions): Logger {
  let bookingId: string | null = null;
  const emit = (level: "INFO" | "WARN" | "ERROR", phase: LoggerPhase, message: string, meta?: Record<string, unknown>) => {
    const timestamp = new Date().toISOString();
    const contextualMeta = {
      correlationId: options.correlationId,
      bookingId,
      ...(meta ?? {}),
    };
    const hasMeta = Object.keys(contextualMeta).some((key) => contextualMeta[key as keyof typeof contextualMeta] != null);

    if (options.pretty) {
      const serializedMeta = hasMeta ? ` ${JSON.stringify(contextualMeta)}` : "";
      const line = `[${timestamp}] [${level}] [${phase}] ${message}${serializedMeta}`;
      if (level === "ERROR") {
        console.error(line);
      } else if (level === "WARN") {
        console.warn(line);
      } else {
        console.log(line);
      }
      return;
    }

    const payload = {
      timestamp,
      level,
      phase,
      message,
      ...contextualMeta,
    };
    const serialized = JSON.stringify(payload);
    if (level === "ERROR") {
      console.error(serialized);
    } else if (level === "WARN") {
      console.warn(serialized);
    } else {
      console.log(serialized);
    }
  };

  return {
    info: (phase, message, meta) => emit("INFO", phase, message, meta),
    warn: (phase, message, meta) => emit("WARN", phase, message, meta),
    error: (phase, message, meta) => emit("ERROR", phase, message, meta),
    setBookingId: (id: string) => {
      bookingId = id;
    },
  };
}

function resolveOptions(args: CliArgs): ResolvedOptions {
  const slot = computeDefaultSlot();
  const date = args.date ?? slot.date;
  const time = args.time ?? slot.time;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new Error(`Invalid date format: ${date}`);
  }
  if (!/^\d{2}:\d{2}$/.test(time)) {
    throw new Error(`Invalid time format: ${time}`);
  }

  const party = args.partySize && Number.isFinite(args.partySize) ? Math.max(1, Math.floor(args.partySize)) : 2;
  const bookingType = args.bookingType && isBookingType(args.bookingType) ? args.bookingType : "dinner";
  const seating = args.seating && isSeatingPreference(args.seating) ? args.seating : "any";
  const count = args.count && Number.isFinite(args.count) ? Math.max(1, Math.floor(args.count)) : 1;
  const stressMaxRuns =
    args.stressMax && Number.isFinite(args.stressMax) ? Math.max(1, Math.floor(args.stressMax)) : null;
  const stress = Boolean(args.stress) || Boolean(stressMaxRuns);
  const randomizeIdentity = Boolean(args.randomizeIdentity) || stress;

  const baseUrl = sanitizeBaseUrl(args.baseUrl ?? process.env.BOOKING_API_BASE_URL ?? DEFAULT_BASE_URL);
  const timeoutMs = Math.max(10_000, args.timeoutMs ?? DEFAULT_MAX_TIMEOUT_MS);
  const inlineWindowMs = Math.min(timeoutMs - 5_000, Math.max(5_000, args.inlineWindowMs ?? DEFAULT_INLINE_WINDOW_MS));
  const pollIntervalMs = Math.max(500, args.pollIntervalMs ?? DEFAULT_POLL_INTERVAL_MS);

  return {
    baseUrl,
    booking: {
      restaurantSlug: args.restaurantId ? null : args.restaurantSlug ?? "demo-restaurant",
      restaurantId: args.restaurantId ?? null,
      date,
      time,
      party,
      bookingType,
      seating,
      notes: args.notes ?? "Generated via scripts/run-booking-flow.ts",
      name: args.name ?? DEFAULT_CUSTOMER_NAME,
      email: args.email ?? DEFAULT_CUSTOMER_EMAIL,
      phone: args.phone ?? DEFAULT_CUSTOMER_PHONE,
      marketingOptIn: args.marketingOptIn ?? false,
    },
    pretty: args.pretty ?? false,
    timeoutMs,
    inlineWindowMs,
    pollIntervalMs,
    count,
    stress,
    stressMaxRuns,
    randomizeIdentity,
  };
}

async function submitBookingRequest(options: {
  baseUrl: string;
  payload: ResolvedOptions["booking"];
  logger: Logger;
  correlationId: string;
}): Promise<{ booking: BookingRow; duplicate: boolean; durationMs: number }> {
  const { baseUrl, payload, logger, correlationId } = options;
  const url = `${baseUrl}/api/bookings`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30_000);
  const start = Date.now();

  const body = {
    restaurantSlug: payload.restaurantSlug ?? undefined,
    restaurantId: payload.restaurantId ?? undefined,
    date: payload.date,
    time: payload.time,
    party: payload.party,
    bookingType: payload.bookingType,
    seating: payload.seating,
    notes: payload.notes,
    name: payload.name,
    email: payload.email,
    phone: payload.phone,
    marketingOptIn: payload.marketingOptIn,
  };

  logger.info("submit", "Submitting booking request", {
    url,
    restaurantSlug: payload.restaurantSlug,
    restaurantId: payload.restaurantId,
    date: payload.date,
    time: payload.time,
    party: payload.party,
    bookingType: payload.bookingType,
    seating: payload.seating,
    marketingOptIn: payload.marketingOptIn,
  });

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "User-Agent": "booking-flow-script",
        "Idempotency-Key": randomUUID(),
        "X-Booking-Flow-Correlation": correlationId,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    const durationMs = Date.now() - start;
    const text = await response.text();
    const json = text.length > 0 ? JSON.parse(text) : {};

    if (!response.ok) {
      throw new Error(`Booking request failed (${response.status}): ${json?.error ?? text}`);
    }

    const booking = json?.booking as BookingRow | undefined;
    if (!booking?.id) {
      throw new Error("Booking response missing booking payload");
    }

    logger.info("submit", "Booking created", {
      bookingId: booking.id,
      duplicate: Boolean(json?.duplicate),
      initialStatus: booking.status,
      durationMs,
      maskedEmail: maskEmail(payload.email),
      maskedPhone: maskPhone(payload.phone),
    });

    return {
      booking: json.booking as BookingRow,
      duplicate: Boolean(json?.duplicate),
      durationMs,
    };
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error("Booking request timed out");
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchBookingSnapshot(
  supabase: SupabaseClient<Database>,
  bookingId: string,
): Promise<BookingSnapshot | null> {
  const [bookingResult, assignmentsResult] = await Promise.all([
    supabase
      .from("bookings")
      .select(
        "id,status,booking_date,start_time,end_time,party_size,booking_type,seating_preference,restaurant_id,reference,auto_assign_last_result,assignment_state,assignment_state_version",
      )
      .eq("id", bookingId)
      .maybeSingle<BookingRow>(),
    supabase
      .from("booking_table_assignments")
      .select("id,booking_id,table_id,created_at,updated_at,table_inventory(table_number,zone_id,capacity)")
      .eq("booking_id", bookingId)
      .order("created_at", { ascending: true }),
  ]);

  if (bookingResult.error) {
    throw bookingResult.error;
  }
  if (!bookingResult.data) {
    return null;
  }

  if (assignmentsResult.error) {
    throw assignmentsResult.error;
  }

  return {
    booking: bookingResult.data,
    assignments: (assignmentsResult.data as AssignmentRow[] | null) ?? [],
    autoAssignLastResult: parseAutoAssignLastResult(bookingResult.data.auto_assign_last_result ?? null),
  };
}

async function pollBookingUntilConfirmed(options: {
  supabase: SupabaseClient<Database>;
  bookingId: string;
  timeoutMs: number;
  pollIntervalMs: number;
  phase: LoggerPhase;
  logger: Logger;
}): Promise<PollOutcome> {
  const { supabase, bookingId, timeoutMs, pollIntervalMs, phase, logger } = options;
  const start = Date.now();
  let attempts = 0;
  let lastStatus: string | null = null;
  let lastSnapshot: BookingSnapshot | null = null;

  while (Date.now() - start < timeoutMs) {
    attempts += 1;
    const snapshot = await fetchBookingSnapshot(supabase, bookingId);
    lastSnapshot = snapshot;
    if (!snapshot) {
      logger.warn(phase, "Booking not found yet", { attempt: attempts });
    } else {
      const status = snapshot.booking.status;
      if (status !== lastStatus) {
        logger.info(phase, "Status update", {
          attempt: attempts,
          status,
          assignments: snapshot.assignments.length,
          elapsedMs: Date.now() - start,
        });
        lastStatus = status;
      }

      if (status === "confirmed" && snapshot.assignments.length > 0) {
        return {
          state: "confirmed",
          snapshot,
          attempts,
          durationMs: Date.now() - start,
        };
      }

      if (!BLOCKING_STATUS_SET.has(status)) {
        return {
          state: "terminal",
          snapshot,
          attempts,
          durationMs: Date.now() - start,
        };
      }
    }
    await delay(pollIntervalMs);
  }

  return {
    state: "timeout",
    snapshot: lastSnapshot,
    attempts,
    durationMs: Date.now() - start,
  };
}

function formatAssignments(assignments: AssignmentRow[]) {
  return assignments.map((assignment) => ({
    id: assignment.id,
    tableId: assignment.table_id,
    tableNumber: assignment.table_inventory?.table_number ?? null,
    zoneId: assignment.table_inventory?.zone_id ?? null,
    capacity: assignment.table_inventory?.capacity ?? null,
    startAt: assignment.start_at ?? null,
    endAt: assignment.end_at ?? null,
  }));
}

function computeAssignmentStats(snapshot: BookingSnapshot | null, fallbackPartySize: number) {
  const assignments = snapshot ? formatAssignments(snapshot.assignments) : [];
  const totalCapacity = assignments.reduce((sum, entry) => sum + (entry.capacity ?? 0), 0);
  const partySize = snapshot?.booking.party_size ?? fallbackPartySize;
  const seatWaste = Math.max(0, totalCapacity - partySize);
  const tableNumbers = assignments
    .map((assignment) => assignment.tableNumber ?? assignment.tableId ?? null)
    .filter((value): value is string => Boolean(value));

  return {
    assignments,
    totalCapacity,
    partySize,
    seatWaste,
    tableNumbers,
  };
}

function applyAssignmentStats(
  metrics: FlowMetrics,
  snapshot: BookingSnapshot | null,
  fallbackPartySize: number,
) {
  const stats = computeAssignmentStats(snapshot, fallbackPartySize);
  metrics.tablesAssigned = stats.assignments.length;
  metrics.totalCapacity = stats.totalCapacity;
  metrics.seatWaste = stats.seatWaste;
  metrics.partySize = stats.partySize;
  metrics.tableNumbers = stats.tableNumbers;
  return stats;
}

function logSuccessSummary(params: {
  logger: Logger;
  snapshot: BookingSnapshot;
  metrics: FlowMetrics;
  fallbackPartySize: number;
  note: string;
}) {
  const { logger, snapshot, metrics, fallbackPartySize, note } = params;
  const assignmentStats = computeAssignmentStats(snapshot, fallbackPartySize);
  logger.info("final_summary", note, {
    bookingId: snapshot.booking.id,
    reference: snapshot.booking.reference,
    bookingDate: snapshot.booking.booking_date,
    startTime: snapshot.booking.start_time,
    endTime: snapshot.booking.end_time,
    autoAssignLastResult: snapshot.autoAssignLastResult ?? null,
    ...metrics,
    partySize: assignmentStats.partySize,
    totalCapacity: assignmentStats.totalCapacity,
    seatWaste: assignmentStats.seatWaste,
    tableNumbers: assignmentStats.tableNumbers,
    assignments: assignmentStats.assignments,
  });
}

async function loadAssignmentDiagnostics(
  supabase: SupabaseClient<Database>,
  bookingId: string,
  limit = 5,
): Promise<AssignmentStateHistoryRow[]> {
  const { data, error } = await supabase
    .from("booking_assignment_state_history")
    .select("id,booking_id,actor_id,from_state,to_state,reason,metadata,created_at")
    .eq("booking_id", bookingId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    throw error;
  }

  return data ?? [];
}

async function emitFailureDiagnostics(params: {
  snapshot: BookingSnapshot;
  supabase: SupabaseClient<Database>;
  logger: Logger;
}) {
  const { snapshot, supabase, logger } = params;
  const diagHistory = await loadAssignmentDiagnostics(supabase, snapshot.booking.id);
  const stats = computeAssignmentStats(snapshot, snapshot.booking.party_size ?? 0);
  logger.error("diagnostics", "Assignment diagnostics", {
    bookingStatus: snapshot.booking.status,
    assignments: stats.assignments,
    partySize: stats.partySize,
    totalCapacity: stats.totalCapacity,
    seatWaste: stats.seatWaste,
    lastAutoAssignResult: snapshot.autoAssignLastResult ?? null,
    assignmentStateHistory: diagHistory.map((entry) => ({
      from: entry.from_state,
      to: entry.to_state,
      reason: entry.reason,
      created_at: entry.created_at,
      metadata: entry.metadata,
    })),
  });
}

async function runSingleBookingFlow(options: {
  resolved: ResolvedOptions;
  supabase: SupabaseClient<Database>;
  iteration: number;
}): Promise<FlowResult> {
  const { resolved, supabase, iteration } = options;
  const correlationId = randomUUID();
  const logger = createLogger({ pretty: resolved.pretty, correlationId });
  const bookingPayload = resolved.randomizeIdentity
    ? {
        ...resolved.booking,
        ...buildRandomizedIdentity({
          email: resolved.booking.email,
          phone: resolved.booking.phone,
          name: resolved.booking.name,
          iteration,
          correlationId,
        }),
      }
    : resolved.booking;
  const flowStart = Date.now();
  const metrics: FlowMetrics = {
    iteration,
    correlationId,
    submitDurationMs: 0,
    inlineAttempts: 0,
    inlineDurationMs: 0,
    postJobAttempts: 0,
    postJobDurationMs: 0,
    backgroundInvoked: false,
    backgroundDurationMs: null,
    totalDurationMs: 0,
    tablesAssigned: 0,
    totalCapacity: 0,
    seatWaste: 0,
    tableNumbers: [],
    partySize: bookingPayload.party,
    duplicateRequest: false,
    status: "failed_unknown",
  };

  logger.info("bootstrap", "Starting booking flow", {
    iteration,
    totalRuns: resolved.stress ? "stress" : resolved.count,
    timeoutMs: resolved.timeoutMs,
    inlineWindowMs: resolved.inlineWindowMs,
    pollIntervalMs: resolved.pollIntervalMs,
  });

  const submitResult = await submitBookingRequest({
    baseUrl: resolved.baseUrl,
    payload: bookingPayload,
    logger,
    correlationId,
  });
  metrics.submitDurationMs = submitResult.durationMs;
  metrics.duplicateRequest = submitResult.duplicate;

  logger.setBookingId(submitResult.booking.id);

  if (submitResult.booking.status === "confirmed") {
    const fetchedSnapshot = await fetchBookingSnapshot(supabase, submitResult.booking.id);
    const snapshot: BookingSnapshot =
      fetchedSnapshot ?? {
        booking: submitResult.booking,
        assignments: [],
        autoAssignLastResult: parseAutoAssignLastResult(submitResult.booking.auto_assign_last_result ?? null),
      };
    metrics.totalDurationMs = Date.now() - flowStart;
    metrics.status = "confirmed_inline_api";
    applyAssignmentStats(metrics, snapshot, bookingPayload.party);
    logSuccessSummary({
      logger,
      snapshot,
      metrics,
      fallbackPartySize: bookingPayload.party,
      note: "Booking confirmed inline (API response)",
    });
    return { success: true, snapshot, metrics };
  }

  const inlineOutcome = await pollBookingUntilConfirmed({
    supabase,
    bookingId: submitResult.booking.id,
    timeoutMs: Math.min(resolved.inlineWindowMs, resolved.timeoutMs),
    pollIntervalMs: resolved.pollIntervalMs,
    phase: "inline_poll",
    logger,
  });
  metrics.inlineAttempts = inlineOutcome.attempts;
  metrics.inlineDurationMs = inlineOutcome.durationMs;

  if (inlineOutcome.state === "confirmed") {
    metrics.totalDurationMs = Date.now() - flowStart;
    metrics.status = "confirmed_inline_poll";
    applyAssignmentStats(metrics, inlineOutcome.snapshot, bookingPayload.party);
    logSuccessSummary({
      logger,
      snapshot: inlineOutcome.snapshot,
      metrics,
      fallbackPartySize: bookingPayload.party,
      note: "Booking confirmed via inline flow",
    });
    return { success: true, snapshot: inlineOutcome.snapshot, metrics };
  }

  if (inlineOutcome.state === "terminal" && inlineOutcome.snapshot) {
    logger.error("inline_poll", "Booking reached terminal status before confirmation", {
      status: inlineOutcome.snapshot.booking.status,
    });
    metrics.totalDurationMs = Date.now() - flowStart;
    metrics.status = "failed_inline_terminal";
    metrics.failureReason = inlineOutcome.snapshot.booking.status ?? "terminal";
    applyAssignmentStats(metrics, inlineOutcome.snapshot, bookingPayload.party);
    await emitFailureDiagnostics({ snapshot: inlineOutcome.snapshot, supabase, logger });
    return { success: false, snapshot: inlineOutcome.snapshot, metrics };
  }

  logger.warn("inline_poll", "Inline window expired without confirmation", {
    state: inlineOutcome.state,
    attempts: inlineOutcome.attempts,
  });

  const remainingTime = resolved.timeoutMs - (Date.now() - flowStart);
  if (remainingTime <= 0) {
    metrics.totalDurationMs = Date.now() - flowStart;
    metrics.status = "failed_inline_timeout";
    metrics.failureReason = "inline_timeout";
    return { success: false, snapshot: inlineOutcome.snapshot ?? null, metrics };
  }

  logger.info("background_job", "Triggering autoAssignAndConfirmIfPossible", {});
  const jobStart = Date.now();
  metrics.backgroundInvoked = true;
  await autoAssignAndConfirmIfPossible(submitResult.booking.id, {
    bypassFeatureFlag: true,
    reason: "creation",
    emailVariant: "standard",
  });
  logger.info("background_job", "Background auto-assign invoked", {
    durationMs: Date.now() - jobStart,
  });
  metrics.backgroundDurationMs = Date.now() - jobStart;

  const finalOutcome = await pollBookingUntilConfirmed({
    supabase,
    bookingId: submitResult.booking.id,
    timeoutMs: Math.max(5_000, remainingTime),
    pollIntervalMs: resolved.pollIntervalMs,
    phase: "post_job_poll",
    logger,
  });
  metrics.postJobAttempts = finalOutcome.attempts;
  metrics.postJobDurationMs = finalOutcome.durationMs;

  if (finalOutcome.state === "confirmed") {
    metrics.totalDurationMs = Date.now() - flowStart;
    metrics.status = "confirmed_background";
    applyAssignmentStats(metrics, finalOutcome.snapshot, bookingPayload.party);
    logSuccessSummary({
      logger,
      snapshot: finalOutcome.snapshot,
      metrics,
      fallbackPartySize: bookingPayload.party,
      note: "Booking confirmed after background job",
    });
    return { success: true, snapshot: finalOutcome.snapshot, metrics };
  }

  metrics.totalDurationMs = Date.now() - flowStart;
  metrics.status = finalOutcome.state === "terminal" ? "failed_background_terminal" : "failed_background_timeout";
  metrics.failureReason = finalOutcome.state;

  if (finalOutcome.snapshot) {
    applyAssignmentStats(metrics, finalOutcome.snapshot, bookingPayload.party);
    await emitFailureDiagnostics({ snapshot: finalOutcome.snapshot, supabase, logger });
  }

  logger.error("final_summary", "Booking failed to confirm", {
    state: finalOutcome.state,
    durationMs: metrics.totalDurationMs,
  });

  return { success: false, snapshot: finalOutcome.snapshot ?? inlineOutcome.snapshot ?? null, metrics };
}

async function runSequentially(resolved: ResolvedOptions, supabase: SupabaseClient<Database>): Promise<void> {
  if (resolved.stress) {
    await runUntilExhaustion(resolved, supabase);
    return;
  }
  let completed = 0;
  for (let i = 0; i < resolved.count; i += 1) {
    const iteration = i + 1;
    const result = await runSingleBookingFlow({ resolved, supabase, iteration });
    if (!result.success) {
      throw new Error("Booking flow failed; see diagnostics above");
    }
    completed += 1;
  }

  if (completed === resolved.count) {
    // eslint-disable-next-line no-console
    console.log(`✅ Successfully confirmed ${completed} booking${completed > 1 ? "s" : ""}.`);
  }
}

function summarizeNumbers(values: number[]) {
  if (values.length === 0) {
    return { count: 0, min: 0, max: 0, avg: 0, p95: 0 };
  }
  const sorted = [...values].sort((a, b) => a - b);
  const sum = values.reduce((acc, value) => acc + value, 0);
  const avg = sum / values.length;
  const count = values.length;
  const min = sorted[0];
  const max = sorted[sorted.length - 1];
  const p95 = sorted[Math.min(sorted.length - 1, Math.floor(0.95 * (sorted.length - 1)))];
  return { count, min, max, avg, p95 };
}

function logStressSummary(runs: FlowResult[], context: { completedTarget: boolean; maxRuns: number | null }) {
  if (runs.length === 0) return;
  const successes = runs.filter((run) => run.success);
  const failure = runs.find((run) => !run.success);
  const durationStats = summarizeNumbers(successes.map((run) => run.metrics.totalDurationMs));
  const seatWasteStats = summarizeNumbers(successes.map((run) => run.metrics.seatWaste));
  const tablesStats = summarizeNumbers(successes.map((run) => run.metrics.tablesAssigned));
  const uniqueTables = new Set<string>();
  successes.forEach((run) => {
    for (const table of run.metrics.tableNumbers) {
      uniqueTables.add(table);
    }
  });

  // eslint-disable-next-line no-console
  console.log("[stress] Summary", {
    totalRuns: runs.length,
    successes: successes.length,
    failures: failure ? 1 : 0,
    maxRuns: context.maxRuns ?? null,
    completedTarget: context.completedTarget,
    durationMs: durationStats,
    seatWaste: seatWasteStats,
    tablesPerBooking: tablesStats,
    uniqueTables: Array.from(uniqueTables).sort(),
  });

  if (failure) {
    // eslint-disable-next-line no-console
    console.error("[stress] Failure details", {
      iteration: failure.metrics.iteration,
      correlationId: failure.metrics.correlationId,
      status: failure.metrics.status,
      failureReason: failure.metrics.failureReason ?? "unknown",
      bookingId: failure.snapshot?.booking.id ?? null,
    });
  }
}

async function runUntilExhaustion(resolved: ResolvedOptions, supabase: SupabaseClient<Database>): Promise<void> {
  const runs: FlowResult[] = [];
  const maxRuns = resolved.stressMaxRuns ?? Number.MAX_SAFE_INTEGER;

  for (let i = 0; i < maxRuns; i += 1) {
    const iteration = i + 1;
    const result = await runSingleBookingFlow({ resolved, supabase, iteration });
    runs.push(result);
    if (!result.success) {
      logStressSummary(runs, { completedTarget: false, maxRuns });
      throw new Error(`Stress run halted after ${Math.max(0, iteration - 1)} successes; see summary above.`);
    }
  }

  logStressSummary(runs, { completedTarget: true, maxRuns });
  // eslint-disable-next-line no-console
  console.log(`✅ Stress run completed ${runs.length} booking(s) without failure.`);
}

async function main() {
  try {
    const cli = parseCliArgs(process.argv.slice(2));
    if (cli.help) {
      printHelp();
      return;
    }
    const resolved = resolveOptions(cli);
    const supabase = getServiceSupabaseClient();
    await runSequentially(resolved, supabase);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    // eslint-disable-next-line no-console
    console.error(`❌ ${message}`);
    process.exitCode = 1;
  }
}

void main();
