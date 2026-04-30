/**
 * Phase 1 of the unified dual-sync engine.
 *
 * Local typed Supabase client adapter. The migration that adds the
 * `dual_sync_*` tables is authored in
 * `supabase/migrations/20260429210000_add_unified_dual_sync_domain.sql`
 * and will be applied to staging before production. Until
 * `types/supabase.ts` is regenerated, this adapter declares the row /
 * insert / update shapes inline and exposes `getDualSyncDbClient(client)`
 * to re-type a legacy `SupabaseClient<Database>`.
 *
 * The casts are safe at runtime because Supabase-js does not introspect
 * the type parameter.
 */

import type {
  DualSyncFieldState,
  DualSyncOutboundSource,
  DualSyncOutboundStatus,
  DualSyncPublishOperationStatus,
  DualSyncSnapshotRunKind,
  DualSyncSnapshotRunStatus,
} from './types';
import type { Database, Json } from '@/types/supabase';
import type { SupabaseClient } from '@supabase/supabase-js';

export interface DualSyncFieldStateRow {
  id: string;
  restaurant_id: string;
  provider: 'google_business_profile';
  section_key: string;
  field_key: string;
  state: DualSyncFieldState;
  core_value_hash: string | null;
  gbp_value_hash: string | null;
  last_in_sync_hash: string | null;
  last_core_change_at: string | null;
  last_gbp_change_at: string | null;
  last_in_sync_at: string | null;
  last_snapshot_run_id: string | null;
  metadata: Json;
  created_at: string;
  updated_at: string;
}

export interface DualSyncSnapshotRunRow {
  id: string;
  restaurant_id: string;
  provider: 'google_business_profile';
  run_kind: DualSyncSnapshotRunKind;
  status: DualSyncSnapshotRunStatus;
  raw_payload: Json | null;
  canonical_snapshot: Json | null;
  snapshot_hash: string | null;
  error_code: string | null;
  error_message: string | null;
  started_at: string;
  finished_at: string | null;
  created_at: string;
}

export interface DualSyncOutboundCandidateRow {
  id: string;
  restaurant_id: string;
  provider: 'google_business_profile';
  section_key: string;
  field_key: string;
  proposed_value: Json | null;
  proposed_value_hash: string | null;
  baseline_gbp_hash: string | null;
  status: DualSyncOutboundStatus;
  source: DualSyncOutboundSource;
  created_by_user_id: string | null;
  resolved_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface DualSyncPublishOperationRow {
  id: string;
  restaurant_id: string;
  publish_job_id: string;
  section_key: string;
  field_key: string;
  direction: 'import_from_google' | 'export_to_google';
  status: DualSyncPublishOperationStatus;
  attempt_count: number;
  before_core_hash: string | null;
  before_gbp_hash: string | null;
  after_core_hash: string | null;
  after_gbp_hash: string | null;
  google_update_mask: string | null;
  error_code: string | null;
  error_message: string | null;
  external_response: Json | null;
  started_at: string | null;
  finished_at: string | null;
  created_at: string;
  updated_at: string;
}

type DualSyncDatabase = {
  public: {
    Tables: {
      dual_sync_field_states: {
        Row: DualSyncFieldStateRow;
        Insert: Partial<DualSyncFieldStateRow> &
          Pick<DualSyncFieldStateRow, 'restaurant_id' | 'section_key' | 'field_key'>;
        Update: Partial<DualSyncFieldStateRow>;
        Relationships: [];
      };
      dual_sync_snapshot_runs: {
        Row: DualSyncSnapshotRunRow;
        Insert: Partial<DualSyncSnapshotRunRow> &
          Pick<DualSyncSnapshotRunRow, 'restaurant_id' | 'run_kind'>;
        Update: Partial<DualSyncSnapshotRunRow>;
        Relationships: [];
      };
      dual_sync_outbound_candidates: {
        Row: DualSyncOutboundCandidateRow;
        Insert: Partial<DualSyncOutboundCandidateRow> &
          Pick<
            DualSyncOutboundCandidateRow,
            'restaurant_id' | 'section_key' | 'field_key'
          >;
        Update: Partial<DualSyncOutboundCandidateRow>;
        Relationships: [];
      };
      dual_sync_publish_operations: {
        Row: DualSyncPublishOperationRow;
        Insert: Partial<DualSyncPublishOperationRow> &
          Pick<
            DualSyncPublishOperationRow,
            'restaurant_id' | 'publish_job_id' | 'section_key' | 'field_key' | 'direction'
          >;
        Update: Partial<DualSyncPublishOperationRow>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};

export type DualSyncDbClient = SupabaseClient<DualSyncDatabase>;

export function getDualSyncDbClient(client: SupabaseClient<Database>): DualSyncDbClient {
  return client as unknown as DualSyncDbClient;
}
