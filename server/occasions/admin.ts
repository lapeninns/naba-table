import { getServiceSupabaseClient } from '@/server/supabase';

import type { Database, Json } from '@/types/supabase';
import type { OccasionDefinition } from '@reserve/shared/occasions';
import type { SupabaseClient } from '@supabase/supabase-js';

export type AdminOccasion = OccasionDefinition & {
  isBuiltin: boolean;
  deletedAt: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
  createdBy?: string | null;
  updatedBy?: string | null;
};

type OccasionRow = Database['public']['Tables']['booking_occasions']['Row'] & {
  is_builtin?: boolean | null;
  deleted_at?: string | null;
  created_by?: string | null;
  updated_by?: string | null;
};

type AuditInsert = {
  occasion_key: string;
  action: 'create' | 'update' | 'delete';
  before_change: Json | null;
  after_change: Json | null;
  changed_by: string | null;
};

const ACTIVE_COLUMNS =
  'key, label, short_label, description, availability, default_duration_minutes, display_order, is_active, is_builtin, deleted_at, created_at, updated_at, created_by, updated_by';

export function toAdminOccasion(row: OccasionRow): AdminOccasion {
  return {
    key: row.key,
    label: row.label,
    shortLabel: row.short_label ?? row.label,
    description: row.description ?? null,
    availability: (row.availability as unknown as AdminOccasion['availability']) ?? [],
    defaultDurationMinutes: row.default_duration_minutes ?? 90,
    displayOrder: row.display_order ?? 0,
    isActive: row.is_active ?? true,
    isBuiltin: Boolean(row.is_builtin),
    deletedAt: row.deleted_at ?? null,
    createdAt: (row as { created_at?: string | null }).created_at ?? null,
    updatedAt: (row as { updated_at?: string | null }).updated_at ?? null,
    createdBy: row.created_by ?? null,
    updatedBy: row.updated_by ?? null,
  };
}

export async function fetchAllOccasions(client = getServiceSupabaseClient()): Promise<AdminOccasion[]> {
  const { data, error } = await client
    .from('booking_occasions')
    .select(ACTIVE_COLUMNS)
    .is('deleted_at', null)
    .order('display_order', { ascending: true })
    .order('label', { ascending: true })
    .returns<OccasionRow[]>();

  if (error) {
    throw error;
  }

  return (data ?? []).map(toAdminOccasion);
}

export async function fetchOccasionByKey(key: string, client = getServiceSupabaseClient()): Promise<OccasionRow | null> {
  const { data, error } = await client
    .from('booking_occasions')
    .select(ACTIVE_COLUMNS)
    .eq('key', key)
    .maybeSingle<OccasionRow>();
  if (error) {
    throw error;
  }
  return data as OccasionRow | null;
}

export async function insertAudit(entry: AuditInsert, client = getServiceSupabaseClient()): Promise<void> {
  const payload = {
    occasion_key: entry.occasion_key,
    action: entry.action,
    before_change: entry.before_change,
    after_change: entry.after_change,
    changed_by: entry.changed_by,
  };
  const { error } = await client.from('booking_occasions_audit').insert(payload);
  if (error) {
    // Log but do not block request flow.
    console.warn('[ops/occasions] failed to insert audit log', error);
  }
}

export async function countOccasionReferences(key: string, client: SupabaseClient<Database>): Promise<{
  servicePeriods: number;
  futureBookings: number;
}> {
  const today = new Date();
  const todayKey = today.toISOString().slice(0, 10);

  const [{ count: servicePeriods = 0, error: spError }, { count: futureBookings = 0, error: bookingsError }] =
    await Promise.all([
      client
        .from('restaurant_service_periods')
        .select('id', { head: true, count: 'exact' })
        .eq('booking_option', key),
      client
        .from('bookings')
        .select('id', { head: true, count: 'exact' })
        .eq('booking_type', key)
        .gte('booking_date', todayKey),
    ]);

  if (spError) throw spError;
  if (bookingsError) throw bookingsError;

  return {
    servicePeriods: servicePeriods ?? 0,
    futureBookings: futureBookings ?? 0,
  };
}
