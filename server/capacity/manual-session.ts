import { type ManualSelectionSummary, type ManualAssignmentContext } from "@/server/capacity/table-assignment";
import { getManualAssignmentContext, createManualHold, evaluateManualSelection, confirmHoldAssignment } from "@/server/capacity/table-assignment";
import { ensureClient } from "@/server/capacity/table-assignment/supabase";
import { isManualAssignmentSessionEnabled } from "@/server/feature-flags";

import type { Database, Json } from "@/types/supabase";
import type { SupabaseClient } from "@supabase/supabase-js";

const MAS_TABLE = "manual_assignment_sessions" as const;

type ManualAssignmentSessionRow = {
  id: string;
  booking_id: string;
  restaurant_id: string;
  state: ManualSessionState;
  selection: ManualSessionSelection | null;
  selection_version: number;
  context_version: string | null;
  policy_version: string | null;
  snapshot_hash: string | null;
  hold_id: string | null;
  expires_at: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  table_version: string | null;
  adjacency_version: string | null;
  flags_version: string | null;
  window_version: string | null;
  holds_version: string | null;
  assignments_version: string | null;
};

type ManualAssignmentSessionTable = {
  Row: ManualAssignmentSessionRow;
  Insert: {
    booking_id: string;
    restaurant_id: string;
    created_by: string | null;
    selection?: ManualSessionSelection | null;
    selection_version?: number;
    state?: ManualSessionState;
    context_version?: string | null;
    policy_version?: string | null;
    snapshot_hash?: string | null;
    hold_id?: string | null;
    expires_at?: string | null;
    table_version?: string | null;
    adjacency_version?: string | null;
    flags_version?: string | null;
    window_version?: string | null;
    holds_version?: string | null;
    assignments_version?: string | null;
    created_at?: string;
    updated_at?: string;
  };
  Update: Partial<
    Omit<
      ManualAssignmentSessionRow,
      "id" | "booking_id" | "restaurant_id" | "created_at" | "created_by"
    >
  >;
  Relationships: [];
};

type ExtendedTableHoldsTable = Database["public"]["Tables"]["table_holds"] & {
  Row: Database["public"]["Tables"]["table_holds"]["Row"] & {
    status?: string;
    last_touched_at?: string;
    session_id?: string | null;
  };
  Insert: Database["public"]["Tables"]["table_holds"]["Insert"] & {
    status?: string;
    last_touched_at?: string;
    session_id?: string | null;
  };
  Update: Database["public"]["Tables"]["table_holds"]["Update"] & {
    status?: string;
    last_touched_at?: string;
    session_id?: string | null;
  };
};

type ManualDatabase = Database & {
  public: Database["public"] & {
    Tables: Database["public"]["Tables"] & {
      [MAS_TABLE]: ManualAssignmentSessionTable;
      table_holds: ExtendedTableHoldsTable;
    };
  };
};

type DbClient = SupabaseClient<ManualDatabase, "public">;
type ManualSessionUpdatePatch = ManualAssignmentSessionTable["Update"];
type ManualSessionVersionPatch = Pick<
  ManualAssignmentSessionRow,
  | "context_version"
  | "policy_version"
  | "table_version"
  | "adjacency_version"
  | "flags_version"
  | "window_version"
  | "holds_version"
  | "assignments_version"
>;
type TableHoldsRow = ManualDatabase["public"]["Tables"]["table_holds"]["Row"];
type TableHoldsUpdate = ManualDatabase["public"]["Tables"]["table_holds"]["Update"];

export type ManualSessionState = "none" | "proposed" | "held" | "confirmed" | "expired" | "conflicted" | "cancelled";

export type ManualSessionSelection = {
  tableIds: string[];
  requireAdjacency?: boolean | null;
  summary?: ManualSelectionSummary | null;
};

export type ManualAssignmentSession = {
  id: string;
  bookingId: string;
  restaurantId: string;
  state: ManualSessionState;
  selection: ManualSessionSelection | null;
  selectionVersion: number;
  contextVersion: string | null;
  policyVersion: string | null;
  snapshotHash: string | null;
  holdId: string | null;
  expiresAt: string | null;
  createdBy: string | null;
  updatedAt: string | null;
  tableVersion?: string | null;
  adjacencyVersion?: string | null;
  flagsVersion?: string | null;
  windowVersion?: string | null;
  holdsVersion?: string | null;
  assignmentsVersion?: string | null;
};

