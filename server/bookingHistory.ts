import type { SupabaseClient } from '@supabase/supabase-js';

import type { BookingHistoryChange, BookingHistoryEvent, BookingHistoryOptions } from '@/types/bookingHistory';
import type { Database } from '@/types/supabase';

const CHANGE_TYPE_SUMMARY: Record<BookingHistoryEvent['changeType'], string> = {
  created: 'Reservation created',
  updated: 'Reservation updated',
  cancelled: 'Reservation cancelled',
  deleted: 'Reservation deleted',
};

const FIELD_LABELS: Record<string, string> = {
  booking_date: 'Date',
  start_time: 'Start time',
  end_time: 'End time',
  party_size: 'Party size',
  booking_type: 'Occasion',
  seating_preference: 'Seating',
  notes: 'Guest notes',
  status: 'Status',
};

const TRACKED_FIELDS = Object.keys(FIELD_LABELS);

type DbClient = SupabaseClient<Database, 'public', any>;

type BookingVersionRow = Database['public']['Tables']['booking_versions']['Row'];

type AuditLogRow = Database['public']['Tables']['audit_logs']['Row'];

const ACTION_BY_CHANGE_TYPE: Record<BookingHistoryEvent['changeType'], string> = {
  created: 'booking.created',
  updated: 'booking.updated',
  cancelled: 'booking.cancelled',
  deleted: 'booking.deleted',
};

function normalizeValue(value: unknown): unknown {
  if (value === undefined) return null;
  if (value === null) return null;
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed.length === 0 ? null : trimmed;
  }
  return value;
}

function computeDiff(oldData: Record<string, unknown> | null, newData: Record<string, unknown> | null): BookingHistoryChange[] {
  const changes: BookingHistoryChange[] = [];

  for (const field of TRACKED_FIELDS) {
    const before = normalizeValue(oldData ? oldData[field] : null);
    const after = normalizeValue(newData ? newData[field] : null);
    if (before === after) continue;

    changes.push({
      field,
      label: FIELD_LABELS[field] ?? field,
      before,
      after,
    });
  }

  return changes;
}

function extractChangesFromAudit(audit: AuditLogRow | null): BookingHistoryChange[] | null {
  if (!audit?.metadata || typeof audit.metadata !== 'object') {
    return null;
  }

  const rawChanges = (audit.metadata as Record<string, unknown>).changes;
  if (!Array.isArray(rawChanges)) {
    return null;
  }

  return rawChanges
    .filter((entry): entry is { field: string; before: unknown; after: unknown } =>
      Boolean(entry && typeof entry === 'object' && typeof entry.field === 'string'),
    )
    .filter((entry) => TRACKED_FIELDS.includes(entry.field))
    .map((entry) => ({
      field: entry.field,
      label: FIELD_LABELS[entry.field] ?? entry.field,
      before: normalizeValue(entry.before),
      after: normalizeValue(entry.after),
    }));
}

function resolveActor(version: BookingVersionRow, audit: AuditLogRow | null): string {
  if (audit?.actor && audit.actor.trim().length > 0) {
    return audit.actor.trim();
  }

  if (typeof version.changed_by === 'string' && version.changed_by.trim().length > 0) {
    return version.changed_by.trim();
  }

  return 'system';
}

function buildHistoryEvent(
  version: BookingVersionRow,
  audit: AuditLogRow | null,
): BookingHistoryEvent {
  const summary = CHANGE_TYPE_SUMMARY[version.change_type as BookingHistoryEvent['changeType']] ?? 'Reservation updated';
  const auditChanges = extractChangesFromAudit(audit);
  const fallbackChanges = computeDiff(
    (version.old_data as Record<string, unknown> | null) ?? null,
    (version.new_data as Record<string, unknown> | null) ?? null,
  );

  return {
    versionId: Number(version.version_id),
    changeType: version.change_type as BookingHistoryEvent['changeType'],
    changedAt: version.changed_at ?? new Date().toISOString(),
    actor: resolveActor(version, audit),
    summary,
    changes: auditChanges && auditChanges.length > 0 ? auditChanges : fallbackChanges,
  };
}

export async function getBookingHistory(
  client: DbClient,
  bookingId: string,
  options: BookingHistoryOptions = {},
): Promise<BookingHistoryEvent[]> {
  const limit = Math.max(1, Math.min(options.limit ?? 50, 100));
  const offset = Math.max(0, options.offset ?? 0);

  const { data: versions, error: versionsError} = await client
    .from('booking_versions')
    .select('version_id, booking_id, restaurant_id, change_type, changed_by, changed_at, old_data, new_data, created_at')
    .eq('booking_id', bookingId)
    .order('changed_at', { ascending: true })
    .range(offset, offset + limit - 1);

  if (versionsError) {
    throw versionsError;
  }

  if (!versions || versions.length === 0) {
    return [];
  }

  const { data: auditLogs, error: auditError } = await client
    .from('audit_logs')
    .select('id, action, metadata, created_at, actor, entity, entity_id')
    .eq('entity', 'booking')
    .eq('entity_id', bookingId)
    .order('created_at', { ascending: true });

  if (auditError) {
    throw auditError;
  }

  const auditQueue = [...(auditLogs ?? [])];
  const events = versions.map((version) => {
    const action = ACTION_BY_CHANGE_TYPE[version.change_type as BookingHistoryEvent['changeType']];
    let matchedAudit: AuditLogRow | null = null;

    if (action) {
      const index = auditQueue.findIndex((log) => log.action === action);
      if (index >= 0) {
        const [match] = auditQueue.splice(index, 1);
        matchedAudit = match ?? null;
      }
    }

    return buildHistoryEvent(version, matchedAudit);
  });

  return events.sort((a, b) => new Date(b.changedAt).getTime() - new Date(a.changedAt).getTime());
}

export const __test__ = {
  computeDiff,
  extractChangesFromAudit,
  resolveActor,
  buildHistoryEvent,
};
