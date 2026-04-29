/**
 * Phase 2 of the GBP Dual-Sync V2 architecture.
 *
 * Local, V2-only typed Supabase client adapter. The migration that adds the
 * `gbp_sync_v2_*` tables (`supabase/migrations/20260428232200_add_gbp_sync_v2.sql`)
 * has been authored but not yet applied to staging Supabase, so the
 * generated `types/supabase.ts` does not yet include these tables.
 *
 * This adapter declares the V2 table row/insert/update shapes inline and
 * exposes a `getSyncV2DbClient(client)` helper that re-types the legacy
 * service-role client for V2 use. Once `types/supabase.ts` is regenerated
 * from staging, callers can switch to the regenerated client and this
 * adapter can be deleted (or shrunk to type-aliases).
 */

import type {
  SyncV2DecisionAction,
  SyncV2DirectionIntent,
  SyncV2DraftStatus,
  SyncV2ErrorClassification,
  SyncV2PublishJobStatus,
  SyncV2PublishLeg,
  SyncV2PublishResult,
} from './types';
import type { Database, Json } from '@/types/supabase';
import type { SupabaseClient } from '@supabase/supabase-js';


// ---------------------------------------------------------------------------
// Row shapes (mirror `supabase/migrations/20260428232200_add_gbp_sync_v2.sql`)
// ---------------------------------------------------------------------------

export interface SyncV2WorkflowRow {
  id: string;
  restaurant_id: string;
  provider: 'google_business_profile';
  active_draft_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface SyncV2DraftRow {
  id: string;
  workflow_id: string;
  restaurant_id: string;
  status: SyncV2DraftStatus;
  nabatable_snapshot: Json;
  google_snapshot: Json;
  nabatable_snapshot_hash: string;
  google_snapshot_hash: string;
  diff_items: Json;
  fetched_at: string;
  created_by_user_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface SyncV2DecisionRow {
  id: string;
  draft_id: string;
  restaurant_id: string;
  section_key: string;
  field_key: string;
  action: SyncV2DecisionAction;
  nabatable_value_hash: string;
  google_value_hash: string;
  decided_by_user_id: string | null;
  decided_at: string;
  created_at: string;
  updated_at: string;
}

export interface SyncV2PublishJobRow {
  id: string;
  workflow_id: string;
  draft_id: string;
  restaurant_id: string;
  direction_intent: SyncV2DirectionIntent;
  publish_plan_id: string;
  idempotency_key: string;
  frozen_decisions: Json;
  frozen_decisions_hash: string;
  frozen_nabatable_snapshot_hash: string;
  frozen_google_snapshot_hash: string;
  preflight_result: Json;
  google_update_masks: string[];
  status: SyncV2PublishJobStatus;
  error_classification: SyncV2ErrorClassification | null;
  errors: Json;
  nabatable_event_id: string | null;
  google_event_id: string | null;
  rollback_event_id: string | null;
  preflighted_at: string;
  published_at: string | null;
  failed_at: string | null;
  retried_at: string | null;
  created_by_user_id: string | null;
  published_by_user_id: string | null;
  retried_by_user_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface SyncV2PublishEventRow {
  id: string;
  publish_job_id: string;
  restaurant_id: string;
  direction: SyncV2DirectionIntent;
  leg: SyncV2PublishLeg;
  result: SyncV2PublishResult;
  affected_section_keys: string[];
  google_update_masks: string[];
  old_values: Json;
  new_values: Json;
  errors: Json;
  actor_user_id: string | null;
  created_at: string;
}

// ---------------------------------------------------------------------------
// V2-typed Supabase client
// ---------------------------------------------------------------------------

type SyncV2Database = {
  public: {
    Tables: {
      gbp_sync_v2_workflows: {
        Row: SyncV2WorkflowRow;
        Insert: Partial<SyncV2WorkflowRow> & Pick<SyncV2WorkflowRow, 'restaurant_id'>;
        Update: Partial<SyncV2WorkflowRow>;
        Relationships: [];
      };
      gbp_sync_v2_drafts: {
        Row: SyncV2DraftRow;
        Insert: Partial<SyncV2DraftRow> &
          Pick<
            SyncV2DraftRow,
            'workflow_id' | 'restaurant_id' | 'nabatable_snapshot_hash' | 'google_snapshot_hash'
          >;
        Update: Partial<SyncV2DraftRow>;
        Relationships: [];
      };
      gbp_sync_v2_decisions: {
        Row: SyncV2DecisionRow;
        Insert: Partial<SyncV2DecisionRow> &
          Pick<
            SyncV2DecisionRow,
            | 'draft_id'
            | 'restaurant_id'
            | 'section_key'
            | 'field_key'
            | 'action'
            | 'nabatable_value_hash'
            | 'google_value_hash'
          >;
        Update: Partial<SyncV2DecisionRow>;
        Relationships: [];
      };
      gbp_sync_v2_publish_jobs: {
        Row: SyncV2PublishJobRow;
        Insert: Partial<SyncV2PublishJobRow> &
          Pick<
            SyncV2PublishJobRow,
            | 'workflow_id'
            | 'draft_id'
            | 'restaurant_id'
            | 'direction_intent'
            | 'idempotency_key'
            | 'frozen_decisions_hash'
            | 'frozen_nabatable_snapshot_hash'
            | 'frozen_google_snapshot_hash'
          >;
        Update: Partial<SyncV2PublishJobRow>;
        Relationships: [];
      };
      gbp_sync_v2_publish_events: {
        Row: SyncV2PublishEventRow;
        Insert: Partial<SyncV2PublishEventRow> &
          Pick<SyncV2PublishEventRow, 'publish_job_id' | 'restaurant_id' | 'direction' | 'leg'>;
        Update: Partial<SyncV2PublishEventRow>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};

export type SyncV2DbClient = SupabaseClient<SyncV2Database>;

/**
 * Re-type a legacy `SupabaseClient<Database>` for V2 use. Pass the same
 * service-role client returned by `@/server/supabase`'s
 * `getServiceSupabaseClient()`. The cast is safe at runtime because
 * Supabase-js does not introspect the type parameter.
 */
export function getSyncV2DbClient(client: SupabaseClient<Database>): SyncV2DbClient {
  return client as unknown as SyncV2DbClient;
}