export class ManualSessionDisabledError extends Error {
  constructor() {
    super("Manual assignment sessions are disabled");
    this.name = "ManualSessionDisabledError";
  }
}
function isTableMissingError(error: unknown): boolean {
  const code = (error as { code?: string | null })?.code ?? null;
  const message = (error as { message?: string | null })?.message ?? "";
  return code === "42P01" || message.includes("schema cache") || message.includes("does not exist");
}

export class StaleContextError extends Error {
  public readonly expected: string | null;
  public readonly provided: string | null;
  constructor(expected: string | null, provided: string | null) {
    super("Stale context; please refresh");
    this.name = "StaleContextError";
    this.expected = expected;
    this.provided = provided;
  }
}

export class SessionNotFoundError extends Error {
  constructor(message = "Session not found") {
    super(message);
    this.name = "SessionNotFoundError";
  }
}

export class SessionConflictError extends Error {
  public readonly code: string;
  public readonly details: Json | null;
  constructor(message: string, code: string, details: Json | null = null) {
    super(message);
    this.name = "SessionConflictError";
    this.code = code;
    this.details = details;
  }
}

async function assertEnabled() {
  if (!isManualAssignmentSessionEnabled()) {
    throw new ManualSessionDisabledError();
  }
}

function getClient(client?: DbClient) {
  return ensureClient(client as unknown as SupabaseClient<Database, "public">) as DbClient;
}

function normalizeSessionRow(row: ManualAssignmentSessionRow): ManualAssignmentSession {
  return {
    id: row.id,
    bookingId: row.booking_id,
    restaurantId: row.restaurant_id,
    state: row.state,
    selection: row.selection ?? null,
    selectionVersion: row.selection_version ?? 0,
    contextVersion: row.context_version ?? null,
    policyVersion: row.policy_version ?? null,
    snapshotHash: row.snapshot_hash ?? null,
    holdId: row.hold_id ?? null,
    expiresAt: row.expires_at ?? null,
    createdBy: row.created_by ?? null,
    updatedAt: row.updated_at ?? null,
    tableVersion: row.table_version ?? null,
    adjacencyVersion: row.adjacency_version ?? null,
    flagsVersion: row.flags_version ?? null,
    windowVersion: row.window_version ?? null,
    holdsVersion: row.holds_version ?? null,
    assignmentsVersion: row.assignments_version ?? null,
  };
}

export async function getOrCreateManualSession(params: {
  bookingId: string;
  restaurantId: string;
  createdBy: string | null;
  client?: DbClient;
}) {
  await assertEnabled();
  const supabase = getClient(params.client);
  const existing = await supabase
    .from(MAS_TABLE)
    .select("*")
    .eq("booking_id", params.bookingId)
    .maybeSingle();

  if (existing.data) {
    return normalizeSessionRow(existing.data);
  }

  const { data: inserted, error } = await supabase
    .from(MAS_TABLE)
    .insert({
      booking_id: params.bookingId,
      restaurant_id: params.restaurantId,
      created_by: params.createdBy,
    })
    .select("*")
    .single();

  if (error || !inserted) {
    if (isTableMissingError(error)) {
      throw new ManualSessionDisabledError();
    }
    throw new Error(error?.message ?? "Failed to create manual assignment session");
  }

  return normalizeSessionRow(inserted);
}

export async function loadManualSession(params: { sessionId: string; client?: DbClient }) {
  await assertEnabled();
  const supabase = getClient(params.client);
  const { data, error } = await supabase.from(MAS_TABLE).select("*").eq("id", params.sessionId).maybeSingle();
  if (error) {
    if (isTableMissingError(error)) {
      throw new ManualSessionDisabledError();
    }
    throw new Error(error.message ?? "Failed to load session");
  }
  if (!data) {
    throw new SessionNotFoundError();
  }
  return normalizeSessionRow(data);
}

async function updateSession(params: {
  sessionId: string;
  patch: ManualSessionUpdatePatch;
  client?: DbClient;
}) {
  const supabase = getClient(params.client);
  const patch: ManualSessionUpdatePatch = {
    ...params.patch,
    updated_at: new Date().toISOString(),
  };
  const { data, error } = await supabase
    .from(MAS_TABLE)
    .update(patch)
    .eq("id", params.sessionId)
    .select("*")
    .maybeSingle();

  if (error || !data) {
    throw new Error(error?.message ?? "Failed to update session");
  }
  return normalizeSessionRow(data);
}

