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
  DualSyncJobKind,
  DualSyncJobStatus,
  DualSyncPublishBatchStatus,
  DualSyncGoogleRequestLogPhase,
  DualSyncPublishOperationStatus,
  DualSyncPublishOperationGroupStatus,
  DualSyncLockJobKind,
  DualSyncLockStatus,
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

export interface DualSyncJobRow {
  id: string;
  restaurant_id: string;
  provider: 'google_business_profile';
  job_kind: DualSyncJobKind;
  status: DualSyncJobStatus;
  idempotency_key: string | null;
  priority: number;
  payload: Json;
  readonly external_profile_id: string | null;
  readonly external_account_id: string | null;
  readonly external_location_id: string | null;
  readonly connection_generation: number | null;
  readonly consent_epoch: number | null;
  attempt_count: number;
  max_attempts: number;
  available_at: string;
  locked_at: string | null;
  locked_by: string | null;
  last_error_code: string | null;
  last_error_message: string | null;
  dead_letter_reason: string | null;
  started_at: string | null;
  finished_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface DualSyncRestaurantControlRow {
  restaurant_id: string;
  provider: 'google_business_profile';
  sync_paused: boolean;
  pause_reason: string | null;
  paused_by_user_id: string | null;
  paused_at: string | null;
  resumed_at: string | null;
  created_at: string;
  updated_at: string;
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
  publish_batch_id: string | null;
  operation_group_id: string | null;
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

export interface DualSyncPublishBatchRow {
  id: string;
  restaurant_id: string;
  provider: 'google_business_profile';
  client_request_id: string | null;
  actor_user_id: string | null;
  status: DualSyncPublishBatchStatus;
  decision_hash: string;
  pinned_core_snapshot_hash: string | null;
  pinned_gbp_snapshot_hash: string | null;
  core_snapshot_hash: string | null;
  gbp_snapshot_hash: string | null;
  field_policy_version_id: string | null;
  field_policy_hash: string | null;
  accepted_count: number;
  rejected_count: number;
  ignored_count: number;
  plan_summary: Json;
  error_code: string | null;
  error_message: string | null;
  started_at: string | null;
  finished_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface DualSyncPublishOperationGroupRow {
  id: string;
  restaurant_id: string;
  publish_batch_id: string;
  group_key: string;
  section_key: string;
  direction: 'import_from_google' | 'export_to_google';
  write_group: string;
  status: DualSyncPublishOperationGroupStatus;
  risk_level: string;
  requires_preflight: boolean;
  requires_manual_confirmation: boolean;
  destructive_write_possible: boolean;
  google_update_masks: string[];
  decision_count: number;
  preflight_status: string | null;
  preflight_result: Json | null;
  request_summary: Json | null;
  response_summary: Json | null;
  error_code: string | null;
  error_message: string | null;
  started_at: string | null;
  finished_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface DualSyncLockRow {
  id: string;
  restaurant_id: string;
  provider: 'google_business_profile';
  job_kind: DualSyncLockJobKind;
  holder_id: string;
  status: DualSyncLockStatus;
  acquired_at: string;
  expires_at: string;
  released_at: string | null;
  metadata: Json;
  created_at: string;
  updated_at: string;
}

export interface DualSyncGoogleEditReservationRow {
  id: string;
  restaurant_id: string;
  provider: 'google_business_profile';
  write_group: string;
  reserved_at: string;
  window_ms: number;
  created_at: string;
}

export interface DualSyncGoogleRequestLogRow {
  id: string;
  restaurant_id: string;
  provider: 'google_business_profile';
  publish_batch_id: string | null;
  operation_group_id: string | null;
  publish_operation_id: string | null;
  publish_job_id: string | null;
  section_key: string | null;
  field_key: string | null;
  direction: 'import_from_google' | 'export_to_google' | null;
  write_group: string | null;
  phase: DualSyncGoogleRequestLogPhase;
  status: string | null;
  google_method: string | null;
  google_update_masks: string[];
  request_summary: Json;
  response_summary: Json | null;
  error_code: string | null;
  error_message: string | null;
  retention_expires_at: string | null;
  created_at: string;
}

export interface DualSyncGoogleRequestLogArchiveRow {
  id: string;
  original_request_log_id: string;
  restaurant_id: string;
  provider: 'google_business_profile';
  retention_expires_at: string;
  original_created_at: string;
  archived_payload: Json;
  archived_at: string;
}

export interface DualSyncFieldPolicyVersionRow {
  id: string;
  restaurant_id: string | null;
  provider: 'google_business_profile';
  version_label: string;
  policy_hash: string;
  policy_snapshot: Json;
  field_count: number;
  active: boolean;
  created_by_user_id: string | null;
  activated_at: string | null;
  created_at: string;
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
      dual_sync_jobs: {
        Row: DualSyncJobRow;
        Insert: Partial<DualSyncJobRow> & Pick<DualSyncJobRow, 'restaurant_id' | 'job_kind'>;
        Update: Partial<DualSyncJobRow>;
        Relationships: [];
      };
      dual_sync_restaurant_controls: {
        Row: DualSyncRestaurantControlRow;
        Insert: Partial<DualSyncRestaurantControlRow> &
          Pick<DualSyncRestaurantControlRow, 'restaurant_id'>;
        Update: Partial<DualSyncRestaurantControlRow>;
        Relationships: [];
      };
      dual_sync_outbound_candidates: {
        Row: DualSyncOutboundCandidateRow;
        Insert: Partial<DualSyncOutboundCandidateRow> &
          Pick<DualSyncOutboundCandidateRow, 'restaurant_id' | 'section_key' | 'field_key'>;
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
      dual_sync_publish_batches: {
        Row: DualSyncPublishBatchRow;
        Insert: Partial<DualSyncPublishBatchRow> &
          Pick<DualSyncPublishBatchRow, 'restaurant_id' | 'decision_hash'>;
        Update: Partial<DualSyncPublishBatchRow>;
        Relationships: [];
      };
      dual_sync_publish_operation_groups: {
        Row: DualSyncPublishOperationGroupRow;
        Insert: Partial<DualSyncPublishOperationGroupRow> &
          Pick<
            DualSyncPublishOperationGroupRow,
            | 'restaurant_id'
            | 'publish_batch_id'
            | 'group_key'
            | 'section_key'
            | 'direction'
            | 'write_group'
          >;
        Update: Partial<DualSyncPublishOperationGroupRow>;
        Relationships: [];
      };
      dual_sync_locks: {
        Row: DualSyncLockRow;
        Insert: Partial<DualSyncLockRow> &
          Pick<DualSyncLockRow, 'restaurant_id' | 'job_kind' | 'holder_id' | 'expires_at'>;
        Update: Partial<DualSyncLockRow>;
        Relationships: [];
      };
      dual_sync_google_edit_reservations: {
        Row: DualSyncGoogleEditReservationRow;
        Insert: Partial<DualSyncGoogleEditReservationRow> &
          Pick<DualSyncGoogleEditReservationRow, 'restaurant_id' | 'write_group'>;
        Update: Partial<DualSyncGoogleEditReservationRow>;
        Relationships: [];
      };
      dual_sync_google_request_logs: {
        Row: DualSyncGoogleRequestLogRow;
        Insert: Partial<DualSyncGoogleRequestLogRow> &
          Pick<DualSyncGoogleRequestLogRow, 'restaurant_id' | 'phase'>;
        Update: Partial<DualSyncGoogleRequestLogRow>;
        Relationships: [];
      };
      dual_sync_google_request_log_archives: {
        Row: DualSyncGoogleRequestLogArchiveRow;
        Insert: Partial<DualSyncGoogleRequestLogArchiveRow> &
          Pick<
            DualSyncGoogleRequestLogArchiveRow,
            | 'original_request_log_id'
            | 'restaurant_id'
            | 'retention_expires_at'
            | 'original_created_at'
            | 'archived_payload'
          >;
        Update: Partial<DualSyncGoogleRequestLogArchiveRow>;
        Relationships: [];
      };
      dual_sync_field_policy_versions: {
        Row: DualSyncFieldPolicyVersionRow;
        Insert: Partial<DualSyncFieldPolicyVersionRow> &
          Pick<
            DualSyncFieldPolicyVersionRow,
            'version_label' | 'policy_hash' | 'policy_snapshot' | 'field_count'
          >;
        Update: Partial<DualSyncFieldPolicyVersionRow>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      dual_sync_reserve_google_edit_budget: {
        Args: {
          p_restaurant_id: string;
          p_write_group: string;
          p_limit?: number;
          p_window_ms?: number;
          p_now?: string;
        };
        Returns: {
          allowed: boolean;
          retry_after_ms: number | null;
          remaining: number;
        }[];
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};

export type DualSyncDbClient = SupabaseClient<DualSyncDatabase>;

export function getDualSyncDbClient(client: SupabaseClient<Database>): DualSyncDbClient {
  return client as unknown as DualSyncDbClient;
}