async function refreshSessionFromHold(session: ManualAssignmentSession, client: DbClient) {
  if (session.state !== "held" || !session.holdId) {
    return session;
  }

  const { data: holdRow, error } = await client
    .from("table_holds")
    .select("status, expires_at")
    .eq("id", session.holdId)
    .maybeSingle();

  if (error) {
    if (isTableMissingError(error)) {
      throw new ManualSessionDisabledError();
    }
    return session;
  }

  if (!holdRow) {
    return updateSession({
      sessionId: session.id,
      patch: {
        state: "cancelled",
        hold_id: null,
        selection_version: session.selectionVersion + 1,
        expires_at: null,
      },
      client,
    });
  }

  const status = (holdRow as Pick<TableHoldsRow, "status"> | null)?.status ?? "active";
  const expiresAt = (holdRow as Pick<TableHoldsRow, "expires_at"> | null)?.expires_at ?? session.expiresAt;
  const expired = expiresAt ? new Date(expiresAt).getTime() <= Date.now() : false;

  if (status === "active" && !expired) {
    return session;
  }

  const terminalState =
    status === "confirmed"
      ? "confirmed"
      : status === "cancelled"
        ? "cancelled"
        : "expired";

  const patch: ManualSessionUpdatePatch = {
    state: terminalState,
    hold_id: null,
    expires_at: expiresAt ?? null,
  };

  if (terminalState !== (session.state as string)) {
    patch.selection_version = session.selectionVersion + 1;
  }

  return updateSession({
    sessionId: session.id,
    patch,
    client,
  });
}

function buildVersionPatch(context: Pick<ManualAssignmentContext, "contextVersion" | "policyVersion" | "versions">): ManualSessionVersionPatch {
  const versions = context.versions ?? {};
  return {
    context_version: context.contextVersion ?? null,
    policy_version: context.policyVersion ?? null,
    table_version: versions.tables ?? null,
    adjacency_version: versions.adjacency ?? null,
    flags_version: versions.flags ?? null,
    window_version: versions.window ?? null,
    holds_version: versions.holds ?? null,
    assignments_version: versions.assignments ?? null,
  };
}

function deriveSnapshotHash(metadata: Json | null, policyVersion?: string | null): string | null {
  if (policyVersion) {
    return policyVersion;
  }
  if (!metadata || typeof metadata !== "object") {
    return null;
  }
  const selection = (metadata as { selection?: unknown }).selection;
  if (!selection || typeof selection !== "object") {
    return null;
  }
  const snapshot = (selection as { snapshot?: unknown }).snapshot;
  if (!snapshot || typeof snapshot !== "object") {
    return null;
  }
  const adjacency = (snapshot as { adjacency?: unknown }).adjacency;
  if (!adjacency || typeof adjacency !== "object") {
    return null;
  }
  const hash = (adjacency as { hash?: unknown }).hash;
  return typeof hash === "string" ? hash : null;
}

export async function computeManualContext(params: { bookingId: string; client?: DbClient }) {
  await assertEnabled();
  const context = await getManualAssignmentContext({ bookingId: params.bookingId, client: params.client });
  return context;
}

export async function proposeOrHoldSelection(params: {
  sessionId: string;
  bookingId: string;
  restaurantId: string;
  tableIds: string[];
  mode: "propose" | "hold";
  requireAdjacency?: boolean;
  excludeHoldId?: string | null;
  contextVersion?: string | null;
  selectionVersion?: number;
  createdBy: string | null;
  holdTtlSeconds?: number;
  client?: DbClient;
}) {
  await assertEnabled();
  const supabase = getClient(params.client);
  let session = await loadManualSession({ sessionId: params.sessionId, client: supabase });
  session = await refreshSessionFromHold(session, supabase);

  if (session.bookingId !== params.bookingId || session.restaurantId !== params.restaurantId) {
    throw new SessionConflictError("Session does not match booking/restaurant", "SESSION_MISMATCH");
  }

  const context = await computeManualContext({ bookingId: params.bookingId, client: supabase });
  if (params.contextVersion && context.contextVersion && params.contextVersion !== context.contextVersion) {
    throw new StaleContextError(context.contextVersion, params.contextVersion);
  }

  const nextSelectionVersion = (session.selectionVersion ?? 0) + 1;
  if (typeof params.selectionVersion === "number" && params.selectionVersion !== session.selectionVersion) {
    throw new SessionConflictError("Selection version mismatch", "SELECTION_VERSION_MISMATCH", {
      expected: session.selectionVersion,
      provided: params.selectionVersion,
    });
  }

  const baseSelection: ManualSessionSelection = {
    tableIds: params.tableIds,
    requireAdjacency: params.requireAdjacency ?? null,
    summary: null,
  };

  const validation = await evaluateManualSelection({
    bookingId: params.bookingId,
    tableIds: params.tableIds,
    requireAdjacency: params.requireAdjacency,
    excludeHoldId: params.excludeHoldId ?? null,
    client: supabase,
  });

  const summary = validation.summary ?? null;
  baseSelection.summary = summary ?? null;

  if (params.mode === "propose") {
    const updated = await updateSession({
      sessionId: session.id,
      patch: {
        selection: baseSelection,
        selection_version: nextSelectionVersion,
        state: validation.ok ? "proposed" : "conflicted",
        ...buildVersionPatch({
          contextVersion: context.contextVersion ?? undefined,
          policyVersion: (validation as { policyVersion?: string }).policyVersion ?? null,
          versions: context.versions,
        }),
        snapshot_hash: null,
        expires_at: null,
        hold_id: null,
      },
      client: supabase,
    });
    return {
      session: updated,
      validation,
      context,
    };
  }

  // mode === hold
  if (!params.createdBy) {
    throw new SessionConflictError("Actor required to place hold", "CREATED_BY_REQUIRED");
  }

  const holdResult = await createManualHold({
    bookingId: params.bookingId,
    tableIds: params.tableIds,
    holdTtlSeconds: params.holdTtlSeconds,
    requireAdjacency: params.requireAdjacency,
    excludeHoldId: params.excludeHoldId ?? session.holdId ?? null,
    createdBy: params.createdBy,
    client: supabase,
  });

  if (!holdResult.hold) {
    const updated = await updateSession({
      sessionId: session.id,
      patch: {
        selection: baseSelection,
        selection_version: nextSelectionVersion,
        state: "conflicted",
        context_version: context.contextVersion ?? null,
        policy_version: (validation as { policyVersion?: string }).policyVersion ?? null,
        snapshot_hash: null,
        expires_at: null,
        hold_id: null,
      },
      client: supabase,
    });
    return {
      session: updated,
      validation: holdResult.validation ?? validation,
      context,
    };
  }

  const hold = holdResult.hold;
  // Link hold to session and mark active
  const holdUpdate: TableHoldsUpdate = {
    session_id: session.id,
    status: "active",
    last_touched_at: new Date().toISOString(),
  };
  await supabase.from("table_holds").update(holdUpdate).eq("id", hold.id);

  const policyVersion = (holdResult.validation as { policyVersion?: string })?.policyVersion ?? null;
  const snapshotHash = deriveSnapshotHash(hold.metadata, policyVersion);

  await updateSession({
    sessionId: session.id,
    patch: {
      selection: baseSelection,
      selection_version: nextSelectionVersion,
      state: "held",
      hold_id: hold.id,
      expires_at: hold.expiresAt ?? null,
      ...buildVersionPatch({
        contextVersion: context.contextVersion ?? undefined,
        policyVersion,
        versions: context.versions,
      }),
      snapshot_hash: snapshotHash ?? null,
    },
    client: supabase,
  });

  // Recompute context to capture the newly created hold in the hash we return/store
  const postHoldContext = await computeManualContext({ bookingId: params.bookingId, client: supabase });
  const contextVersion = postHoldContext.contextVersion ?? context.contextVersion ?? undefined;
  const postHoldPolicyVersion =
    postHoldContext.policyVersion ?? (holdResult.validation as { policyVersion?: string })?.policyVersion ?? null;

  const patchedAfterContext = await updateSession({
    sessionId: session.id,
    patch: {
      ...buildVersionPatch({
        contextVersion,
        policyVersion: postHoldPolicyVersion,
        versions: postHoldContext.versions ?? context.versions,
      }),
    },
    client: supabase,
  });

  return {
    session: patchedAfterContext,
    validation: holdResult.validation,
    hold,
    context: postHoldContext,
  };
}

export async function confirmSessionHold(params: {
  sessionId: string;
  bookingId: string;
  restaurantId: string;
  holdId: string;
  idempotencyKey: string;
  requireAdjacency?: boolean;
  contextVersion?: string | null;
  selectionVersion?: number;
  assignedBy: string | null;
  client?: DbClient;
}) {
  await assertEnabled();
  const supabase = getClient(params.client);
  let session = await loadManualSession({ sessionId: params.sessionId, client: supabase });
  session = await refreshSessionFromHold(session, supabase);
  if (session.bookingId !== params.bookingId || session.restaurantId !== params.restaurantId) {
    throw new SessionConflictError("Session does not match booking/restaurant", "SESSION_MISMATCH");
  }
  if (session.holdId && session.holdId !== params.holdId) {
    throw new SessionConflictError("Hold does not match session", "HOLD_MISMATCH", { sessionHoldId: session.holdId });
  }
  if (typeof params.selectionVersion === "number" && params.selectionVersion !== session.selectionVersion) {
    throw new SessionConflictError("Selection version mismatch", "SELECTION_VERSION_MISMATCH", {
      expected: session.selectionVersion,
      provided: params.selectionVersion,
    });
  }

  // Ensure hold not expired / still active
  const { data: holdRow } = await supabase
    .from("table_holds")
    .select("expires_at, status, booking_id, restaurant_id")
    .eq("id", params.holdId)
    .maybeSingle();

  if (!holdRow) {
    throw new SessionConflictError("Hold not found", "HOLD_NOT_FOUND");
  }

  const typedHoldRow = holdRow as Pick<TableHoldsRow, "status" | "booking_id" | "restaurant_id" | "expires_at">;

  if (typedHoldRow.status && typedHoldRow.status !== "active") {
    throw new SessionConflictError("Hold is not active", "HOLD_INACTIVE", { status: typedHoldRow.status });
  }

  if (typedHoldRow.booking_id && typedHoldRow.booking_id !== params.bookingId) {
    throw new SessionConflictError("Hold linked to different booking", "HOLD_BOOKING_MISMATCH");
  }

  if (typedHoldRow.restaurant_id && typedHoldRow.restaurant_id !== params.restaurantId) {
    throw new SessionConflictError("Hold linked to different restaurant", "HOLD_RESTAURANT_MISMATCH");
  }

  if (typedHoldRow.expires_at && new Date(typedHoldRow.expires_at).getTime() <= Date.now()) {
    const expireUpdate: TableHoldsUpdate = {
      status: "expired",
      last_touched_at: new Date().toISOString(),
    };
    await supabase.from("table_holds").update(expireUpdate).eq("id", params.holdId);
    throw new SessionConflictError("Hold expired", "HOLD_EXPIRED");
  }

  const context = await computeManualContext({ bookingId: params.bookingId, client: supabase });
  if (params.contextVersion && context.contextVersion && params.contextVersion !== context.contextVersion) {
    throw new StaleContextError(context.contextVersion, params.contextVersion);
  }

  const assignments = await confirmHoldAssignment({
    holdId: params.holdId,
    bookingId: params.bookingId,
    idempotencyKey: params.idempotencyKey,
    requireAdjacency: params.requireAdjacency,
    assignedBy: params.assignedBy ?? undefined,
    client: supabase,
    transition: {
      targetStatus: "confirmed",
      historyReason: "manual_assign_session_confirm",
      historyChangedBy: params.assignedBy ?? null,
      historyMetadata: {
        source: "manual_assign_session",
        sessionId: params.sessionId,
        holdId: params.holdId,
      },
    },
  });

  const confirmUpdate: TableHoldsUpdate = {
    status: "confirmed",
    last_touched_at: new Date().toISOString(),
  };
  await supabase.from("table_holds").update(confirmUpdate).eq("id", params.holdId);

  const nextSelectionVersion = (session.selectionVersion ?? 0) + 1;
  const updated = await updateSession({
    sessionId: session.id,
    patch: {
      state: "confirmed",
      selection_version: nextSelectionVersion,
      ...buildVersionPatch({
        contextVersion: context.contextVersion ?? undefined,
        policyVersion: context.policyVersion ?? null,
        versions: context.versions,
      }),
      hold_id: null,
    },
    client: supabase,
  });

  return {
    session: updated,
    assignments,
    context,
  };
}
