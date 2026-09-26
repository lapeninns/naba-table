export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

type GbpWriteGrantV1Row = {
  actor_user_id: string;
  after_hashes: string[];
  before_hashes: string[];
  bundle_hash: string;
  bundle_id: string;
  bundle_order: number;
  bundle_size: number;
  claimed_at: string | null;
  connection_generation: number;
  consent_epoch: number;
  core_snapshot_hash: string;
  created_at: string;
  decision_hash: string;
  direction: string;
  dispatched_at: string | null;
  execution_id: string | null;
  expires_at: string;
  external_account_id: string;
  external_location_id: string;
  external_profile_id: string;
  external_profile_row_id: string;
  field_keys: string[];
  google_method: string;
  google_resource: string;
  google_snapshot_hash: string;
  group_id: string;
  id: string;
  issued_at: string;
  manifest_hash: string;
  policy_version: string;
  preview_fingerprint: string;
  provider: 'google_business_profile';
  reason_code: string | null;
  renderer_version: string;
  request_hash: string;
  restaurant_id: string;
  risk_acknowledgements: string[];
  status: string;
  terminal_at: string | null;
  update_masks: string[];
  update_masks_hash: string;
  write_group: string;
};

type GbpWriteGrantIssueV1 = {
  after_hashes: string[];
  before_hashes: string[];
  bundle_order: number;
  core_snapshot_hash: string;
  decision_hash: string;
  direction: string;
  field_keys: string[];
  google_method: string;
  google_resource: string;
  google_snapshot_hash: string;
  group_id: string;
  grant_id: string;
  manifest_hash: string;
  preview_fingerprint: string;
  request_hash: string;
  risk_acknowledgements: string[];
  update_masks: string[];
  update_masks_hash: string;
  write_group: string;
};

type GbpWriteBundleEnqueueResultV1 = {
  grants: GbpWriteGrantV1Row[];
  job_id: string;
  job_payload: Json;
  job_status: string;
};

type GbpConsentEventV1Row = {
  actor_user_id: string | null;
  bundle_id: string | null;
  created_at: string;
  event_hash: string;
  event_type: string;
  execution_id: string | null;
  grant_id: string | null;
  id: string;
  reason_code: string | null;
  restaurant_id: string;
  status: string;
};

type GbpNotificationRegistryV1Row = {
  created_at: string;
  external_account_id: string;
  id: string;
  managed_topic: string;
  provider: string;
  provider_notification_setting_id: string | null;
  ref_count: number;
  updated_at: string;
};

type GbpPubsubReceiptResultV1 = {
  job_id: string | null;
  processing_result:
    | 'accepted'
    | 'duplicate'
    | 'ignored'
    | 'unmatched'
    | 'poison'
    | 'rejected'
    | 'failed';
  receipt_inserted: boolean;
};

type GbpScheduledRefreshResultV1 = {
  created: boolean;
  job_id: string;
  restaurant_id: string;
};

type GbpTerminalNoticeCensusV1 = {
  claimed_count: number;
  delivered_count: number;
  dispatched_count: number;
  failed_count: number;
  oldest_pending_at: string | null;
  outcome_unknown_count: number;
  overdue_count: number;
  pending_count: number;
};

type GbpFieldProvenanceV1Row = {
  connection_generation: number | null;
  consent_epoch: number | null;
  created_at: string;
  expires_at: string | null;
  expiry_basis: string | null;
  external_account_id: string | null;
  external_location_id: string | null;
  external_profile_id: string | null;
  external_profile_row_id: string | null;
  field_key: string;
  id: string;
  observed_at: string | null;
  restaurant_id: string;
  source: string;
  source_row_id: string;
  source_table: string;
  updated_at: string;
  value_hash: string;
};

type GbpCoreChangeOutboxV1Row = {
  after_hash: string | null;
  attempt_count: number;
  available_at: string;
  before_hash: string | null;
  claimed_at: string | null;
  claimed_by: string | null;
  completed_at: string | null;
  created_at: string;
  dead_lettered_at: string | null;
  field_keys: string[];
  id: string;
  idempotency_hash: string;
  last_error_code: string | null;
  lease_expires_at: string | null;
  lease_token: string | null;
  max_attempts: number;
  operation: string;
  restaurant_id: string;
  source_row_id: string;
  source_table: string;
  status: string;
};

type GbpCoreOutboxCensusV1 = {
  claimed: number;
  completed: number;
  dead_letter: number;
  oldest_outstanding_age_seconds: number | null;
  pending_available: number;
  pending_delayed: number;
  stale_claimed: number;
};

type GbpContentRetentionResultV1 = {
  action: string;
  matched_count: number;
  more_likely: boolean;
  mutated_count: number;
  oldest_expires_at: string | null;
  store_key: string;
};

type GbpContentRetentionReadinessV1 = {
  backup_window_days: number | null;
  computed_live_ttl_days: number | null;
  policy_version: string | null;
  provider: string;
  ready: boolean;
  renderer_version: string | null;
  valid_until: string | null;
};

type GbpDualSyncSnapshotRunV1Row = {
  canonical_snapshot: Json | null;
  created_at: string;
  error_code: string | null;
  error_message: string | null;
  finished_at: string | null;
  id: string;
  provider: 'google_business_profile';
  raw_payload: Json | null;
  restaurant_id: string;
  run_kind: string;
  snapshot_hash: string | null;
  started_at: string;
  status: string;
};

type GbpFoodMenuSnapshotV1Row = {
  canonical_food_menus: Json | null;
  created_at: string;
  created_by_user_id: string | null;
  error_code: string | null;
  error_message: string | null;
  external_profile_id: string | null;
  food_menus_name: string | null;
  google_etag: string | null;
  id: string;
  projection_metadata: Json;
  provider: string;
  pulled_at: string | null;
  raw_food_menus: Json | null;
  restaurant_id: string;
  snapshot_hash: string | null;
  snapshot_kind: string;
  source: string;
  status: string;
};

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: '14.1';
  };
  auth: {
    Tables: {
      audit_log_entries: {
        Row: {
          created_at: string | null;
          id: string;
          instance_id: string | null;
          ip_address: string;
          payload: Json | null;
        };
        Insert: {
          created_at?: string | null;
          id: string;
          instance_id?: string | null;
          ip_address?: string;
          payload?: Json | null;
        };
        Update: {
          created_at?: string | null;
          id?: string;
          instance_id?: string | null;
          ip_address?: string;
          payload?: Json | null;
        };
        Relationships: [];
      };
      flow_state: {
        Row: {
          auth_code: string | null;
          auth_code_issued_at: string | null;
          authentication_method: string;
          code_challenge: string | null;
          code_challenge_method: Database['auth']['Enums']['code_challenge_method'] | null;
          created_at: string | null;
          email_optional: boolean;
          id: string;
          invite_token: string | null;
          linking_target_id: string | null;
          oauth_client_state_id: string | null;
          provider_access_token: string | null;
          provider_refresh_token: string | null;
          provider_type: string;
          referrer: string | null;
          updated_at: string | null;
          user_id: string | null;
        };
        Insert: {
          auth_code?: string | null;
          auth_code_issued_at?: string | null;
          authentication_method: string;
          code_challenge?: string | null;
          code_challenge_method?: Database['auth']['Enums']['code_challenge_method'] | null;
          created_at?: string | null;
          email_optional?: boolean;
          id: string;
          invite_token?: string | null;
          linking_target_id?: string | null;
          oauth_client_state_id?: string | null;
          provider_access_token?: string | null;
          provider_refresh_token?: string | null;
          provider_type: string;
          referrer?: string | null;
          updated_at?: string | null;
          user_id?: string | null;
        };
        Update: {
          auth_code?: string | null;
          auth_code_issued_at?: string | null;
          authentication_method?: string;
          code_challenge?: string | null;
          code_challenge_method?: Database['auth']['Enums']['code_challenge_method'] | null;
          created_at?: string | null;
          email_optional?: boolean;
          id?: string;
          invite_token?: string | null;
          linking_target_id?: string | null;
          oauth_client_state_id?: string | null;
          provider_access_token?: string | null;
          provider_refresh_token?: string | null;
          provider_type?: string;
          referrer?: string | null;
          updated_at?: string | null;
          user_id?: string | null;
        };
        Relationships: [];
      };
      identities: {
        Row: {
          created_at: string | null;
          email: string | null;
          id: string;
          identity_data: Json;
          last_sign_in_at: string | null;
          provider: string;
          provider_id: string;
          updated_at: string | null;
          user_id: string;
        };
        Insert: {
          created_at?: string | null;
          email?: string | null;
          id?: string;
          identity_data: Json;
          last_sign_in_at?: string | null;
          provider: string;
          provider_id: string;
          updated_at?: string | null;
          user_id: string;
        };
        Update: {
          created_at?: string | null;
          email?: string | null;
          id?: string;
          identity_data?: Json;
          last_sign_in_at?: string | null;
          provider?: string;
          provider_id?: string;
          updated_at?: string | null;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'identities_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
        ];
      };
      instances: {
        Row: {
          created_at: string | null;
          id: string;
          raw_base_config: string | null;
          updated_at: string | null;
          uuid: string | null;
        };
        Insert: {
          created_at?: string | null;
          id: string;
          raw_base_config?: string | null;
          updated_at?: string | null;
          uuid?: string | null;
        };
        Update: {
          created_at?: string | null;
          id?: string;
          raw_base_config?: string | null;
          updated_at?: string | null;
          uuid?: string | null;
        };
        Relationships: [];
      };
      mfa_amr_claims: {
        Row: {
          authentication_method: string;
          created_at: string;
          id: string;
          session_id: string;
          updated_at: string;
        };
        Insert: {
          authentication_method: string;
          created_at: string;
          id: string;
          session_id: string;
          updated_at: string;
        };
        Update: {
          authentication_method?: string;
          created_at?: string;
          id?: string;
          session_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'mfa_amr_claims_session_id_fkey';
            columns: ['session_id'];
            isOneToOne: false;
            referencedRelation: 'sessions';
            referencedColumns: ['id'];
          },
        ];
      };
      mfa_challenges: {
        Row: {
          created_at: string;
          factor_id: string;
          id: string;
          ip_address: unknown;
          otp_code: string | null;
          verified_at: string | null;
          web_authn_session_data: Json | null;
        };
        Insert: {
          created_at: string;
          factor_id: string;
          id: string;
          ip_address: unknown;
          otp_code?: string | null;
          verified_at?: string | null;
          web_authn_session_data?: Json | null;
        };
        Update: {
          created_at?: string;
          factor_id?: string;
          id?: string;
          ip_address?: unknown;
          otp_code?: string | null;
          verified_at?: string | null;
          web_authn_session_data?: Json | null;
        };
        Relationships: [
          {
            foreignKeyName: 'mfa_challenges_auth_factor_id_fkey';
            columns: ['factor_id'];
            isOneToOne: false;
            referencedRelation: 'mfa_factors';
            referencedColumns: ['id'];
          },
        ];
      };
      mfa_factors: {
        Row: {
          created_at: string;
          factor_type: Database['auth']['Enums']['factor_type'];
          friendly_name: string | null;
          id: string;
          last_challenged_at: string | null;
          last_webauthn_challenge_data: Json | null;
          phone: string | null;
          secret: string | null;
          status: Database['auth']['Enums']['factor_status'];
          updated_at: string;
          user_id: string;
          web_authn_aaguid: string | null;
          web_authn_credential: Json | null;
        };
        Insert: {
          created_at: string;
          factor_type: Database['auth']['Enums']['factor_type'];
          friendly_name?: string | null;
          id: string;
          last_challenged_at?: string | null;
          last_webauthn_challenge_data?: Json | null;
          phone?: string | null;
          secret?: string | null;
          status: Database['auth']['Enums']['factor_status'];
          updated_at: string;
          user_id: string;
          web_authn_aaguid?: string | null;
          web_authn_credential?: Json | null;
        };
        Update: {
          created_at?: string;
          factor_type?: Database['auth']['Enums']['factor_type'];
          friendly_name?: string | null;
          id?: string;
          last_challenged_at?: string | null;
          last_webauthn_challenge_data?: Json | null;
          phone?: string | null;
          secret?: string | null;
          status?: Database['auth']['Enums']['factor_status'];
          updated_at?: string;
          user_id?: string;
          web_authn_aaguid?: string | null;
          web_authn_credential?: Json | null;
        };
        Relationships: [
          {
            foreignKeyName: 'mfa_factors_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
        ];
      };
      oauth_authorizations: {
        Row: {
          approved_at: string | null;
          authorization_code: string | null;
          authorization_id: string;
          client_id: string;
          code_challenge: string | null;
          code_challenge_method: Database['auth']['Enums']['code_challenge_method'] | null;
          created_at: string;
          expires_at: string;
          id: string;
          nonce: string | null;
          redirect_uri: string;
          resource: string | null;
          response_type: Database['auth']['Enums']['oauth_response_type'];
          scope: string;
          state: string | null;
          status: Database['auth']['Enums']['oauth_authorization_status'];
          user_id: string | null;
        };
        Insert: {
          approved_at?: string | null;
          authorization_code?: string | null;
          authorization_id: string;
          client_id: string;
          code_challenge?: string | null;
          code_challenge_method?: Database['auth']['Enums']['code_challenge_method'] | null;
          created_at?: string;
          expires_at?: string;
          id: string;
          nonce?: string | null;
          redirect_uri: string;
          resource?: string | null;
          response_type?: Database['auth']['Enums']['oauth_response_type'];
          scope: string;
          state?: string | null;
          status?: Database['auth']['Enums']['oauth_authorization_status'];
          user_id?: string | null;
        };
        Update: {
          approved_at?: string | null;
          authorization_code?: string | null;
          authorization_id?: string;
          client_id?: string;
          code_challenge?: string | null;
          code_challenge_method?: Database['auth']['Enums']['code_challenge_method'] | null;
          created_at?: string;
          expires_at?: string;
          id?: string;
          nonce?: string | null;
          redirect_uri?: string;
          resource?: string | null;
          response_type?: Database['auth']['Enums']['oauth_response_type'];
          scope?: string;
          state?: string | null;
          status?: Database['auth']['Enums']['oauth_authorization_status'];
          user_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'oauth_authorizations_client_id_fkey';
            columns: ['client_id'];
            isOneToOne: false;
            referencedRelation: 'oauth_clients';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'oauth_authorizations_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
        ];
      };
      oauth_client_states: {
        Row: {
          code_verifier: string | null;
          created_at: string;
          id: string;
          provider_type: string;
        };
        Insert: {
          code_verifier?: string | null;
          created_at: string;
          id: string;
          provider_type: string;
        };
        Update: {
          code_verifier?: string | null;
          created_at?: string;
          id?: string;
          provider_type?: string;
        };
        Relationships: [];
      };
      oauth_clients: {
        Row: {
          client_name: string | null;
          client_secret_hash: string | null;
          client_type: Database['auth']['Enums']['oauth_client_type'];
          client_uri: string | null;
          created_at: string;
          deleted_at: string | null;
          grant_types: string;
          id: string;
          logo_uri: string | null;
          redirect_uris: string;
          registration_type: Database['auth']['Enums']['oauth_registration_type'];
          token_endpoint_auth_method: string;
          updated_at: string;
        };
        Insert: {
          client_name?: string | null;
          client_secret_hash?: string | null;
          client_type?: Database['auth']['Enums']['oauth_client_type'];
          client_uri?: string | null;
          created_at?: string;
          deleted_at?: string | null;
          grant_types: string;
          id: string;
          logo_uri?: string | null;
          redirect_uris: string;
          registration_type: Database['auth']['Enums']['oauth_registration_type'];
          token_endpoint_auth_method: string;
          updated_at?: string;
        };
        Update: {
          client_name?: string | null;
          client_secret_hash?: string | null;
          client_type?: Database['auth']['Enums']['oauth_client_type'];
          client_uri?: string | null;
          created_at?: string;
          deleted_at?: string | null;
          grant_types?: string;
          id?: string;
          logo_uri?: string | null;
          redirect_uris?: string;
          registration_type?: Database['auth']['Enums']['oauth_registration_type'];
          token_endpoint_auth_method?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      oauth_consents: {
        Row: {
          client_id: string;
          granted_at: string;
          id: string;
          revoked_at: string | null;
          scopes: string;
          user_id: string;
        };
        Insert: {
          client_id: string;
          granted_at?: string;
          id: string;
          revoked_at?: string | null;
          scopes: string;
          user_id: string;
        };
        Update: {
          client_id?: string;
          granted_at?: string;
          id?: string;
          revoked_at?: string | null;
          scopes?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'oauth_consents_client_id_fkey';
            columns: ['client_id'];
            isOneToOne: false;
            referencedRelation: 'oauth_clients';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'oauth_consents_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
        ];
      };
      one_time_tokens: {
        Row: {
          created_at: string;
          id: string;
          relates_to: string;
          token_hash: string;
          token_type: Database['auth']['Enums']['one_time_token_type'];
          updated_at: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          id: string;
          relates_to: string;
          token_hash: string;
          token_type: Database['auth']['Enums']['one_time_token_type'];
          updated_at?: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          relates_to?: string;
          token_hash?: string;
          token_type?: Database['auth']['Enums']['one_time_token_type'];
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'one_time_tokens_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
        ];
      };
      refresh_tokens: {
        Row: {
          created_at: string | null;
          id: number;
          instance_id: string | null;
          parent: string | null;
          revoked: boolean | null;
          session_id: string | null;
          token: string | null;
          updated_at: string | null;
          user_id: string | null;
        };
        Insert: {
          created_at?: string | null;
          id?: number;
          instance_id?: string | null;
          parent?: string | null;
          revoked?: boolean | null;
          session_id?: string | null;
          token?: string | null;
          updated_at?: string | null;
          user_id?: string | null;
        };
        Update: {
          created_at?: string | null;
          id?: number;
          instance_id?: string | null;
          parent?: string | null;
          revoked?: boolean | null;
          session_id?: string | null;
          token?: string | null;
          updated_at?: string | null;
          user_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'refresh_tokens_session_id_fkey';
            columns: ['session_id'];
            isOneToOne: false;
            referencedRelation: 'sessions';
            referencedColumns: ['id'];
          },
        ];
      };
      saml_providers: {
        Row: {
          attribute_mapping: Json | null;
          created_at: string | null;
          entity_id: string;
          id: string;
          metadata_url: string | null;
          metadata_xml: string;
          name_id_format: string | null;
          sso_provider_id: string;
          updated_at: string | null;
        };
        Insert: {
          attribute_mapping?: Json | null;
          created_at?: string | null;
          entity_id: string;
          id: string;
          metadata_url?: string | null;
          metadata_xml: string;
          name_id_format?: string | null;
          sso_provider_id: string;
          updated_at?: string | null;
        };
        Update: {
          attribute_mapping?: Json | null;
          created_at?: string | null;
          entity_id?: string;
          id?: string;
          metadata_url?: string | null;
          metadata_xml?: string;
          name_id_format?: string | null;
          sso_provider_id?: string;
          updated_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'saml_providers_sso_provider_id_fkey';
            columns: ['sso_provider_id'];
            isOneToOne: false;
            referencedRelation: 'sso_providers';
            referencedColumns: ['id'];
          },
        ];
      };
      saml_relay_states: {
        Row: {
          created_at: string | null;
          flow_state_id: string | null;
          for_email: string | null;
          id: string;
          redirect_to: string | null;
          request_id: string;
          sso_provider_id: string;
          updated_at: string | null;
        };
        Insert: {
          created_at?: string | null;
          flow_state_id?: string | null;
          for_email?: string | null;
          id: string;
          redirect_to?: string | null;
          request_id: string;
          sso_provider_id: string;
          updated_at?: string | null;
        };
        Update: {
          created_at?: string | null;
          flow_state_id?: string | null;
          for_email?: string | null;
          id?: string;
          redirect_to?: string | null;
          request_id?: string;
          sso_provider_id?: string;
          updated_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'saml_relay_states_flow_state_id_fkey';
            columns: ['flow_state_id'];
            isOneToOne: false;
            referencedRelation: 'flow_state';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'saml_relay_states_sso_provider_id_fkey';
            columns: ['sso_provider_id'];
            isOneToOne: false;
            referencedRelation: 'sso_providers';
            referencedColumns: ['id'];
          },
        ];
      };
      schema_migrations: {
        Row: {
          version: string;
        };
        Insert: {
          version: string;
        };
        Update: {
          version?: string;
        };
        Relationships: [];
      };
      sessions: {
        Row: {
          aal: Database['auth']['Enums']['aal_level'] | null;
          created_at: string | null;
          factor_id: string | null;
          id: string;
          ip: unknown;
          not_after: string | null;
          oauth_client_id: string | null;
          refresh_token_counter: number | null;
          refresh_token_hmac_key: string | null;
          refreshed_at: string | null;
          scopes: string | null;
          tag: string | null;
          updated_at: string | null;
          user_agent: string | null;
          user_id: string;
        };
        Insert: {
          aal?: Database['auth']['Enums']['aal_level'] | null;
          created_at?: string | null;
          factor_id?: string | null;
          id: string;
          ip?: unknown;
          not_after?: string | null;
          oauth_client_id?: string | null;
          refresh_token_counter?: number | null;
          refresh_token_hmac_key?: string | null;
          refreshed_at?: string | null;
          scopes?: string | null;
          tag?: string | null;
          updated_at?: string | null;
          user_agent?: string | null;
          user_id: string;
        };
        Update: {
          aal?: Database['auth']['Enums']['aal_level'] | null;
          created_at?: string | null;
          factor_id?: string | null;
          id?: string;
          ip?: unknown;
          not_after?: string | null;
          oauth_client_id?: string | null;
          refresh_token_counter?: number | null;
          refresh_token_hmac_key?: string | null;
          refreshed_at?: string | null;
          scopes?: string | null;
          tag?: string | null;
          updated_at?: string | null;
          user_agent?: string | null;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'sessions_oauth_client_id_fkey';
            columns: ['oauth_client_id'];
            isOneToOne: false;
            referencedRelation: 'oauth_clients';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'sessions_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
        ];
      };
      sso_domains: {
        Row: {
          created_at: string | null;
          domain: string;
          id: string;
          sso_provider_id: string;
          updated_at: string | null;
        };
        Insert: {
          created_at?: string | null;
          domain: string;
          id: string;
          sso_provider_id: string;
          updated_at?: string | null;
        };
        Update: {
          created_at?: string | null;
          domain?: string;
          id?: string;
          sso_provider_id?: string;
          updated_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'sso_domains_sso_provider_id_fkey';
            columns: ['sso_provider_id'];
            isOneToOne: false;
            referencedRelation: 'sso_providers';
            referencedColumns: ['id'];
          },
        ];
      };
      sso_providers: {
        Row: {
          created_at: string | null;
          disabled: boolean | null;
          id: string;
          resource_id: string | null;
          updated_at: string | null;
        };
        Insert: {
          created_at?: string | null;
          disabled?: boolean | null;
          id: string;
          resource_id?: string | null;
          updated_at?: string | null;
        };
        Update: {
          created_at?: string | null;
          disabled?: boolean | null;
          id?: string;
          resource_id?: string | null;
          updated_at?: string | null;
        };
        Relationships: [];
      };
      users: {
        Row: {
          aud: string | null;
          banned_until: string | null;
          confirmation_sent_at: string | null;
          confirmation_token: string | null;
          confirmed_at: string | null;
          created_at: string | null;
          deleted_at: string | null;
          email: string | null;
          email_change: string | null;
          email_change_confirm_status: number | null;
          email_change_sent_at: string | null;
          email_change_token_current: string | null;
          email_change_token_new: string | null;
          email_confirmed_at: string | null;
          encrypted_password: string | null;
          id: string;
          instance_id: string | null;
          invited_at: string | null;
          is_anonymous: boolean;
          is_sso_user: boolean;
          is_super_admin: boolean | null;
          last_sign_in_at: string | null;
          phone: string | null;
          phone_change: string | null;
          phone_change_sent_at: string | null;
          phone_change_token: string | null;
          phone_confirmed_at: string | null;
          raw_app_meta_data: Json | null;
          raw_user_meta_data: Json | null;
          reauthentication_sent_at: string | null;
          reauthentication_token: string | null;
          recovery_sent_at: string | null;
          recovery_token: string | null;
          role: string | null;
          updated_at: string | null;
        };
        Insert: {
          aud?: string | null;
          banned_until?: string | null;
          confirmation_sent_at?: string | null;
          confirmation_token?: string | null;
          confirmed_at?: string | null;
          created_at?: string | null;
          deleted_at?: string | null;
          email?: string | null;
          email_change?: string | null;
          email_change_confirm_status?: number | null;
          email_change_sent_at?: string | null;
          email_change_token_current?: string | null;
          email_change_token_new?: string | null;
          email_confirmed_at?: string | null;
          encrypted_password?: string | null;
          id: string;
          instance_id?: string | null;
          invited_at?: string | null;
          is_anonymous?: boolean;
          is_sso_user?: boolean;
          is_super_admin?: boolean | null;
          last_sign_in_at?: string | null;
          phone?: string | null;
          phone_change?: string | null;
          phone_change_sent_at?: string | null;
          phone_change_token?: string | null;
          phone_confirmed_at?: string | null;
          raw_app_meta_data?: Json | null;
          raw_user_meta_data?: Json | null;
          reauthentication_sent_at?: string | null;
          reauthentication_token?: string | null;
          recovery_sent_at?: string | null;
          recovery_token?: string | null;
          role?: string | null;
          updated_at?: string | null;
        };
        Update: {
          aud?: string | null;
          banned_until?: string | null;
          confirmation_sent_at?: string | null;
          confirmation_token?: string | null;
          confirmed_at?: string | null;
          created_at?: string | null;
          deleted_at?: string | null;
          email?: string | null;
          email_change?: string | null;
          email_change_confirm_status?: number | null;
          email_change_sent_at?: string | null;
          email_change_token_current?: string | null;
          email_change_token_new?: string | null;
          email_confirmed_at?: string | null;
          encrypted_password?: string | null;
          id?: string;
          instance_id?: string | null;
          invited_at?: string | null;
          is_anonymous?: boolean;
          is_sso_user?: boolean;
          is_super_admin?: boolean | null;
          last_sign_in_at?: string | null;
          phone?: string | null;
          phone_change?: string | null;
          phone_change_sent_at?: string | null;
          phone_change_token?: string | null;
          phone_confirmed_at?: string | null;
          raw_app_meta_data?: Json | null;
          raw_user_meta_data?: Json | null;
          reauthentication_sent_at?: string | null;
          reauthentication_token?: string | null;
          recovery_sent_at?: string | null;
          recovery_token?: string | null;
          role?: string | null;
          updated_at?: string | null;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      email: { Args: never; Returns: string };
      jwt: { Args: never; Returns: Json };
      role: { Args: never; Returns: string };
      uid: { Args: never; Returns: string };
    };
    Enums: {
      aal_level: 'aal1' | 'aal2' | 'aal3';
      code_challenge_method: 's256' | 'plain';
      factor_status: 'unverified' | 'verified';
      factor_type: 'totp' | 'webauthn' | 'phone';
      oauth_authorization_status: 'pending' | 'approved' | 'denied' | 'expired';
      oauth_client_type: 'public' | 'confidential';
      oauth_registration_type: 'dynamic' | 'manual';
      oauth_response_type: 'code';
      one_time_token_type:
        | 'confirmation_token'
        | 'reauthentication_token'
        | 'recovery_token'
        | 'email_change_token_new'
        | 'email_change_token_current'
        | 'phone_change_token';
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
  public: {
    Tables: {
      _migrations: {
        Row: {
          id: number;
          name: string;
          status: string | null;
          timestamp: string | null;
        };
        Insert: {
          id?: number;
          name: string;
          status?: string | null;
          timestamp?: string | null;
        };
        Update: {
          id?: number;
          name?: string;
          status?: string | null;
          timestamp?: string | null;
        };
        Relationships: [];
      };
      allocations: {
        Row: {
          booking_id: string | null;
          created_at: string;
          created_by: string | null;
          id: string;
          is_maintenance: boolean;
          resource_id: string;
          resource_type: string;
          restaurant_id: string;
          shadow: boolean;
          updated_at: string;
          window: unknown;
        };
        Insert: {
          booking_id?: string | null;
          created_at?: string;
          created_by?: string | null;
          id?: string;
          is_maintenance?: boolean;
          resource_id: string;
          resource_type: string;
          restaurant_id: string;
          shadow?: boolean;
          updated_at?: string;
          window: unknown;
        };
        Update: {
          booking_id?: string | null;
          created_at?: string;
          created_by?: string | null;
          id?: string;
          is_maintenance?: boolean;
          resource_id?: string;
          resource_type?: string;
          restaurant_id?: string;
          shadow?: boolean;
          updated_at?: string;
          window?: unknown;
        };
        Relationships: [
          {
            foreignKeyName: 'allocations_booking_id_fkey';
            columns: ['booking_id'];
            isOneToOne: false;
            referencedRelation: 'bookings';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'allocations_restaurant_id_fkey';
            columns: ['restaurant_id'];
            isOneToOne: false;
            referencedRelation: 'restaurants';
            referencedColumns: ['id'];
          },
        ];
      };
      allocations_archive: {
        Row: {
          archived_at: string;
          booking_id: string | null;
          created_at: string;
          created_by: string | null;
          id: string;
          is_maintenance: boolean;
          resource_id: string;
          resource_type: string;
          restaurant_id: string;
          shadow: boolean;
          updated_at: string;
          window: unknown;
        };
        Insert: {
          archived_at?: string;
          booking_id?: string | null;
          created_at: string;
          created_by?: string | null;
          id: string;
          is_maintenance?: boolean;
          resource_id: string;
          resource_type: string;
          restaurant_id: string;
          shadow?: boolean;
          updated_at: string;
          window: unknown;
        };
        Update: {
          archived_at?: string;
          booking_id?: string | null;
          created_at?: string;
          created_by?: string | null;
          id?: string;
          is_maintenance?: boolean;
          resource_id?: string;
          resource_type?: string;
          restaurant_id?: string;
          shadow?: boolean;
          updated_at?: string;
          window?: unknown;
        };
        Relationships: [];
      };
      allowed_capacities: {
        Row: {
          capacity: number;
          created_at: string;
          restaurant_id: string;
          updated_at: string;
        };
        Insert: {
          capacity: number;
          created_at?: string;
          restaurant_id: string;
          updated_at?: string;
        };
        Update: {
          capacity?: number;
          created_at?: string;
          restaurant_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'allowed_capacities_restaurant_id_fkey';
            columns: ['restaurant_id'];
            isOneToOne: false;
            referencedRelation: 'restaurants';
            referencedColumns: ['id'];
          },
        ];
      };
      analytics_events: {
        Row: {
          booking_id: string;
          created_at: string;
          customer_id: string | null;
          emitted_by: string;
          event_type: Database['public']['Enums']['analytics_event_type'];
          id: string;
          occurred_at: string;
          payload: Json;
          restaurant_id: string;
          schema_version: string;
        };
        Insert: {
          booking_id: string;
          created_at?: string;
          customer_id?: string | null;
          emitted_by?: string;
          event_type: Database['public']['Enums']['analytics_event_type'];
          id?: string;
          occurred_at: string;
          payload: Json;
          restaurant_id: string;
          schema_version: string;
        };
        Update: {
          booking_id?: string;
          created_at?: string;
          customer_id?: string | null;
          emitted_by?: string;
          event_type?: Database['public']['Enums']['analytics_event_type'];
          id?: string;
          occurred_at?: string;
          payload?: Json;
          restaurant_id?: string;
          schema_version?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'analytics_events_booking_id_fkey';
            columns: ['booking_id'];
            isOneToOne: false;
            referencedRelation: 'bookings';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'analytics_events_customer_id_fkey';
            columns: ['customer_id'];
            isOneToOne: false;
            referencedRelation: 'customers';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'analytics_events_restaurant_id_fkey';
            columns: ['restaurant_id'];
            isOneToOne: false;
            referencedRelation: 'restaurants';
            referencedColumns: ['id'];
          },
        ];
      };
      audit_logs: {
        Row: {
          action: string;
          actor: string | null;
          created_at: string;
          entity: string;
          entity_id: string;
          id: string;
          metadata: Json | null;
        };
        Insert: {
          action: string;
          actor?: string | null;
          created_at?: string;
          entity: string;
          entity_id: string;
          id?: string;
          metadata?: Json | null;
        };
        Update: {
          action?: string;
          actor?: string | null;
          created_at?: string;
          entity?: string;
          entity_id?: string;
          id?: string;
          metadata?: Json | null;
        };
        Relationships: [];
      };
      booking_assignment_attempts: {
        Row: {
          attempt_no: number;
          booking_id: string;
          created_at: string;
          id: string;
          metadata: Json;
          reason: string | null;
          result: string;
          strategy: string;
        };
        Insert: {
          attempt_no: number;
          booking_id: string;
          created_at?: string;
          id?: string;
          metadata?: Json;
          reason?: string | null;
          result: string;
          strategy: string;
        };
        Update: {
          attempt_no?: number;
          booking_id?: string;
          created_at?: string;
          id?: string;
          metadata?: Json;
          reason?: string | null;
          result?: string;
          strategy?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'booking_assignment_attempts_booking_id_fkey';
            columns: ['booking_id'];
            isOneToOne: false;
            referencedRelation: 'bookings';
            referencedColumns: ['id'];
          },
        ];
      };
      booking_assignment_idempotency: {
        Row: {
          assignment_window: unknown;
          booking_id: string;
          created_at: string;
          expires_at: string | null;
          idempotency_key: string;
          merge_group_allocation_id: string | null;
          payload_checksum: string;
          table_ids: string[];
          table_set_hash: string | null;
        };
        Insert: {
          assignment_window: unknown;
          booking_id: string;
          created_at?: string;
          expires_at?: string | null;
          idempotency_key: string;
          merge_group_allocation_id?: string | null;
          payload_checksum?: string;
          table_ids?: string[];
          table_set_hash?: string | null;
        };
        Update: {
          assignment_window?: unknown;
          booking_id?: string;
          created_at?: string;
          expires_at?: string | null;
          idempotency_key?: string;
          merge_group_allocation_id?: string | null;
          payload_checksum?: string;
          table_ids?: string[];
          table_set_hash?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'booking_assignment_idempotency_booking_id_fkey';
            columns: ['booking_id'];
            isOneToOne: false;
            referencedRelation: 'bookings';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'booking_assignment_idempotency_merge_group_fkey';
            columns: ['merge_group_allocation_id'];
            isOneToOne: false;
            referencedRelation: 'allocations';
            referencedColumns: ['id'];
          },
        ];
      };
      booking_confirmation_results: {
        Row: {
          actor_id: string | null;
          assignment_window: unknown;
          booking_id: string;
          created_at: string;
          hold_id: string;
          idempotency_key: string;
          metadata: Json;
          restaurant_id: string;
          table_ids: string[];
        };
        Insert: {
          actor_id?: string | null;
          assignment_window: unknown;
          booking_id: string;
          created_at?: string;
          hold_id: string;
          idempotency_key: string;
          metadata?: Json;
          restaurant_id: string;
          table_ids: string[];
        };
        Update: {
          actor_id?: string | null;
          assignment_window?: unknown;
          booking_id?: string;
          created_at?: string;
          hold_id?: string;
          idempotency_key?: string;
          metadata?: Json;
          restaurant_id?: string;
          table_ids?: string[];
        };
        Relationships: [
          {
            foreignKeyName: 'booking_confirmation_results_booking_id_fkey';
            columns: ['booking_id'];
            isOneToOne: false;
            referencedRelation: 'bookings';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'booking_confirmation_results_restaurant_id_fkey';
            columns: ['restaurant_id'];
            isOneToOne: false;
            referencedRelation: 'restaurants';
            referencedColumns: ['id'];
          },
        ];
      };
      booking_occasions: {
        Row: {
          availability: Json;
          created_at: string;
          created_by: string | null;
          default_duration_minutes: number;
          deleted_at: string | null;
          description: string | null;
          display_order: number;
          is_active: boolean;
          is_builtin: boolean;
          key: string;
          label: string;
          short_label: string;
          updated_at: string;
          updated_by: string | null;
        };
        Insert: {
          availability?: Json;
          created_at?: string;
          created_by?: string | null;
          default_duration_minutes?: number;
          deleted_at?: string | null;
          description?: string | null;
          display_order?: number;
          is_active?: boolean;
          is_builtin?: boolean;
          key: string;
          label: string;
          short_label: string;
          updated_at?: string;
          updated_by?: string | null;
        };
        Update: {
          availability?: Json;
          created_at?: string;
          created_by?: string | null;
          default_duration_minutes?: number;
          deleted_at?: string | null;
          description?: string | null;
          display_order?: number;
          is_active?: boolean;
          is_builtin?: boolean;
          key?: string;
          label?: string;
          short_label?: string;
          updated_at?: string;
          updated_by?: string | null;
        };
        Relationships: [];
      };
      booking_occasions_audit: {
        Row: {
          action: string;
          after_change: Json | null;
          before_change: Json | null;
          changed_at: string;
          changed_by: string | null;
          id: string;
          occasion_key: string;
        };
        Insert: {
          action: string;
          after_change?: Json | null;
          before_change?: Json | null;
          changed_at?: string;
          changed_by?: string | null;
          id?: string;
          occasion_key: string;
        };
        Update: {
          action?: string;
          after_change?: Json | null;
          before_change?: Json | null;
          changed_at?: string;
          changed_by?: string | null;
          id?: string;
          occasion_key?: string;
        };
        Relationships: [];
      };
      booking_slots: {
        Row: {
          available_capacity: number;
          created_at: string;
          id: string;
          reserved_count: number;
          restaurant_id: string;
          service_period_id: string | null;
          slot_date: string;
          slot_time: string;
          updated_at: string;
          version: number;
        };
        Insert: {
          available_capacity?: number;
          created_at?: string;
          id?: string;
          reserved_count?: number;
          restaurant_id: string;
          service_period_id?: string | null;
          slot_date: string;
          slot_time: string;
          updated_at?: string;
          version?: number;
        };
        Update: {
          available_capacity?: number;
          created_at?: string;
          id?: string;
          reserved_count?: number;
          restaurant_id?: string;
          service_period_id?: string | null;
          slot_date?: string;
          slot_time?: string;
          updated_at?: string;
          version?: number;
        };
        Relationships: [
          {
            foreignKeyName: 'booking_slots_restaurant_id_fkey';
            columns: ['restaurant_id'];
            isOneToOne: false;
            referencedRelation: 'restaurants';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'booking_slots_service_period_id_fkey';
            columns: ['service_period_id'];
            isOneToOne: false;
            referencedRelation: 'restaurant_service_periods';
            referencedColumns: ['id'];
          },
        ];
      };
      booking_state_history: {
        Row: {
          booking_id: string;
          changed_at: string;
          changed_by: string | null;
          from_status: Database['public']['Enums']['booking_status'] | null;
          id: number;
          metadata: Json;
          reason: string | null;
          to_status: Database['public']['Enums']['booking_status'];
        };
        Insert: {
          booking_id: string;
          changed_at?: string;
          changed_by?: string | null;
          from_status?: Database['public']['Enums']['booking_status'] | null;
          id?: number;
          metadata?: Json;
          reason?: string | null;
          to_status: Database['public']['Enums']['booking_status'];
        };
        Update: {
          booking_id?: string;
          changed_at?: string;
          changed_by?: string | null;
          from_status?: Database['public']['Enums']['booking_status'] | null;
          id?: number;
          metadata?: Json;
          reason?: string | null;
          to_status?: Database['public']['Enums']['booking_status'];
        };
        Relationships: [
          {
            foreignKeyName: 'booking_state_history_booking_id_fkey';
            columns: ['booking_id'];
            isOneToOne: false;
            referencedRelation: 'bookings';
            referencedColumns: ['id'];
          },
        ];
      };
      booking_table_assignments: {
        Row: {
          allocation_id: string | null;
          assigned_at: string;
          assigned_by: string | null;
          assignment_window: unknown;
          booking_id: string;
          created_at: string;
          end_at: string | null;
          id: string;
          idempotency_key: string | null;
          merge_group_id: string | null;
          notes: string | null;
          slot_id: string | null;
          start_at: string | null;
          table_id: string;
          updated_at: string;
        };
        Insert: {
          allocation_id?: string | null;
          assigned_at?: string;
          assigned_by?: string | null;
          assignment_window?: unknown;
          booking_id: string;
          created_at?: string;
          end_at?: string | null;
          id?: string;
          idempotency_key?: string | null;
          merge_group_id?: string | null;
          notes?: string | null;
          slot_id?: string | null;
          start_at?: string | null;
          table_id: string;
          updated_at?: string;
        };
        Update: {
          allocation_id?: string | null;
          assigned_at?: string;
          assigned_by?: string | null;
          assignment_window?: unknown;
          booking_id?: string;
          created_at?: string;
          end_at?: string | null;
          id?: string;
          idempotency_key?: string | null;
          merge_group_id?: string | null;
          notes?: string | null;
          slot_id?: string | null;
          start_at?: string | null;
          table_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'booking_table_assignments_allocation_id_fkey';
            columns: ['allocation_id'];
            isOneToOne: false;
            referencedRelation: 'allocations';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'booking_table_assignments_booking_id_fkey';
            columns: ['booking_id'];
            isOneToOne: false;
            referencedRelation: 'bookings';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'booking_table_assignments_merge_group_id_fkey';
            columns: ['merge_group_id'];
            isOneToOne: false;
            referencedRelation: 'allocations';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'booking_table_assignments_slot_id_fkey';
            columns: ['slot_id'];
            isOneToOne: false;
            referencedRelation: 'booking_slots';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'booking_table_assignments_table_id_fkey';
            columns: ['table_id'];
            isOneToOne: false;
            referencedRelation: 'table_inventory';
            referencedColumns: ['id'];
          },
        ];
      };
      booking_versions: {
        Row: {
          booking_id: string;
          change_type: Database['public']['Enums']['booking_change_type'];
          changed_at: string;
          changed_by: string | null;
          created_at: string;
          new_data: Json | null;
          old_data: Json | null;
          restaurant_id: string;
          version_id: string;
        };
        Insert: {
          booking_id: string;
          change_type: Database['public']['Enums']['booking_change_type'];
          changed_at?: string;
          changed_by?: string | null;
          created_at?: string;
          new_data?: Json | null;
          old_data?: Json | null;
          restaurant_id: string;
          version_id?: string;
        };
        Update: {
          booking_id?: string;
          change_type?: Database['public']['Enums']['booking_change_type'];
          changed_at?: string;
          changed_by?: string | null;
          created_at?: string;
          new_data?: Json | null;
          old_data?: Json | null;
          restaurant_id?: string;
          version_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'booking_versions_booking_id_fkey';
            columns: ['booking_id'];
            isOneToOne: false;
            referencedRelation: 'bookings';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'booking_versions_restaurant_id_fkey';
            columns: ['restaurant_id'];
            isOneToOne: false;
            referencedRelation: 'restaurants';
            referencedColumns: ['id'];
          },
        ];
      };
      bookings: {
        Row: {
          assigned_zone_id: string | null;
          assignment_state_version: number;
          assignment_strategy: string | null;
          auth_user_id: string | null;
          auto_assign_idempotency_key: string | null;
          auto_assign_last_result: Json | null;
          booking_date: string;
          booking_type: string;
          checked_in_at: string | null;
          checked_out_at: string | null;
          client_request_id: string;
          confirmation_token: string | null;
          confirmation_token_expires_at: string | null;
          confirmation_token_used_at: string | null;
          created_at: string;
          customer_email: string;
          customer_id: string;
          customer_name: string;
          customer_phone: string;
          details: Json | null;
          end_at: string | null;
          end_time: string;
          id: string;
          idempotency_key: string | null;
          loyalty_points_awarded: number;
          marketing_opt_in: boolean;
          notes: string | null;
          party_size: number;
          pending_ref: string | null;
          reference: string;
          restaurant_id: string;
          seating_preference: Database['public']['Enums']['seating_preference_type'];
          source: string;
          start_at: string | null;
          start_time: string;
          status: Database['public']['Enums']['booking_status'];
          updated_at: string;
          whatsapp_consent_actor_id: string | null;
          whatsapp_consent_phone: string | null;
          whatsapp_consent_source: string | null;
          whatsapp_consent_version: string | null;
          whatsapp_opt_in: boolean;
          whatsapp_opt_in_at: string | null;
        };
        Insert: {
          assigned_zone_id?: string | null;
          assignment_state_version?: number;
          assignment_strategy?: string | null;
          auth_user_id?: string | null;
          auto_assign_idempotency_key?: string | null;
          auto_assign_last_result?: Json | null;
          booking_date: string;
          booking_type?: string;
          checked_in_at?: string | null;
          checked_out_at?: string | null;
          client_request_id?: string;
          confirmation_token?: string | null;
          confirmation_token_expires_at?: string | null;
          confirmation_token_used_at?: string | null;
          created_at?: string;
          customer_email: string;
          customer_id: string;
          customer_name: string;
          customer_phone: string;
          details?: Json | null;
          end_at?: string | null;
          end_time: string;
          id?: string;
          idempotency_key?: string | null;
          loyalty_points_awarded?: number;
          marketing_opt_in?: boolean;
          notes?: string | null;
          party_size: number;
          pending_ref?: string | null;
          reference: string;
          restaurant_id: string;
          seating_preference?: Database['public']['Enums']['seating_preference_type'];
          source?: string;
          start_at?: string | null;
          start_time: string;
          status?: Database['public']['Enums']['booking_status'];
          updated_at?: string;
          whatsapp_consent_actor_id?: string | null;
          whatsapp_consent_phone?: string | null;
          whatsapp_consent_source?: string | null;
          whatsapp_consent_version?: string | null;
          whatsapp_opt_in?: boolean;
          whatsapp_opt_in_at?: string | null;
        };
        Update: {
          assigned_zone_id?: string | null;
          assignment_state_version?: number;
          assignment_strategy?: string | null;
          auth_user_id?: string | null;
          auto_assign_idempotency_key?: string | null;
          auto_assign_last_result?: Json | null;
          booking_date?: string;
          booking_type?: string;
          checked_in_at?: string | null;
          checked_out_at?: string | null;
          client_request_id?: string;
          confirmation_token?: string | null;
          confirmation_token_expires_at?: string | null;
          confirmation_token_used_at?: string | null;
          created_at?: string;
          customer_email?: string;
          customer_id?: string;
          customer_name?: string;
          customer_phone?: string;
          details?: Json | null;
          end_at?: string | null;
          end_time?: string;
          id?: string;
          idempotency_key?: string | null;
          loyalty_points_awarded?: number;
          marketing_opt_in?: boolean;
          notes?: string | null;
          party_size?: number;
          pending_ref?: string | null;
          reference?: string;
          restaurant_id?: string;
          seating_preference?: Database['public']['Enums']['seating_preference_type'];
          source?: string;
          start_at?: string | null;
          start_time?: string;
          status?: Database['public']['Enums']['booking_status'];
          updated_at?: string;
          whatsapp_consent_actor_id?: string | null;
          whatsapp_consent_phone?: string | null;
          whatsapp_consent_source?: string | null;
          whatsapp_consent_version?: string | null;
          whatsapp_opt_in?: boolean;
          whatsapp_opt_in_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'bookings_assigned_zone_id_fkey';
            columns: ['assigned_zone_id'];
            isOneToOne: false;
            referencedRelation: 'zones';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'bookings_booking_type_fkey';
            columns: ['booking_type'];
            isOneToOne: false;
            referencedRelation: 'booking_occasions';
            referencedColumns: ['key'];
          },
          {
            foreignKeyName: 'bookings_customer_id_fkey';
            columns: ['customer_id'];
            isOneToOne: false;
            referencedRelation: 'customers';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'bookings_restaurant_id_fkey';
            columns: ['restaurant_id'];
            isOneToOne: false;
            referencedRelation: 'restaurants';
            referencedColumns: ['id'];
          },
        ];
      };
      capacity_outbox: {
        Row: {
          attempt_count: number;
          booking_id: string | null;
          created_at: string;
          dedupe_key: string | null;
          event_type: string;
          id: string;
          idempotency_key: string | null;
          next_attempt_at: string | null;
          payload: Json;
          restaurant_id: string | null;
          status: string;
          updated_at: string;
        };
        Insert: {
          attempt_count?: number;
          booking_id?: string | null;
          created_at?: string;
          dedupe_key?: string | null;
          event_type: string;
          id?: string;
          idempotency_key?: string | null;
          next_attempt_at?: string | null;
          payload?: Json;
          restaurant_id?: string | null;
          status?: string;
          updated_at?: string;
        };
        Update: {
          attempt_count?: number;
          booking_id?: string | null;
          created_at?: string;
          dedupe_key?: string | null;
          event_type?: string;
          id?: string;
          idempotency_key?: string | null;
          next_attempt_at?: string | null;
          payload?: Json;
          restaurant_id?: string | null;
          status?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      customer_profiles: {
        Row: {
          customer_id: string;
          first_booking_at: string | null;
          last_booking_at: string | null;
          last_marketing_opt_in_at: string | null;
          marketing_opt_in: boolean;
          notes: string | null;
          preferences: Json;
          total_bookings: number;
          total_cancellations: number;
          total_covers: number;
          updated_at: string;
        };
        Insert: {
          customer_id: string;
          first_booking_at?: string | null;
          last_booking_at?: string | null;
          last_marketing_opt_in_at?: string | null;
          marketing_opt_in?: boolean;
          notes?: string | null;
          preferences?: Json;
          total_bookings?: number;
          total_cancellations?: number;
          total_covers?: number;
          updated_at?: string;
        };
        Update: {
          customer_id?: string;
          first_booking_at?: string | null;
          last_booking_at?: string | null;
          last_marketing_opt_in_at?: string | null;
          marketing_opt_in?: boolean;
          notes?: string | null;
          preferences?: Json;
          total_bookings?: number;
          total_cancellations?: number;
          total_covers?: number;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'customer_profiles_customer_id_fkey';
            columns: ['customer_id'];
            isOneToOne: true;
            referencedRelation: 'customers';
            referencedColumns: ['id'];
          },
        ];
      };
      customers: {
        Row: {
          auth_user_id: string | null;
          created_at: string;
          email: string;
          email_normalized: string | null;
          full_name: string;
          id: string;
          marketing_opt_in: boolean;
          notes: string | null;
          phone: string;
          phone_normalized: string | null;
          restaurant_id: string;
          updated_at: string;
          user_profile_id: string | null;
        };
        Insert: {
          auth_user_id?: string | null;
          created_at?: string;
          email: string;
          email_normalized?: string | null;
          full_name: string;
          id?: string;
          marketing_opt_in?: boolean;
          notes?: string | null;
          phone: string;
          phone_normalized?: string | null;
          restaurant_id: string;
          updated_at?: string;
          user_profile_id?: string | null;
        };
        Update: {
          auth_user_id?: string | null;
          created_at?: string;
          email?: string;
          email_normalized?: string | null;
          full_name?: string;
          id?: string;
          marketing_opt_in?: boolean;
          notes?: string | null;
          phone?: string;
          phone_normalized?: string | null;
          restaurant_id?: string;
          updated_at?: string;
          user_profile_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'customers_restaurant_id_fkey';
            columns: ['restaurant_id'];
            isOneToOne: false;
            referencedRelation: 'restaurants';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'customers_user_profile_id_fkey';
            columns: ['user_profile_id'];
            isOneToOne: false;
            referencedRelation: 'user_profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      demand_profiles: {
        Row: {
          created_at: string;
          day_of_week: number;
          end_minute: number | null;
          id: string;
          multiplier: number;
          priority: number | null;
          restaurant_id: string;
          service_window: string;
          start_minute: number | null;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          day_of_week: number;
          end_minute?: number | null;
          id?: string;
          multiplier?: number;
          priority?: number | null;
          restaurant_id: string;
          service_window: string;
          start_minute?: number | null;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          day_of_week?: number;
          end_minute?: number | null;
          id?: string;
          multiplier?: number;
          priority?: number | null;
          restaurant_id?: string;
          service_window?: string;
          start_minute?: number | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'demand_profiles_restaurant_id_fkey';
            columns: ['restaurant_id'];
            isOneToOne: false;
            referencedRelation: 'restaurants';
            referencedColumns: ['id'];
          },
        ];
      };
      email_delivery_log: {
        Row: {
          booking_id: string | null;
          created_at: string;
          email_type: string | null;
          error: string | null;
          id: string;
          message_id: string;
          metadata: Json | null;
          occurred_at: string;
          provider: string | null;
          provider_event_id: string | null;
          recipient_email: string;
          restaurant_id: string | null;
          review_request_id: string | null;
          status: string;
          template_type: string | null;
        };
        Insert: {
          booking_id?: string | null;
          created_at?: string;
          email_type?: string | null;
          error?: string | null;
          id?: string;
          message_id: string;
          metadata?: Json | null;
          occurred_at?: string;
          provider?: string | null;
          provider_event_id?: string | null;
          recipient_email: string;
          restaurant_id?: string | null;
          review_request_id?: string | null;
          status: string;
          template_type?: string | null;
        };
        Update: {
          booking_id?: string | null;
          created_at?: string;
          email_type?: string | null;
          error?: string | null;
          id?: string;
          message_id?: string;
          metadata?: Json | null;
          occurred_at?: string;
          provider?: string | null;
          provider_event_id?: string | null;
          recipient_email?: string;
          restaurant_id?: string | null;
          review_request_id?: string | null;
          status?: string;
          template_type?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'email_delivery_log_booking_id_fkey';
            columns: ['booking_id'];
            isOneToOne: false;
            referencedRelation: 'bookings';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'email_delivery_log_restaurant_id_fkey';
            columns: ['restaurant_id'];
            isOneToOne: false;
            referencedRelation: 'restaurants';
            referencedColumns: ['id'];
          },
        ];
      };
      mobile_notifications: {
        Row: {
          booking_id: string | null;
          created_at: string;
          id: string;
          logical_key: string;
          mobile_intent_attempt_error_code: string | null;
          mobile_intent_attempt_id: string | null;
          mobile_intent_attempt_status: string | null;
          mobile_intent_attempts: number;
          mobile_intent_claimed_at: string | null;
          mobile_intent_claim_token: string | null;
          mobile_intent_last_error: string | null;
          mobile_intent_processed_at: string | null;
          mobile_intent_provider_message_id: string | null;
          mobile_intent_scheduled_for: string | null;
          mobile_intent_status: string | null;
          notification_type: string;
          recipient_phone: string;
          restaurant_id: string;
          review_request_id: string | null;
          updated_at: string;
        };
        Insert: {
          booking_id?: string | null;
          created_at?: string;
          id?: string;
          logical_key: string;
          mobile_intent_attempt_error_code?: string | null;
          mobile_intent_attempt_id?: string | null;
          mobile_intent_attempt_status?: string | null;
          mobile_intent_attempts?: number;
          mobile_intent_claimed_at?: string | null;
          mobile_intent_claim_token?: string | null;
          mobile_intent_last_error?: string | null;
          mobile_intent_processed_at?: string | null;
          mobile_intent_provider_message_id?: string | null;
          mobile_intent_scheduled_for?: string | null;
          mobile_intent_status?: string | null;
          notification_type: string;
          recipient_phone: string;
          restaurant_id: string;
          review_request_id?: string | null;
          updated_at?: string;
        };
        Update: {
          booking_id?: string | null;
          created_at?: string;
          id?: string;
          logical_key?: string;
          mobile_intent_attempt_error_code?: string | null;
          mobile_intent_attempt_id?: string | null;
          mobile_intent_attempt_status?: string | null;
          mobile_intent_attempts?: number;
          mobile_intent_claimed_at?: string | null;
          mobile_intent_claim_token?: string | null;
          mobile_intent_last_error?: string | null;
          mobile_intent_processed_at?: string | null;
          mobile_intent_provider_message_id?: string | null;
          mobile_intent_scheduled_for?: string | null;
          mobile_intent_status?: string | null;
          notification_type?: string;
          recipient_phone?: string;
          restaurant_id?: string;
          review_request_id?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'mobile_notifications_booking_id_fkey';
            columns: ['booking_id'];
            isOneToOne: false;
            referencedRelation: 'bookings';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'mobile_notifications_restaurant_id_fkey';
            columns: ['restaurant_id'];
            isOneToOne: false;
            referencedRelation: 'restaurants';
            referencedColumns: ['id'];
          },
        ];
      };
      mobile_notification_attempts: {
        Row: {
          channel: string;
          error_code: string | null;
          fallback_for_attempt_id: string | null;
          id: string;
          metadata: Json;
          notification_id: string;
          occurred_at: string;
          provider: string;
          provider_message_id: string | null;
          recipient_phone: string;
          status: string;
          template_id: string | null;
          updated_at: string;
        };
        Insert: {
          channel: string;
          error_code?: string | null;
          fallback_for_attempt_id?: string | null;
          id?: string;
          metadata?: Json;
          notification_id: string;
          occurred_at?: string;
          provider?: string;
          provider_message_id?: string | null;
          recipient_phone: string;
          status: string;
          template_id?: string | null;
          updated_at?: string;
        };
        Update: {
          channel?: string;
          error_code?: string | null;
          fallback_for_attempt_id?: string | null;
          id?: string;
          metadata?: Json;
          notification_id?: string;
          occurred_at?: string;
          provider?: string;
          provider_message_id?: string | null;
          recipient_phone?: string;
          status?: string;
          template_id?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'mobile_notification_attempts_fallback_for_attempt_id_fkey';
            columns: ['fallback_for_attempt_id'];
            isOneToOne: false;
            referencedRelation: 'mobile_notification_attempts';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'mobile_notification_attempts_notification_id_fkey';
            columns: ['notification_id'];
            isOneToOne: false;
            referencedRelation: 'mobile_notifications';
            referencedColumns: ['id'];
          },
        ];
      };
      sms_delivery_log: {
        Row: {
          booking_id: string | null;
          created_at: string;
          error: string | null;
          id: string;
          message_sid: string;
          metadata: Json | null;
          occurred_at: string;
          provider: string | null;
          provider_event_id: string | null;
          recipient_phone: string;
          restaurant_id: string | null;
          sms_type: string | null;
          status: string;
        };
        Insert: {
          booking_id?: string | null;
          created_at?: string;
          error?: string | null;
          id?: string;
          message_sid: string;
          metadata?: Json | null;
          occurred_at?: string;
          provider?: string | null;
          provider_event_id?: string | null;
          recipient_phone: string;
          restaurant_id?: string | null;
          sms_type?: string | null;
          status: string;
        };
        Update: {
          booking_id?: string | null;
          created_at?: string;
          error?: string | null;
          id?: string;
          message_sid?: string;
          metadata?: Json | null;
          occurred_at?: string;
          provider?: string | null;
          provider_event_id?: string | null;
          recipient_phone?: string;
          restaurant_id?: string | null;
          sms_type?: string | null;
          status?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'sms_delivery_log_booking_id_fkey';
            columns: ['booking_id'];
            isOneToOne: false;
            referencedRelation: 'bookings';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'sms_delivery_log_restaurant_id_fkey';
            columns: ['restaurant_id'];
            isOneToOne: false;
            referencedRelation: 'restaurants';
            referencedColumns: ['id'];
          },
        ];
      };
      email_dispatch_intents: {
        Row: {
          attempts_made: number;
          backoff_delay_ms: number;
          backoff_type: string;
          booking_id: string;
          cancelled_at: string | null;
          claimed_at: string | null;
          created_at: string;
          dedupe_key: string;
          email_type: string;
          id: string;
          last_attempt_at: string | null;
          last_error: string | null;
          max_attempts: number;
          payload: Json;
          processed_at: string | null;
          restaurant_id: string | null;
          review_request_id: string | null;
          scheduled_for: string;
          status: string;
          updated_at: string;
        };
        Insert: {
          attempts_made?: number;
          backoff_delay_ms?: number;
          backoff_type?: string;
          booking_id: string;
          cancelled_at?: string | null;
          claimed_at?: string | null;
          created_at?: string;
          dedupe_key: string;
          email_type: string;
          id?: string;
          last_attempt_at?: string | null;
          last_error?: string | null;
          max_attempts?: number;
          payload?: Json;
          processed_at?: string | null;
          restaurant_id?: string | null;
          review_request_id?: string | null;
          scheduled_for: string;
          status?: string;
          updated_at?: string;
        };
        Update: {
          attempts_made?: number;
          backoff_delay_ms?: number;
          backoff_type?: string;
          booking_id?: string;
          cancelled_at?: string | null;
          claimed_at?: string | null;
          created_at?: string;
          dedupe_key?: string;
          email_type?: string;
          id?: string;
          last_attempt_at?: string | null;
          last_error?: string | null;
          max_attempts?: number;
          payload?: Json;
          processed_at?: string | null;
          restaurant_id?: string | null;
          review_request_id?: string | null;
          scheduled_for?: string;
          status?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'email_dispatch_intents_booking_id_fkey';
            columns: ['booking_id'];
            isOneToOne: false;
            referencedRelation: 'bookings';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'email_dispatch_intents_restaurant_id_fkey';
            columns: ['restaurant_id'];
            isOneToOne: false;
            referencedRelation: 'restaurants';
            referencedColumns: ['id'];
          },
        ];
      };
      feature_flag_overrides: {
        Row: {
          environment: string;
          flag: string;
          id: string;
          notes: Json | null;
          updated_at: string;
          updated_by: string | null;
          value: boolean;
        };
        Insert: {
          environment: string;
          flag: string;
          id?: string;
          notes?: Json | null;
          updated_at?: string;
          updated_by?: string | null;
          value: boolean;
        };
        Update: {
          environment?: string;
          flag?: string;
          id?: string;
          notes?: Json | null;
          updated_at?: string;
          updated_by?: string | null;
          value?: boolean;
        };
        Relationships: [];
      };
      leads: {
        Row: {
          created_at: string;
          email: string;
          id: string;
        };
        Insert: {
          created_at?: string;
          email: string;
          id?: string;
        };
        Update: {
          created_at?: string;
          email?: string;
          id?: string;
        };
        Relationships: [];
      };
      manual_assignment_sessions: {
        Row: {
          adjacency_version: string | null;
          assignments_version: string | null;
          booking_id: string;
          context_version: string | null;
          created_at: string;
          created_by: string | null;
          expires_at: string | null;
          flags_version: string | null;
          hold_id: string | null;
          holds_version: string | null;
          id: string;
          policy_version: string | null;
          restaurant_id: string;
          selection: Json | null;
          selection_version: number;
          snapshot_hash: string | null;
          state: Database['public']['Enums']['manual_assignment_session_state'];
          table_version: string | null;
          updated_at: string;
          window_version: string | null;
        };
        Insert: {
          adjacency_version?: string | null;
          assignments_version?: string | null;
          booking_id: string;
          context_version?: string | null;
          created_at?: string;
          created_by?: string | null;
          expires_at?: string | null;
          flags_version?: string | null;
          hold_id?: string | null;
          holds_version?: string | null;
          id?: string;
          policy_version?: string | null;
          restaurant_id: string;
          selection?: Json | null;
          selection_version?: number;
          snapshot_hash?: string | null;
          state?: Database['public']['Enums']['manual_assignment_session_state'];
          table_version?: string | null;
          updated_at?: string;
          window_version?: string | null;
        };
        Update: {
          adjacency_version?: string | null;
          assignments_version?: string | null;
          booking_id?: string;
          context_version?: string | null;
          created_at?: string;
          created_by?: string | null;
          expires_at?: string | null;
          flags_version?: string | null;
          hold_id?: string | null;
          holds_version?: string | null;
          id?: string;
          policy_version?: string | null;
          restaurant_id?: string;
          selection?: Json | null;
          selection_version?: number;
          snapshot_hash?: string | null;
          state?: Database['public']['Enums']['manual_assignment_session_state'];
          table_version?: string | null;
          updated_at?: string;
          window_version?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'manual_assignment_sessions_booking_id_fkey';
            columns: ['booking_id'];
            isOneToOne: true;
            referencedRelation: 'bookings';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'manual_assignment_sessions_hold_fkey';
            columns: ['hold_id'];
            isOneToOne: false;
            referencedRelation: 'table_holds';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'manual_assignment_sessions_restaurant_id_fkey';
            columns: ['restaurant_id'];
            isOneToOne: false;
            referencedRelation: 'restaurants';
            referencedColumns: ['id'];
          },
        ];
      };
      merge_rules: {
        Row: {
          created_at: string;
          cross_category_merge: boolean;
          enabled: boolean;
          from_a: number;
          from_b: number;
          id: string;
          require_adjacency: boolean;
          require_same_zone: boolean;
          to_capacity: number;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          cross_category_merge?: boolean;
          enabled?: boolean;
          from_a: number;
          from_b: number;
          id?: string;
          require_adjacency?: boolean;
          require_same_zone?: boolean;
          to_capacity: number;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          cross_category_merge?: boolean;
          enabled?: boolean;
          from_a?: number;
          from_b?: number;
          id?: string;
          require_adjacency?: boolean;
          require_same_zone?: boolean;
          to_capacity?: number;
          updated_at?: string;
        };
        Relationships: [];
      };
      observability_events: {
        Row: {
          booking_id: string | null;
          context: Json | null;
          created_at: string;
          event_type: string;
          id: string;
          restaurant_id: string | null;
          severity: string;
          source: string;
        };
        Insert: {
          booking_id?: string | null;
          context?: Json | null;
          created_at?: string;
          event_type: string;
          id?: string;
          restaurant_id?: string | null;
          severity?: string;
          source: string;
        };
        Update: {
          booking_id?: string | null;
          context?: Json | null;
          created_at?: string;
          event_type?: string;
          id?: string;
          restaurant_id?: string | null;
          severity?: string;
          source?: string;
        };
        Relationships: [];
      };
      profile_update_requests: {
        Row: {
          applied_at: string;
          id: string;
          idempotency_key: string;
          payload_hash: string;
          profile_id: string;
        };
        Insert: {
          applied_at?: string;
          id?: string;
          idempotency_key: string;
          payload_hash: string;
          profile_id: string;
        };
        Update: {
          applied_at?: string;
          id?: string;
          idempotency_key?: string;
          payload_hash?: string;
          profile_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'profile_update_requests_profile_id_fkey';
            columns: ['profile_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      profiles: {
        Row: {
          created_at: string;
          email: string | null;
          has_access: boolean;
          id: string;
          image: string | null;
          name: string | null;
          phone: string | null;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          email?: string | null;
          has_access?: boolean;
          id: string;
          image?: string | null;
          name?: string | null;
          phone?: string | null;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          email?: string | null;
          has_access?: boolean;
          id?: string;
          image?: string | null;
          name?: string | null;
          phone?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      restaurant_capacity_rules: {
        Row: {
          created_at: string;
          day_of_week: number | null;
          effective_date: string | null;
          id: string;
          label: string | null;
          max_covers: number | null;
          max_parties: number | null;
          notes: string | null;
          override_type: Database['public']['Enums']['capacity_override_type'] | null;
          restaurant_id: string;
          service_period_id: string | null;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          day_of_week?: number | null;
          effective_date?: string | null;
          id?: string;
          label?: string | null;
          max_covers?: number | null;
          max_parties?: number | null;
          notes?: string | null;
          override_type?: Database['public']['Enums']['capacity_override_type'] | null;
          restaurant_id: string;
          service_period_id?: string | null;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          day_of_week?: number | null;
          effective_date?: string | null;
          id?: string;
          label?: string | null;
          max_covers?: number | null;
          max_parties?: number | null;
          notes?: string | null;
          override_type?: Database['public']['Enums']['capacity_override_type'] | null;
          restaurant_id?: string;
          service_period_id?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'restaurant_capacity_rules_restaurant_id_fkey';
            columns: ['restaurant_id'];
            isOneToOne: false;
            referencedRelation: 'restaurants';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'restaurant_capacity_rules_service_period_id_fkey';
            columns: ['service_period_id'];
            isOneToOne: false;
            referencedRelation: 'restaurant_service_periods';
            referencedColumns: ['id'];
          },
        ];
      };
      restaurant_invites: {
        Row: {
          accepted_at: string | null;
          created_at: string;
          email: string;
          email_normalized: string | null;
          expires_at: string;
          id: string;
          invited_by: string | null;
          restaurant_id: string;
          revoked_at: string | null;
          role: string;
          status: string;
          token_hash: string;
          updated_at: string;
        };
        Insert: {
          accepted_at?: string | null;
          created_at?: string;
          email: string;
          email_normalized?: string | null;
          expires_at: string;
          id?: string;
          invited_by?: string | null;
          restaurant_id: string;
          revoked_at?: string | null;
          role: string;
          status?: string;
          token_hash: string;
          updated_at?: string;
        };
        Update: {
          accepted_at?: string | null;
          created_at?: string;
          email?: string;
          email_normalized?: string | null;
          expires_at?: string;
          id?: string;
          invited_by?: string | null;
          restaurant_id?: string;
          revoked_at?: string | null;
          role?: string;
          status?: string;
          token_hash?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'restaurant_invites_invited_by_fkey';
            columns: ['invited_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'restaurant_invites_restaurant_id_fkey';
            columns: ['restaurant_id'];
            isOneToOne: false;
            referencedRelation: 'restaurants';
            referencedColumns: ['id'];
          },
        ];
      };
      restaurant_memberships: {
        Row: {
          created_at: string;
          restaurant_id: string;
          role: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          restaurant_id: string;
          role: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          restaurant_id?: string;
          role?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'restaurant_memberships_restaurant_id_fkey';
            columns: ['restaurant_id'];
            isOneToOne: false;
            referencedRelation: 'restaurants';
            referencedColumns: ['id'];
          },
        ];
      };
      restaurant_operating_hours: {
        Row: {
          closes_at: string | null;
          created_at: string;
          day_of_week: number | null;
          effective_date: string | null;
          id: string;
          is_closed: boolean;
          notes: string | null;
          opens_at: string | null;
          reservation_interval_minutes: number | null;
          reservation_slot_times: string[] | null;
          restaurant_id: string;
          updated_at: string;
        };
        Insert: {
          closes_at?: string | null;
          created_at?: string;
          day_of_week?: number | null;
          effective_date?: string | null;
          id?: string;
          is_closed?: boolean;
          notes?: string | null;
          opens_at?: string | null;
          reservation_interval_minutes?: number | null;
          reservation_slot_times?: string[] | null;
          restaurant_id: string;
          updated_at?: string;
        };
        Update: {
          closes_at?: string | null;
          created_at?: string;
          day_of_week?: number | null;
          effective_date?: string | null;
          id?: string;
          is_closed?: boolean;
          notes?: string | null;
          opens_at?: string | null;
          reservation_interval_minutes?: number | null;
          reservation_slot_times?: string[] | null;
          restaurant_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'restaurant_operating_hours_restaurant_id_fkey';
            columns: ['restaurant_id'];
            isOneToOne: false;
            referencedRelation: 'restaurants';
            referencedColumns: ['id'];
          },
        ];
      };
      restaurant_service_periods: {
        Row: {
          booking_option: string;
          created_at: string;
          day_of_week: number | null;
          end_time: string;
          id: string;
          name: string;
          restaurant_id: string;
          start_time: string;
          updated_at: string;
        };
        Insert: {
          booking_option?: string;
          created_at?: string;
          day_of_week?: number | null;
          end_time: string;
          id?: string;
          name: string;
          restaurant_id: string;
          start_time: string;
          updated_at?: string;
        };
        Update: {
          booking_option?: string;
          created_at?: string;
          day_of_week?: number | null;
          end_time?: string;
          id?: string;
          name?: string;
          restaurant_id?: string;
          start_time?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'restaurant_service_periods_booking_option_fkey';
            columns: ['booking_option'];
            isOneToOne: false;
            referencedRelation: 'booking_occasions';
            referencedColumns: ['key'];
          },
          {
            foreignKeyName: 'restaurant_service_periods_restaurant_id_fkey';
            columns: ['restaurant_id'];
            isOneToOne: false;
            referencedRelation: 'restaurants';
            referencedColumns: ['id'];
          },
        ];
      };
      restaurant_turn_bands: {
        Row: {
          booking_option: string;
          created_at: string;
          duration_minutes: number;
          id: string;
          max_party_size: number;
          restaurant_id: string;
          updated_at: string;
        };
        Insert: {
          booking_option: string;
          created_at?: string;
          duration_minutes: number;
          id?: string;
          max_party_size: number;
          restaurant_id: string;
          updated_at?: string;
        };
        Update: {
          booking_option?: string;
          created_at?: string;
          duration_minutes?: number;
          id?: string;
          max_party_size?: number;
          restaurant_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'restaurant_turn_bands_booking_option_fkey';
            columns: ['booking_option'];
            isOneToOne: false;
            referencedRelation: 'booking_occasions';
            referencedColumns: ['key'];
          },
          {
            foreignKeyName: 'restaurant_turn_bands_restaurant_id_fkey';
            columns: ['restaurant_id'];
            isOneToOne: false;
            referencedRelation: 'restaurants';
            referencedColumns: ['id'];
          },
        ];
      };
      restaurant_drink_menu_items: {
        Row: {
          abv: string | null;
          acidity_level: string | null;
          active: boolean;
          alcoholic: boolean;
          allergens_contains: string[];
          allergens_may_contain: string[];
          availability_status: string;
          base_price: string;
          base_spirit: string | null;
          beer_style: string | null;
          bitterness_level: string | null;
          body_level: string | null;
          caffeine_level: string | null;
          calories_kcal: number | null;
          can_be_made_decaf: boolean;
          can_be_made_non_alcoholic: boolean;
          carbs_g: string | null;
          category: string;
          contains_caffeine: boolean;
          contains_dairy: boolean;
          contains_gluten: boolean;
          contains_nuts: boolean;
          country: string | null;
          created_at: string;
          currency: string;
          customization_rules: string | null;
          dietary_tags: string[];
          display_order: number;
          drink_name: string;
          drink_type: string | null;
          external_drink_id: string;
          fat_g: string | null;
          fiber_g: string | null;
          flavor_profile: string | null;
          full_description: string | null;
          garnish: string | null;
          grape_varietal: string | null;
          id: string;
          image_url: string | null;
          key_ingredients: string[];
          limited_time: boolean;
          pairings: string[];
          popularity_score: number | null;
          protein_g: string | null;
          recommendation_tags: string[];
          region: string | null;
          restaurant_id: string;
          roast_level: string | null;
          seasonal: boolean;
          served_style: string | null;
          service_time: string | null;
          serves_num: number | null;
          serving_size: string | null;
          short_description: string | null;
          signature_score: number | null;
          sold_out: boolean;
          saturated_fat_g: string | null;
          subcategory: string | null;
          sodium_mg: string | null;
          sugar_g: string | null;
          sweetness_level: string | null;
          temperature: string | null;
          updated_at: string;
          volume_ml: number | null;
          wine_type: string | null;
        };
        Insert: {
          abv?: string | null;
          acidity_level?: string | null;
          active?: boolean;
          alcoholic?: boolean;
          allergens_contains?: string[];
          allergens_may_contain?: string[];
          availability_status?: string;
          base_price?: string;
          base_spirit?: string | null;
          beer_style?: string | null;
          bitterness_level?: string | null;
          body_level?: string | null;
          caffeine_level?: string | null;
          calories_kcal?: number | null;
          can_be_made_decaf?: boolean;
          can_be_made_non_alcoholic?: boolean;
          carbs_g?: string | null;
          category: string;
          contains_caffeine?: boolean;
          contains_dairy?: boolean;
          contains_gluten?: boolean;
          contains_nuts?: boolean;
          country?: string | null;
          created_at?: string;
          currency?: string;
          customization_rules?: string | null;
          dietary_tags?: string[];
          display_order?: number;
          drink_name: string;
          drink_type?: string | null;
          external_drink_id: string;
          fat_g?: string | null;
          fiber_g?: string | null;
          flavor_profile?: string | null;
          full_description?: string | null;
          garnish?: string | null;
          grape_varietal?: string | null;
          id?: string;
          image_url?: string | null;
          key_ingredients?: string[];
          limited_time?: boolean;
          pairings?: string[];
          popularity_score?: number | null;
          protein_g?: string | null;
          recommendation_tags?: string[];
          region?: string | null;
          restaurant_id: string;
          roast_level?: string | null;
          seasonal?: boolean;
          served_style?: string | null;
          service_time?: string | null;
          serves_num?: number | null;
          serving_size?: string | null;
          short_description?: string | null;
          signature_score?: number | null;
          sold_out?: boolean;
          saturated_fat_g?: string | null;
          subcategory?: string | null;
          sodium_mg?: string | null;
          sugar_g?: string | null;
          sweetness_level?: string | null;
          temperature?: string | null;
          updated_at?: string;
          volume_ml?: number | null;
          wine_type?: string | null;
        };
        Update: {
          abv?: string | null;
          acidity_level?: string | null;
          active?: boolean;
          alcoholic?: boolean;
          allergens_contains?: string[];
          allergens_may_contain?: string[];
          availability_status?: string;
          base_price?: string;
          base_spirit?: string | null;
          beer_style?: string | null;
          bitterness_level?: string | null;
          body_level?: string | null;
          caffeine_level?: string | null;
          calories_kcal?: number | null;
          can_be_made_decaf?: boolean;
          can_be_made_non_alcoholic?: boolean;
          carbs_g?: string | null;
          category?: string;
          contains_caffeine?: boolean;
          contains_dairy?: boolean;
          contains_gluten?: boolean;
          contains_nuts?: boolean;
          country?: string | null;
          created_at?: string;
          currency?: string;
          customization_rules?: string | null;
          dietary_tags?: string[];
          display_order?: number;
          drink_name?: string;
          drink_type?: string | null;
          external_drink_id?: string;
          fat_g?: string | null;
          fiber_g?: string | null;
          flavor_profile?: string | null;
          full_description?: string | null;
          garnish?: string | null;
          grape_varietal?: string | null;
          id?: string;
          image_url?: string | null;
          key_ingredients?: string[];
          limited_time?: boolean;
          pairings?: string[];
          popularity_score?: number | null;
          protein_g?: string | null;
          recommendation_tags?: string[];
          region?: string | null;
          restaurant_id?: string;
          roast_level?: string | null;
          seasonal?: boolean;
          served_style?: string | null;
          service_time?: string | null;
          serves_num?: number | null;
          serving_size?: string | null;
          short_description?: string | null;
          signature_score?: number | null;
          sold_out?: boolean;
          saturated_fat_g?: string | null;
          subcategory?: string | null;
          sodium_mg?: string | null;
          sugar_g?: string | null;
          sweetness_level?: string | null;
          temperature?: string | null;
          updated_at?: string;
          volume_ml?: number | null;
          wine_type?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'restaurant_drink_menu_items_restaurant_id_fkey';
            columns: ['restaurant_id'];
            isOneToOne: false;
            referencedRelation: 'restaurants';
            referencedColumns: ['id'];
          },
        ];
      };
      restaurant_drink_menu_modifier_groups: {
        Row: {
          created_at: string;
          display_order: number;
          drink_item_id: string;
          external_modifier_group_id: string;
          group_name: string;
          id: string;
          max_select: number;
          min_select: number;
          required: boolean;
          restaurant_id: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          display_order?: number;
          drink_item_id: string;
          external_modifier_group_id: string;
          group_name: string;
          id?: string;
          max_select?: number;
          min_select?: number;
          required?: boolean;
          restaurant_id: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          display_order?: number;
          drink_item_id?: string;
          external_modifier_group_id?: string;
          group_name?: string;
          id?: string;
          max_select?: number;
          min_select?: number;
          required?: boolean;
          restaurant_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'restaurant_drink_menu_modifier_groups_item_fk';
            columns: ['restaurant_id', 'drink_item_id'];
            isOneToOne: false;
            referencedRelation: 'restaurant_drink_menu_items';
            referencedColumns: ['restaurant_id', 'id'];
          },
          {
            foreignKeyName: 'restaurant_drink_menu_modifier_groups_restaurant_id_fkey';
            columns: ['restaurant_id'];
            isOneToOne: false;
            referencedRelation: 'restaurants';
            referencedColumns: ['id'];
          },
        ];
      };
      restaurant_drink_menu_modifier_options: {
        Row: {
          availability_status: string;
          created_at: string;
          default_selected: boolean;
          display_order: number;
          external_modifier_option_id: string;
          id: string;
          modifier_group_id: string;
          option_name: string;
          price_delta: string;
          restaurant_id: string;
          updated_at: string;
        };
        Insert: {
          availability_status?: string;
          created_at?: string;
          default_selected?: boolean;
          display_order?: number;
          external_modifier_option_id: string;
          id?: string;
          modifier_group_id: string;
          option_name: string;
          price_delta?: string;
          restaurant_id: string;
          updated_at?: string;
        };
        Update: {
          availability_status?: string;
          created_at?: string;
          default_selected?: boolean;
          display_order?: number;
          external_modifier_option_id?: string;
          id?: string;
          modifier_group_id?: string;
          option_name?: string;
          price_delta?: string;
          restaurant_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'restaurant_drink_menu_modifier_options_group_fk';
            columns: ['restaurant_id', 'modifier_group_id'];
            isOneToOne: false;
            referencedRelation: 'restaurant_drink_menu_modifier_groups';
            referencedColumns: ['restaurant_id', 'id'];
          },
          {
            foreignKeyName: 'restaurant_drink_menu_modifier_options_restaurant_id_fkey';
            columns: ['restaurant_id'];
            isOneToOne: false;
            referencedRelation: 'restaurants';
            referencedColumns: ['id'];
          },
        ];
      };
      restaurant_menu_items: {
        Row: {
          active: boolean;
          allergens_contains: string[];
          allergens_may_contain: string[];
          availability_status: string;
          base_price: string;
          calories_kcal: number | null;
          can_be_made_gluten_free: boolean;
          can_be_made_vegan: boolean;
          can_be_made_vegetarian: boolean;
          carbs_g: string | null;
          category: string;
          cooking_style: string | null;
          created_at: string;
          currency: string;
          customization_rules: string | null;
          dietary_tags: string[];
          display_order: number;
          external_item_id: string;
          flavor_profile: string | null;
          fat_g: string | null;
          fiber_g: string | null;
          full_description: string | null;
          id: string;
          image_url: string | null;
          item_name: string;
          key_ingredients: string[];
          limited_time: boolean;
          main_protein_or_base: string | null;
          pairings: string[];
          popularity_score: number | null;
          portion_size: string | null;
          preparation_method: string | null;
          protein_g: string | null;
          recommendation_tags: string[];
          removable_ingredients: string[];
          restaurant_id: string;
          seasonal: boolean;
          service_time: string | null;
          serves_num: number | null;
          serving_notes: string | null;
          shareable: boolean;
          short_description: string | null;
          signature_score: number | null;
          sold_out: boolean;
          saturated_fat_g: string | null;
          spice_adjustable: boolean;
          spice_level: string | null;
          sodium_mg: string | null;
          subcategory: string | null;
          substitutions_allowed: boolean;
          sugar_g: string | null;
          texture: string | null;
          updated_at: string;
        };
        Insert: {
          active?: boolean;
          allergens_contains?: string[];
          allergens_may_contain?: string[];
          availability_status?: string;
          base_price?: string;
          calories_kcal?: number | null;
          can_be_made_gluten_free?: boolean;
          can_be_made_vegan?: boolean;
          can_be_made_vegetarian?: boolean;
          carbs_g?: string | null;
          category: string;
          cooking_style?: string | null;
          created_at?: string;
          currency?: string;
          customization_rules?: string | null;
          dietary_tags?: string[];
          display_order?: number;
          external_item_id: string;
          flavor_profile?: string | null;
          fat_g?: string | null;
          fiber_g?: string | null;
          full_description?: string | null;
          id?: string;
          image_url?: string | null;
          item_name: string;
          key_ingredients?: string[];
          limited_time?: boolean;
          main_protein_or_base?: string | null;
          pairings?: string[];
          popularity_score?: number | null;
          portion_size?: string | null;
          preparation_method?: string | null;
          protein_g?: string | null;
          recommendation_tags?: string[];
          removable_ingredients?: string[];
          restaurant_id: string;
          seasonal?: boolean;
          service_time?: string | null;
          serves_num?: number | null;
          serving_notes?: string | null;
          shareable?: boolean;
          short_description?: string | null;
          signature_score?: number | null;
          sold_out?: boolean;
          saturated_fat_g?: string | null;
          spice_adjustable?: boolean;
          spice_level?: string | null;
          sodium_mg?: string | null;
          subcategory?: string | null;
          substitutions_allowed?: boolean;
          sugar_g?: string | null;
          texture?: string | null;
          updated_at?: string;
        };
        Update: {
          active?: boolean;
          allergens_contains?: string[];
          allergens_may_contain?: string[];
          availability_status?: string;
          base_price?: string;
          calories_kcal?: number | null;
          can_be_made_gluten_free?: boolean;
          can_be_made_vegan?: boolean;
          can_be_made_vegetarian?: boolean;
          carbs_g?: string | null;
          category?: string;
          cooking_style?: string | null;
          created_at?: string;
          currency?: string;
          customization_rules?: string | null;
          dietary_tags?: string[];
          display_order?: number;
          external_item_id?: string;
          flavor_profile?: string | null;
          fat_g?: string | null;
          fiber_g?: string | null;
          full_description?: string | null;
          id?: string;
          image_url?: string | null;
          item_name?: string;
          key_ingredients?: string[];
          limited_time?: boolean;
          main_protein_or_base?: string | null;
          pairings?: string[];
          popularity_score?: number | null;
          portion_size?: string | null;
          preparation_method?: string | null;
          protein_g?: string | null;
          recommendation_tags?: string[];
          removable_ingredients?: string[];
          restaurant_id?: string;
          seasonal?: boolean;
          service_time?: string | null;
          serves_num?: number | null;
          serving_notes?: string | null;
          shareable?: boolean;
          short_description?: string | null;
          signature_score?: number | null;
          sold_out?: boolean;
          saturated_fat_g?: string | null;
          spice_adjustable?: boolean;
          spice_level?: string | null;
          sodium_mg?: string | null;
          subcategory?: string | null;
          substitutions_allowed?: boolean;
          sugar_g?: string | null;
          texture?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'restaurant_menu_items_restaurant_id_fkey';
            columns: ['restaurant_id'];
            isOneToOne: false;
            referencedRelation: 'restaurants';
            referencedColumns: ['id'];
          },
        ];
      };
      restaurant_menu_modifier_groups: {
        Row: {
          created_at: string;
          display_order: number;
          external_modifier_group_id: string;
          group_name: string;
          id: string;
          max_select: number;
          menu_item_id: string;
          min_select: number;
          required: boolean;
          restaurant_id: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          display_order?: number;
          external_modifier_group_id: string;
          group_name: string;
          id?: string;
          max_select?: number;
          menu_item_id: string;
          min_select?: number;
          required?: boolean;
          restaurant_id: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          display_order?: number;
          external_modifier_group_id?: string;
          group_name?: string;
          id?: string;
          max_select?: number;
          menu_item_id?: string;
          min_select?: number;
          required?: boolean;
          restaurant_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'restaurant_menu_modifier_groups_item_fk';
            columns: ['restaurant_id', 'menu_item_id'];
            isOneToOne: false;
            referencedRelation: 'restaurant_menu_items';
            referencedColumns: ['restaurant_id', 'id'];
          },
          {
            foreignKeyName: 'restaurant_menu_modifier_groups_restaurant_id_fkey';
            columns: ['restaurant_id'];
            isOneToOne: false;
            referencedRelation: 'restaurants';
            referencedColumns: ['id'];
          },
        ];
      };
      restaurant_menu_modifier_options: {
        Row: {
          availability_status: string;
          created_at: string;
          default_selected: boolean;
          display_order: number;
          external_modifier_option_id: string;
          id: string;
          modifier_group_id: string;
          option_name: string;
          price_delta: string;
          restaurant_id: string;
          updated_at: string;
        };
        Insert: {
          availability_status?: string;
          created_at?: string;
          default_selected?: boolean;
          display_order?: number;
          external_modifier_option_id: string;
          id?: string;
          modifier_group_id: string;
          option_name: string;
          price_delta?: string;
          restaurant_id: string;
          updated_at?: string;
        };
        Update: {
          availability_status?: string;
          created_at?: string;
          default_selected?: boolean;
          display_order?: number;
          external_modifier_option_id?: string;
          id?: string;
          modifier_group_id?: string;
          option_name?: string;
          price_delta?: string;
          restaurant_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'restaurant_menu_modifier_options_group_fk';
            columns: ['restaurant_id', 'modifier_group_id'];
            isOneToOne: false;
            referencedRelation: 'restaurant_menu_modifier_groups';
            referencedColumns: ['restaurant_id', 'id'];
          },
          {
            foreignKeyName: 'restaurant_menu_modifier_options_restaurant_id_fkey';
            columns: ['restaurant_id'];
            isOneToOne: false;
            referencedRelation: 'restaurants';
            referencedColumns: ['id'];
          },
        ];
      };
      restaurant_external_profile_snapshots: {
        Row: {
          created_at: string;
          external_profile_id: string;
          fetched_at: string;
          id: string;
          payload: Json;
          payload_hash: string;
          snapshot_type: string;
          source_revision: string | null;
        };
        Insert: {
          created_at?: string;
          external_profile_id: string;
          fetched_at?: string;
          id?: string;
          payload: Json;
          payload_hash: string;
          snapshot_type: string;
          source_revision?: string | null;
        };
        Update: {
          created_at?: string;
          external_profile_id?: string;
          fetched_at?: string;
          id?: string;
          payload?: Json;
          payload_hash?: string;
          snapshot_type?: string;
          source_revision?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'restaurant_external_profile_snapshots_external_profile_id_fkey';
            columns: ['external_profile_id'];
            isOneToOne: false;
            referencedRelation: 'restaurant_external_profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      restaurant_external_profile_drafts: {
        Row: {
          approved_at: string | null;
          approved_by_user_id: string | null;
          conflict_metadata: Json;
          core_snapshot_hashes: Json;
          created_at: string;
          created_by_user_id: string | null;
          external_profile_id: string | null;
          fetched_at: string | null;
          id: string;
          provider: string;
          published_at: string | null;
          published_by_user_id: string | null;
          restaurant_id: string;
          section_diffs: Json;
          selected_approvals: Json;
          source_snapshot_refs: Json;
          stale_sections: string[];
          status: string;
          updated_at: string;
        };
        Insert: {
          approved_at?: string | null;
          approved_by_user_id?: string | null;
          conflict_metadata?: Json;
          core_snapshot_hashes?: Json;
          created_at?: string;
          created_by_user_id?: string | null;
          external_profile_id?: string | null;
          fetched_at?: string | null;
          id?: string;
          provider?: string;
          published_at?: string | null;
          published_by_user_id?: string | null;
          restaurant_id: string;
          section_diffs?: Json;
          selected_approvals?: Json;
          source_snapshot_refs?: Json;
          stale_sections?: string[];
          status?: string;
          updated_at?: string;
        };
        Update: {
          approved_at?: string | null;
          approved_by_user_id?: string | null;
          conflict_metadata?: Json;
          core_snapshot_hashes?: Json;
          created_at?: string;
          created_by_user_id?: string | null;
          external_profile_id?: string | null;
          fetched_at?: string | null;
          id?: string;
          provider?: string;
          published_at?: string | null;
          published_by_user_id?: string | null;
          restaurant_id?: string;
          section_diffs?: Json;
          selected_approvals?: Json;
          source_snapshot_refs?: Json;
          stale_sections?: string[];
          status?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'restaurant_external_profile_drafts_external_profile_id_fkey';
            columns: ['external_profile_id'];
            isOneToOne: false;
            referencedRelation: 'restaurant_external_profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'restaurant_external_profile_drafts_restaurant_id_fkey';
            columns: ['restaurant_id'];
            isOneToOne: false;
            referencedRelation: 'restaurants';
            referencedColumns: ['id'];
          },
        ];
      };
      restaurant_external_profile_publish_events: {
        Row: {
          actor_user_id: string | null;
          affected_sections: string[];
          created_at: string;
          direction: string;
          draft_id: string | null;
          errors: Json;
          external_profile_id: string | null;
          google_update_masks: Json;
          id: string;
          new_values: Json;
          old_values: Json;
          provider: string;
          restaurant_id: string;
          result: string;
        };
        Insert: {
          actor_user_id?: string | null;
          affected_sections?: string[];
          created_at?: string;
          direction: string;
          draft_id?: string | null;
          errors?: Json;
          external_profile_id?: string | null;
          google_update_masks?: Json;
          id?: string;
          new_values?: Json;
          old_values?: Json;
          provider?: string;
          restaurant_id: string;
          result?: string;
        };
        Update: {
          actor_user_id?: string | null;
          affected_sections?: string[];
          created_at?: string;
          direction?: string;
          draft_id?: string | null;
          errors?: Json;
          external_profile_id?: string | null;
          google_update_masks?: Json;
          id?: string;
          new_values?: Json;
          old_values?: Json;
          provider?: string;
          restaurant_id?: string;
          result?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'restaurant_external_profile_publish_events_draft_id_fkey';
            columns: ['draft_id'];
            isOneToOne: false;
            referencedRelation: 'restaurant_external_profile_drafts';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'restaurant_external_profile_publish_events_external_profile_id_fkey';
            columns: ['external_profile_id'];
            isOneToOne: false;
            referencedRelation: 'restaurant_external_profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'restaurant_external_profile_publish_events_restaurant_id_fkey';
            columns: ['restaurant_id'];
            isOneToOne: false;
            referencedRelation: 'restaurants';
            referencedColumns: ['id'];
          },
        ];
      };
      restaurant_external_profile_publish_jobs: {
        Row: {
          created_at: string;
          created_by_user_id: string | null;
          draft_id: string;
          error_classification: string | null;
          errors: Json;
          external_profile_id: string | null;
          failed_at: string | null;
          google_publish_event_id: string | null;
          google_pushed_at: string | null;
          google_retry_by_user_id: string | null;
          google_update_masks: string[];
          id: string;
          idempotency_key: string;
          mode: string;
          nabatable_publish_event_id: string | null;
          nabatable_published_at: string | null;
          nabatable_sections: string[];
          post_nabatable_core_hashes: Json;
          preflight_errors: Json;
          preflight_nabatable_updates: Json;
          preflight_pull_only_items: Json;
          preflight_warnings: Json;
          preflighted_at: string;
          provider: string;
          published_by_user_id: string | null;
          restaurant_id: string;
          retried_at: string | null;
          selected_approvals: Json;
          status: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          created_by_user_id?: string | null;
          draft_id: string;
          error_classification?: string | null;
          errors?: Json;
          external_profile_id?: string | null;
          failed_at?: string | null;
          google_publish_event_id?: string | null;
          google_pushed_at?: string | null;
          google_retry_by_user_id?: string | null;
          google_update_masks?: string[];
          id?: string;
          idempotency_key: string;
          mode?: string;
          nabatable_publish_event_id?: string | null;
          nabatable_published_at?: string | null;
          nabatable_sections?: string[];
          post_nabatable_core_hashes?: Json;
          preflight_errors?: Json;
          preflight_nabatable_updates?: Json;
          preflight_pull_only_items?: Json;
          preflight_warnings?: Json;
          preflighted_at?: string;
          provider?: string;
          published_by_user_id?: string | null;
          restaurant_id: string;
          retried_at?: string | null;
          selected_approvals?: Json;
          status?: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          created_by_user_id?: string | null;
          draft_id?: string;
          error_classification?: string | null;
          errors?: Json;
          external_profile_id?: string | null;
          failed_at?: string | null;
          google_publish_event_id?: string | null;
          google_pushed_at?: string | null;
          google_retry_by_user_id?: string | null;
          google_update_masks?: string[];
          id?: string;
          idempotency_key?: string;
          mode?: string;
          nabatable_publish_event_id?: string | null;
          nabatable_published_at?: string | null;
          nabatable_sections?: string[];
          post_nabatable_core_hashes?: Json;
          preflight_errors?: Json;
          preflight_nabatable_updates?: Json;
          preflight_pull_only_items?: Json;
          preflight_warnings?: Json;
          preflighted_at?: string;
          provider?: string;
          published_by_user_id?: string | null;
          restaurant_id?: string;
          retried_at?: string | null;
          selected_approvals?: Json;
          status?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'restaurant_external_profile_publish_jobs_draft_id_fkey';
            columns: ['draft_id'];
            isOneToOne: false;
            referencedRelation: 'restaurant_external_profile_drafts';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'restaurant_external_profile_publish_jobs_external_profile_id_fkey';
            columns: ['external_profile_id'];
            isOneToOne: false;
            referencedRelation: 'restaurant_external_profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'restaurant_external_profile_publish_jobs_google_publish_event_id_fkey';
            columns: ['google_publish_event_id'];
            isOneToOne: false;
            referencedRelation: 'restaurant_external_profile_publish_events';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'restaurant_external_profile_publish_jobs_nabatable_publish_event_id_fkey';
            columns: ['nabatable_publish_event_id'];
            isOneToOne: false;
            referencedRelation: 'restaurant_external_profile_publish_events';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'restaurant_external_profile_publish_jobs_restaurant_id_fkey';
            columns: ['restaurant_id'];
            isOneToOne: false;
            referencedRelation: 'restaurants';
            referencedColumns: ['id'];
          },
        ];
      };
      restaurant_field_sync_statuses: {
        Row: {
          created_at: string;
          entity_key: string;
          entity_table: string;
          field_key: string;
          id: string;
          is_verified: boolean;
          last_canonical_value_json: Json | null;
          last_checked_at: string | null;
          last_provider_value_json: Json | null;
          last_synced_at: string | null;
          provider: string;
          provider_record_id: string | null;
          restaurant_id: string;
          sync_status: string;
          updated_at: string;
          value_hash: string | null;
          verified_at: string | null;
          verified_by: string | null;
        };
        Insert: {
          created_at?: string;
          entity_key: string;
          entity_table: string;
          field_key: string;
          id?: string;
          is_verified?: boolean;
          last_canonical_value_json?: Json | null;
          last_checked_at?: string | null;
          last_provider_value_json?: Json | null;
          last_synced_at?: string | null;
          provider: string;
          provider_record_id?: string | null;
          restaurant_id: string;
          sync_status?: string;
          updated_at?: string;
          value_hash?: string | null;
          verified_at?: string | null;
          verified_by?: string | null;
        };
        Update: {
          created_at?: string;
          entity_key?: string;
          entity_table?: string;
          field_key?: string;
          id?: string;
          is_verified?: boolean;
          last_canonical_value_json?: Json | null;
          last_checked_at?: string | null;
          last_provider_value_json?: Json | null;
          last_synced_at?: string | null;
          provider?: string;
          provider_record_id?: string | null;
          restaurant_id?: string;
          sync_status?: string;
          updated_at?: string;
          value_hash?: string | null;
          verified_at?: string | null;
          verified_by?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'restaurant_field_sync_statuses_restaurant_id_fkey';
            columns: ['restaurant_id'];
            isOneToOne: false;
            referencedRelation: 'restaurants';
            referencedColumns: ['id'];
          },
        ];
      };
      restaurant_external_profile_credentials: {
        Row: {
          connected_google_email: string | null;
          connected_google_name: string | null;
          created_at: string;
          external_profile_id: string;
          granted_scopes: string[];
          identity_verified_at: string | null;
          last_error: string | null;
          last_refreshed_at: string | null;
          provider_user_id: string | null;
          refresh_token_encrypted: string;
          token_type: string | null;
          updated_at: string;
        };
        Insert: {
          connected_google_email?: string | null;
          connected_google_name?: string | null;
          created_at?: string;
          external_profile_id: string;
          granted_scopes?: string[];
          identity_verified_at?: string | null;
          last_error?: string | null;
          last_refreshed_at?: string | null;
          provider_user_id?: string | null;
          refresh_token_encrypted: string;
          token_type?: string | null;
          updated_at?: string;
        };
        Update: {
          connected_google_email?: string | null;
          connected_google_name?: string | null;
          created_at?: string;
          external_profile_id?: string;
          granted_scopes?: string[];
          identity_verified_at?: string | null;
          last_error?: string | null;
          last_refreshed_at?: string | null;
          provider_user_id?: string | null;
          refresh_token_encrypted?: string;
          token_type?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'restaurant_external_profile_credentials_external_profile_id_fkey';
            columns: ['external_profile_id'];
            isOneToOne: true;
            referencedRelation: 'restaurant_external_profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      restaurant_external_profile_oauth_states: {
        Row: {
          connection_generation: number;
          consumed_at: string | null;
          consent_epoch: number;
          created_at: string;
          expected_external_account_id: string | null;
          expected_external_location_id: string | null;
          expected_external_profile_id: string | null;
          expires_at: string;
          external_profile_row_id: string | null;
          id: string;
          invalidated_at: string | null;
          invalidation_reason: string | null;
          oidc_nonce_hash: string;
          provider: string;
          requested_by_user_id: string;
          restaurant_id: string;
          return_path: string;
          state_hash: string;
          state_token: string;
          updated_at: string;
        };
        Insert: {
          connection_generation: number;
          consumed_at?: string | null;
          consent_epoch: number;
          created_at?: string;
          expected_external_account_id?: string | null;
          expected_external_location_id?: string | null;
          expected_external_profile_id?: string | null;
          expires_at: string;
          external_profile_row_id?: string | null;
          id?: string;
          invalidated_at?: string | null;
          invalidation_reason?: string | null;
          oidc_nonce_hash: string;
          provider: string;
          requested_by_user_id: string;
          restaurant_id: string;
          return_path?: string;
          state_hash: string;
          state_token: string;
          updated_at?: string;
        };
        Update: {
          connection_generation?: number;
          consumed_at?: string | null;
          consent_epoch?: number;
          created_at?: string;
          expected_external_account_id?: string | null;
          expected_external_location_id?: string | null;
          expected_external_profile_id?: string | null;
          expires_at?: string;
          external_profile_row_id?: string | null;
          id?: string;
          invalidated_at?: string | null;
          invalidation_reason?: string | null;
          oidc_nonce_hash?: string;
          provider?: string;
          requested_by_user_id?: string;
          restaurant_id?: string;
          return_path?: string;
          state_hash?: string;
          state_token?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'restaurant_external_profile_oauth_states_restaurant_id_fkey';
            columns: ['restaurant_id'];
            isOneToOne: false;
            referencedRelation: 'restaurants';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'restaurant_external_profile_oauth_states_profile_tenant_v1_fkey';
            columns: ['restaurant_id', 'external_profile_row_id'];
            isOneToOne: false;
            referencedRelation: 'restaurant_external_profiles';
            referencedColumns: ['restaurant_id', 'id'];
          },
        ];
      };
      restaurant_external_profile_sync_runs: {
        Row: {
          created_at: string;
          error_code: string | null;
          error_message: string | null;
          external_profile_id: string;
          finished_at: string | null;
          id: string;
          metadata: Json | null;
          provider: string;
          restaurant_id: string;
          run_kind: string;
          started_at: string;
          status: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          error_code?: string | null;
          error_message?: string | null;
          external_profile_id: string;
          finished_at?: string | null;
          id?: string;
          metadata?: Json | null;
          provider?: string;
          restaurant_id: string;
          run_kind?: string;
          started_at?: string;
          status: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          error_code?: string | null;
          error_message?: string | null;
          external_profile_id?: string;
          finished_at?: string | null;
          id?: string;
          metadata?: Json | null;
          provider?: string;
          restaurant_id?: string;
          run_kind?: string;
          started_at?: string;
          status?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'restaurant_external_profile_sync_runs_external_profile_id_fkey';
            columns: ['external_profile_id'];
            isOneToOne: false;
            referencedRelation: 'restaurant_external_profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'restaurant_external_profile_sync_runs_restaurant_id_fkey';
            columns: ['restaurant_id'];
            isOneToOne: false;
            referencedRelation: 'restaurants';
            referencedColumns: ['id'];
          },
        ];
      };
      dual_sync_google_request_log_archives: {
        Row: {
          archived_at: string;
          archived_payload: Json;
          content_archive_decommissioned_at: string | null;
          id: string;
          metadata_audit_hash: string | null;
          metadata_audit_retained_until: string | null;
          original_created_at: string;
          original_request_log_id: string;
          provider: string;
          restaurant_id: string;
          retention_expires_at: string;
        };
        Insert: {
          archived_at?: string;
          archived_payload: Json;
          content_archive_decommissioned_at?: string | null;
          id?: string;
          metadata_audit_hash?: string | null;
          metadata_audit_retained_until?: string | null;
          original_created_at: string;
          original_request_log_id: string;
          provider?: string;
          restaurant_id: string;
          retention_expires_at: string;
        };
        Update: Partial<
          Database['public']['Tables']['dual_sync_google_request_log_archives']['Row']
        >;
        Relationships: [
          {
            foreignKeyName: 'dual_sync_google_request_log_archives_restaurant_id_fkey';
            columns: ['restaurant_id'];
            isOneToOne: false;
            referencedRelation: 'restaurants';
            referencedColumns: ['id'];
          },
        ];
      };
      dual_sync_google_request_logs: {
        Row: {
          created_at: string;
          direction: string | null;
          error_code: string | null;
          error_message: string | null;
          field_key: string | null;
          google_method: string | null;
          google_update_masks: string[];
          id: string;
          operation_group_id: string | null;
          phase: string;
          provider: string;
          publish_batch_id: string | null;
          publish_job_id: string | null;
          publish_operation_id: string | null;
          request_summary: Json;
          response_summary: Json | null;
          restaurant_id: string;
          retention_expires_at: string | null;
          section_key: string | null;
          status: string | null;
          write_group: string | null;
        };
        Insert: {
          created_at?: string;
          direction?: string | null;
          error_code?: string | null;
          error_message?: string | null;
          field_key?: string | null;
          google_method?: string | null;
          google_update_masks?: string[];
          id?: string;
          operation_group_id?: string | null;
          phase: string;
          provider?: string;
          publish_batch_id?: string | null;
          publish_job_id?: string | null;
          publish_operation_id?: string | null;
          request_summary?: Json;
          response_summary?: Json | null;
          restaurant_id: string;
          retention_expires_at?: string | null;
          section_key?: string | null;
          status?: string | null;
          write_group?: string | null;
        };
        Update: Partial<Database['public']['Tables']['dual_sync_google_request_logs']['Row']>;
        Relationships: [
          {
            foreignKeyName: 'dual_sync_google_request_logs_restaurant_id_fkey';
            columns: ['restaurant_id'];
            isOneToOne: false;
            referencedRelation: 'restaurants';
            referencedColumns: ['id'];
          },
        ];
      };
      dual_sync_jobs: {
        Row: {
          attempt_count: number;
          available_at: string;
          connection_generation: number | null;
          consent_epoch: number | null;
          created_at: string;
          dead_letter_reason: string | null;
          execution_id: string | null;
          external_account_id: string | null;
          external_location_id: string | null;
          external_profile_id: string | null;
          finished_at: string | null;
          id: string;
          idempotency_key: string | null;
          job_kind: string;
          last_error_code: string | null;
          last_error_message: string | null;
          locked_at: string | null;
          locked_by: string | null;
          max_attempts: number;
          payload: Json;
          priority: number;
          provider: string;
          restaurant_id: string;
          started_at: string | null;
          status: string;
          updated_at: string;
          write_bundle_id: string | null;
        };
        Insert: {
          attempt_count?: number;
          available_at?: string;
          connection_generation?: number | null;
          consent_epoch?: number | null;
          created_at?: string;
          dead_letter_reason?: string | null;
          execution_id?: string | null;
          external_account_id?: string | null;
          external_location_id?: string | null;
          external_profile_id?: string | null;
          finished_at?: string | null;
          id?: string;
          idempotency_key?: string | null;
          job_kind: string;
          last_error_code?: string | null;
          last_error_message?: string | null;
          locked_at?: string | null;
          locked_by?: string | null;
          max_attempts?: number;
          payload?: Json;
          priority?: number;
          provider?: string;
          restaurant_id: string;
          started_at?: string | null;
          status?: string;
          updated_at?: string;
          write_bundle_id?: string | null;
        };
        Update: Partial<Database['public']['Tables']['dual_sync_jobs']['Row']>;
        Relationships: [
          {
            foreignKeyName: 'dual_sync_jobs_restaurant_id_fkey';
            columns: ['restaurant_id'];
            isOneToOne: false;
            referencedRelation: 'restaurants';
            referencedColumns: ['id'];
          },
        ];
      };
      gbp_content_lineage_v1: {
        Row: {
          connection_generation: number;
          consent_epoch: number;
          content_field: string;
          created_at: string;
          expires_at: string;
          external_account_id: string;
          external_location_id: string;
          external_profile_id: string;
          external_profile_row_id: string;
          id: string;
          observed_at: string;
          origin_kind: string;
          parent_lineage_id: string | null;
          restaurant_id: string;
          source_row_id: string;
          store_key: string;
          value_hash: string;
        };
        Insert: {
          connection_generation: number;
          consent_epoch: number;
          content_field: string;
          created_at?: string;
          expires_at: string;
          external_account_id: string;
          external_location_id: string;
          external_profile_id: string;
          external_profile_row_id: string;
          id?: string;
          observed_at: string;
          origin_kind: string;
          parent_lineage_id?: string | null;
          restaurant_id: string;
          source_row_id: string;
          store_key: string;
          value_hash: string;
        };
        Update: {
          connection_generation?: number;
          consent_epoch?: number;
          content_field?: string;
          created_at?: string;
          expires_at?: string;
          external_account_id?: string;
          external_location_id?: string;
          external_profile_id?: string;
          external_profile_row_id?: string;
          id?: string;
          observed_at?: string;
          origin_kind?: string;
          parent_lineage_id?: string | null;
          restaurant_id?: string;
          source_row_id?: string;
          store_key?: string;
          value_hash?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'gbp_content_lineage_v1_parent_lineage_id_fkey';
            columns: ['parent_lineage_id'];
            isOneToOne: false;
            referencedRelation: 'gbp_content_lineage_v1';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'gbp_content_lineage_v1_restaurant_id_fkey';
            columns: ['restaurant_id'];
            isOneToOne: false;
            referencedRelation: 'restaurants';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'gbp_content_lineage_v1_profile_fkey';
            columns: [
              'restaurant_id',
              'external_profile_row_id',
              'external_account_id',
              'external_profile_id',
              'external_location_id',
              'connection_generation',
              'consent_epoch',
            ];
            isOneToOne: false;
            referencedRelation: 'restaurant_external_profiles';
            referencedColumns: [
              'restaurant_id',
              'id',
              'external_account_id',
              'external_profile_id',
              'external_location_id',
              'connection_generation',
              'consent_epoch',
            ];
          },
        ];
      };
      gbp_consent_events_v1: {
        Row: GbpConsentEventV1Row;
        Insert: Omit<
          GbpConsentEventV1Row,
          | 'actor_user_id'
          | 'bundle_id'
          | 'created_at'
          | 'execution_id'
          | 'grant_id'
          | 'id'
          | 'reason_code'
        > &
          Partial<
            Pick<
              GbpConsentEventV1Row,
              | 'actor_user_id'
              | 'bundle_id'
              | 'created_at'
              | 'execution_id'
              | 'grant_id'
              | 'id'
              | 'reason_code'
            >
          >;
        Update: Partial<GbpConsentEventV1Row>;
        Relationships: [
          {
            foreignKeyName: 'gbp_consent_events_v1_grant_tenant_fkey';
            columns: ['restaurant_id', 'grant_id'];
            isOneToOne: false;
            referencedRelation: 'gbp_write_grants_v1';
            referencedColumns: ['restaurant_id', 'id'];
          },
          {
            foreignKeyName: 'gbp_consent_events_v1_restaurant_id_fkey';
            columns: ['restaurant_id'];
            isOneToOne: false;
            referencedRelation: 'restaurants';
            referencedColumns: ['id'];
          },
        ];
      };
      gbp_core_change_outbox_v1: {
        Row: GbpCoreChangeOutboxV1Row;
        Insert: Omit<
          GbpCoreChangeOutboxV1Row,
          | 'after_hash'
          | 'attempt_count'
          | 'available_at'
          | 'before_hash'
          | 'claimed_at'
          | 'claimed_by'
          | 'completed_at'
          | 'created_at'
          | 'dead_lettered_at'
          | 'id'
          | 'last_error_code'
          | 'lease_expires_at'
          | 'lease_token'
          | 'max_attempts'
          | 'status'
        > &
          Partial<
            Pick<
              GbpCoreChangeOutboxV1Row,
              | 'after_hash'
              | 'attempt_count'
              | 'available_at'
              | 'before_hash'
              | 'claimed_at'
              | 'claimed_by'
              | 'completed_at'
              | 'created_at'
              | 'dead_lettered_at'
              | 'id'
              | 'last_error_code'
              | 'lease_expires_at'
              | 'lease_token'
              | 'max_attempts'
              | 'status'
            >
          >;
        Update: Partial<GbpCoreChangeOutboxV1Row>;
        Relationships: [
          {
            foreignKeyName: 'gbp_core_change_outbox_v1_restaurant_id_fkey';
            columns: ['restaurant_id'];
            isOneToOne: false;
            referencedRelation: 'restaurants';
            referencedColumns: ['id'];
          },
        ];
      };
      gbp_field_provenance_v1: {
        Row: GbpFieldProvenanceV1Row;
        Insert: Omit<
          GbpFieldProvenanceV1Row,
          | 'connection_generation'
          | 'consent_epoch'
          | 'created_at'
          | 'expires_at'
          | 'expiry_basis'
          | 'external_account_id'
          | 'external_location_id'
          | 'external_profile_id'
          | 'external_profile_row_id'
          | 'id'
          | 'observed_at'
          | 'updated_at'
        > &
          Partial<
            Pick<
              GbpFieldProvenanceV1Row,
              | 'connection_generation'
              | 'consent_epoch'
              | 'created_at'
              | 'expires_at'
              | 'expiry_basis'
              | 'external_account_id'
              | 'external_location_id'
              | 'external_profile_id'
              | 'external_profile_row_id'
              | 'id'
              | 'observed_at'
              | 'updated_at'
            >
          >;
        Update: Partial<GbpFieldProvenanceV1Row>;
        Relationships: [
          {
            foreignKeyName: 'gbp_field_provenance_v1_restaurant_id_fkey';
            columns: ['restaurant_id'];
            isOneToOne: false;
            referencedRelation: 'restaurants';
            referencedColumns: ['id'];
          },
        ];
      };
      gbp_notification_event_types_v1: {
        Row: {
          created_at: string;
          event_type: string;
          managed_by_nabatable: boolean;
          registry_id: string;
        };
        Insert: {
          created_at?: string;
          event_type: string;
          managed_by_nabatable?: boolean;
          registry_id: string;
        };
        Update: {
          created_at?: string;
          event_type?: string;
          managed_by_nabatable?: boolean;
          registry_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'gbp_notification_event_types_v1_registry_id_fkey';
            columns: ['registry_id'];
            isOneToOne: false;
            referencedRelation: 'gbp_notification_registries_v1';
            referencedColumns: ['id'];
          },
        ];
      };
      gbp_notification_registries_v1: {
        Row: GbpNotificationRegistryV1Row;
        Insert: Omit<
          GbpNotificationRegistryV1Row,
          | 'created_at'
          | 'id'
          | 'provider'
          | 'provider_notification_setting_id'
          | 'ref_count'
          | 'updated_at'
        > &
          Partial<
            Pick<
              GbpNotificationRegistryV1Row,
              | 'created_at'
              | 'id'
              | 'provider'
              | 'provider_notification_setting_id'
              | 'ref_count'
              | 'updated_at'
            >
          >;
        Update: Partial<GbpNotificationRegistryV1Row>;
        Relationships: [];
      };
      gbp_notification_restaurant_links_v1: {
        Row: {
          connection_generation: number;
          consent_epoch: number;
          created_at: string;
          external_account_id: string;
          external_location_id: string;
          external_profile_id: string;
          external_profile_row_id: string;
          registry_id: string;
          restaurant_id: string;
        };
        Insert: {
          connection_generation: number;
          consent_epoch: number;
          created_at?: string;
          external_account_id: string;
          external_location_id: string;
          external_profile_id: string;
          external_profile_row_id: string;
          registry_id: string;
          restaurant_id: string;
        };
        Update: {
          connection_generation?: number;
          consent_epoch?: number;
          created_at?: string;
          external_account_id?: string;
          external_location_id?: string;
          external_profile_id?: string;
          external_profile_row_id?: string;
          registry_id?: string;
          restaurant_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'gbp_notification_links_v1_registry_account_fkey';
            columns: ['registry_id', 'external_account_id'];
            isOneToOne: false;
            referencedRelation: 'gbp_notification_registries_v1';
            referencedColumns: ['id', 'external_account_id'];
          },
          {
            foreignKeyName: 'gbp_notification_links_v1_connection_fence_fkey';
            columns: [
              'restaurant_id',
              'external_profile_row_id',
              'external_account_id',
              'external_profile_id',
              'external_location_id',
              'connection_generation',
              'consent_epoch',
            ];
            isOneToOne: false;
            referencedRelation: 'restaurant_external_profiles';
            referencedColumns: [
              'restaurant_id',
              'id',
              'external_account_id',
              'external_profile_id',
              'external_location_id',
              'connection_generation',
              'consent_epoch',
            ];
          },
          {
            foreignKeyName: 'gbp_notification_links_v1_profile_tenant_fkey';
            columns: ['restaurant_id', 'external_profile_row_id'];
            isOneToOne: false;
            referencedRelation: 'restaurant_external_profiles';
            referencedColumns: ['restaurant_id', 'id'];
          },
          {
            foreignKeyName: 'gbp_notification_restaurant_links_v1_registry_id_fkey';
            columns: ['registry_id'];
            isOneToOne: false;
            referencedRelation: 'gbp_notification_registries_v1';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'gbp_notification_restaurant_links_v1_restaurant_id_fkey';
            columns: ['restaurant_id'];
            isOneToOne: false;
            referencedRelation: 'restaurants';
            referencedColumns: ['id'];
          },
        ];
      };
      gbp_pubsub_receipts_v1: {
        Row: {
          authentication_result: string;
          connection_generation: number | null;
          consent_epoch: number | null;
          event_hash: string;
          event_type: string | null;
          external_account_id: string | null;
          external_location_id: string | null;
          external_profile_id: string | null;
          external_profile_row_id: string | null;
          idempotency_key: string | null;
          job_id: string | null;
          message_id: string;
          processed_at: string | null;
          processing_result: string;
          received_at: string;
          registry_id: string | null;
          reason_code: string | null;
          restaurant_id: string | null;
          subscription: string;
        };
        Insert: {
          authentication_result: string;
          connection_generation?: number | null;
          consent_epoch?: number | null;
          event_hash: string;
          event_type?: string | null;
          external_account_id?: string | null;
          external_location_id?: string | null;
          external_profile_id?: string | null;
          external_profile_row_id?: string | null;
          idempotency_key?: string | null;
          job_id?: string | null;
          message_id: string;
          processed_at?: string | null;
          processing_result: string;
          received_at?: string;
          registry_id?: string | null;
          reason_code?: string | null;
          restaurant_id?: string | null;
          subscription: string;
        };
        Update: Partial<Database['public']['Tables']['gbp_pubsub_receipts_v1']['Row']>;
        Relationships: [
          {
            foreignKeyName: 'gbp_pubsub_receipts_v1_job_id_fkey';
            columns: ['job_id'];
            isOneToOne: false;
            referencedRelation: 'dual_sync_jobs';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'gbp_pubsub_receipts_v1_profile_tenant_fkey';
            columns: ['restaurant_id', 'external_profile_row_id'];
            isOneToOne: false;
            referencedRelation: 'restaurant_external_profiles';
            referencedColumns: ['restaurant_id', 'id'];
          },
          {
            foreignKeyName: 'gbp_pubsub_receipts_v1_registry_id_fkey';
            columns: ['registry_id'];
            isOneToOne: false;
            referencedRelation: 'gbp_notification_registries_v1';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'gbp_pubsub_receipts_v1_restaurant_id_fkey';
            columns: ['restaurant_id'];
            isOneToOne: false;
            referencedRelation: 'restaurants';
            referencedColumns: ['id'];
          },
        ];
      };
      gbp_pending_update_masks_v1: {
        Row: {
          attribute_paths: string[];
          connection_generation: number;
          consent_epoch: number;
          created_at: string;
          event_id: string;
          expires_at: string;
          external_account_id: string;
          external_location_id: string;
          external_profile_id: string;
          external_profile_row_id: string;
          id: string;
          location_masks: string[];
          observed_at: string;
          restaurant_id: string;
          source_job_id: string | null;
          source_receipt_message_id: string | null;
          source_receipt_subscription: string | null;
          status: string;
          terminal_at: string | null;
          updated_at: string;
        };
        Insert: {
          attribute_paths?: string[];
          connection_generation: number;
          consent_epoch: number;
          created_at?: string;
          event_id: string;
          expires_at: string;
          external_account_id: string;
          external_location_id: string;
          external_profile_id: string;
          external_profile_row_id: string;
          id?: string;
          location_masks?: string[];
          observed_at: string;
          restaurant_id: string;
          source_job_id?: string | null;
          source_receipt_message_id?: string | null;
          source_receipt_subscription?: string | null;
          status?: string;
          terminal_at?: string | null;
          updated_at?: string;
        };
        Update: Partial<Database['public']['Tables']['gbp_pending_update_masks_v1']['Row']>;
        Relationships: [
          {
            foreignKeyName: 'gbp_pending_update_masks_v1_connection_fence_fkey';
            columns: [
              'restaurant_id',
              'external_profile_row_id',
              'external_account_id',
              'external_profile_id',
              'external_location_id',
              'connection_generation',
              'consent_epoch',
            ];
            isOneToOne: false;
            referencedRelation: 'restaurant_external_profiles';
            referencedColumns: [
              'restaurant_id',
              'id',
              'external_account_id',
              'external_profile_id',
              'external_location_id',
              'connection_generation',
              'consent_epoch',
            ];
          },
          {
            foreignKeyName: 'gbp_pending_update_masks_v1_receipt_fkey';
            columns: ['source_receipt_subscription', 'source_receipt_message_id'];
            isOneToOne: false;
            referencedRelation: 'gbp_pubsub_receipts_v1';
            referencedColumns: ['subscription', 'message_id'];
          },
          {
            foreignKeyName: 'gbp_pending_update_masks_v1_source_job_id_fkey';
            columns: ['source_job_id'];
            isOneToOne: false;
            referencedRelation: 'dual_sync_jobs';
            referencedColumns: ['id'];
          },
        ];
      };
      gbp_terminal_outcome_notices_v1: {
        Row: {
          attempt_count: number;
          available_at: string;
          claimed_by: string | null;
          created_at: string;
          delivered_at: string | null;
          delivery_channel: string | null;
          dispatch_key: string | null;
          dispatched_at: string | null;
          due_at: string;
          event_id: string;
          failed_at: string | null;
          grant_id: string;
          id: string;
          last_error_code: string | null;
          lease_expires_at: string | null;
          lease_token: string | null;
          max_attempts: number;
          outcome_unknown_at: string | null;
          requires_fresh_preview: boolean;
          restaurant_id: string;
          safe_reason_code: string;
          status: string;
          terminal_at: string;
          terminal_kind: string;
          updated_at: string;
        };
        Insert: {
          attempt_count?: number;
          available_at?: string;
          claimed_by?: string | null;
          created_at?: string;
          delivered_at?: string | null;
          delivery_channel?: string | null;
          dispatch_key?: string | null;
          dispatched_at?: string | null;
          due_at: string;
          event_id: string;
          failed_at?: string | null;
          grant_id: string;
          id?: string;
          last_error_code?: string | null;
          lease_expires_at?: string | null;
          lease_token?: string | null;
          max_attempts?: number;
          outcome_unknown_at?: string | null;
          requires_fresh_preview: boolean;
          restaurant_id: string;
          safe_reason_code: string;
          status?: string;
          terminal_at: string;
          terminal_kind: string;
          updated_at?: string;
        };
        Update: Partial<Database['public']['Tables']['gbp_terminal_outcome_notices_v1']['Row']>;
        Relationships: [
          {
            foreignKeyName: 'gbp_terminal_outcome_notices_v1_grant_fkey';
            columns: ['restaurant_id', 'grant_id'];
            isOneToOne: false;
            referencedRelation: 'gbp_write_grants_v1';
            referencedColumns: ['restaurant_id', 'id'];
          },
        ];
      };
      gbp_terminal_notice_delivery_attempts_v1: {
        Row: {
          attempt_number: number;
          channel: string;
          created_at: string;
          dispatch_key: string;
          dispatched_at: string;
          id: string;
          lease_token: string;
          notice_id: string;
          restaurant_id: string;
          safe_error_code: string | null;
          status: string;
          terminal_at: string | null;
          updated_at: string;
          worker_id: string;
        };
        Insert: {
          attempt_number: number;
          channel?: string;
          created_at?: string;
          dispatch_key: string;
          dispatched_at: string;
          id?: string;
          lease_token: string;
          notice_id: string;
          restaurant_id: string;
          safe_error_code?: string | null;
          status?: string;
          terminal_at?: string | null;
          updated_at?: string;
          worker_id: string;
        };
        Update: Partial<
          Database['public']['Tables']['gbp_terminal_notice_delivery_attempts_v1']['Row']
        >;
        Relationships: [
          {
            foreignKeyName: 'gbp_terminal_notice_delivery_attempts_v1_notice_fkey';
            columns: ['restaurant_id', 'notice_id'];
            isOneToOne: false;
            referencedRelation: 'gbp_terminal_outcome_notices_v1';
            referencedColumns: ['restaurant_id', 'id'];
          },
        ];
      };
      gbp_write_allowlist_v1: {
        Row: {
          added_by_user_id: string | null;
          created_at: string;
          enabled: boolean;
          restaurant_id: string;
        };
        Insert: {
          added_by_user_id?: string | null;
          created_at?: string;
          enabled?: boolean;
          restaurant_id: string;
        };
        Update: {
          added_by_user_id?: string | null;
          created_at?: string;
          enabled?: boolean;
          restaurant_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'gbp_write_allowlist_v1_restaurant_id_fkey';
            columns: ['restaurant_id'];
            isOneToOne: true;
            referencedRelation: 'restaurants';
            referencedColumns: ['id'];
          },
        ];
      };
      gbp_write_canary_restaurants_v1: {
        Row: {
          added_by_user_id: string | null;
          created_at: string;
          enabled: boolean;
          restaurant_id: string;
        };
        Insert: {
          added_by_user_id?: string | null;
          created_at?: string;
          enabled?: boolean;
          restaurant_id: string;
        };
        Update: {
          added_by_user_id?: string | null;
          created_at?: string;
          enabled?: boolean;
          restaurant_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'gbp_write_canary_restaurants_v1_restaurant_id_fkey';
            columns: ['restaurant_id'];
            isOneToOne: true;
            referencedRelation: 'restaurants';
            referencedColumns: ['id'];
          },
        ];
      };
      gbp_write_grants_v1: {
        Row: GbpWriteGrantV1Row;
        Insert: Omit<
          GbpWriteGrantV1Row,
          | 'claimed_at'
          | 'created_at'
          | 'dispatched_at'
          | 'execution_id'
          | 'id'
          | 'provider'
          | 'reason_code'
          | 'status'
          | 'terminal_at'
        > &
          Partial<
            Pick<
              GbpWriteGrantV1Row,
              | 'claimed_at'
              | 'created_at'
              | 'dispatched_at'
              | 'execution_id'
              | 'id'
              | 'provider'
              | 'reason_code'
              | 'status'
              | 'terminal_at'
            >
          >;
        Update: Partial<GbpWriteGrantV1Row>;
        Relationships: [
          {
            foreignKeyName: 'gbp_write_grants_v1_profile_tenant_fkey';
            columns: ['restaurant_id', 'external_profile_row_id'];
            isOneToOne: false;
            referencedRelation: 'restaurant_external_profiles';
            referencedColumns: ['restaurant_id', 'id'];
          },
          {
            foreignKeyName: 'gbp_write_grants_v1_restaurant_id_fkey';
            columns: ['restaurant_id'];
            isOneToOne: false;
            referencedRelation: 'restaurants';
            referencedColumns: ['id'];
          },
        ];
      };
      gbp_write_policy_config_v1: {
        Row: {
          approved_at: string;
          approved_by_user_id: string;
          backup_window_days: number;
          created_at: string;
          policy_version: string;
          proven_content_ttl_days: number;
          provider: string;
          renderer_version: string;
        };
        Insert: {
          approved_at: string;
          approved_by_user_id: string;
          backup_window_days: number;
          created_at?: string;
          policy_version: string;
          proven_content_ttl_days: number;
          provider?: string;
          renderer_version: string;
        };
        Update: {
          approved_at?: string;
          approved_by_user_id?: string;
          backup_window_days?: number;
          created_at?: string;
          policy_version?: string;
          proven_content_ttl_days?: number;
          provider?: string;
          renderer_version?: string;
        };
        Relationships: [];
      };
      gbp_write_rollout_config_v1: {
        Row: {
          provider: string;
          rollout_mode: string;
          updated_at: string;
          updated_by_user_id: string | null;
        };
        Insert: {
          provider?: string;
          rollout_mode?: string;
          updated_at?: string;
          updated_by_user_id?: string | null;
        };
        Update: {
          provider?: string;
          rollout_mode?: string;
          updated_at?: string;
          updated_by_user_id?: string | null;
        };
        Relationships: [];
      };
      gbp_write_readiness_evidence_v1: {
        Row: {
          backup_restore_verified_at: string;
          backup_window_days: number;
          evidence_hash: string;
          id: string;
          issued_at: string;
          issued_by_user_id: string;
          live_content_ttl_days: number;
          pitr_verified_at: string;
          policy_approved_at: string;
          policy_version: string;
          provider: string;
          renderer_version: string;
          transformed_content_approved_at: string;
          valid_until: string;
        };
        Insert: {
          backup_restore_verified_at: string;
          backup_window_days: number;
          evidence_hash?: string;
          id?: string;
          issued_at?: string;
          issued_by_user_id: string;
          live_content_ttl_days: number;
          pitr_verified_at: string;
          policy_approved_at: string;
          policy_version: string;
          provider?: string;
          renderer_version: string;
          transformed_content_approved_at: string;
          valid_until: string;
        };
        Update: Partial<Database['public']['Tables']['gbp_write_readiness_evidence_v1']['Row']>;
        Relationships: [];
      };
      restaurant_external_profiles: {
        Row: {
          connection_generation: number;
          connection_status: string;
          consent_epoch: number;
          created_at: string;
          external_account_id: string | null;
          external_account_name: string | null;
          external_location_id: string | null;
          external_location_name: string | null;
          external_location_title: string | null;
          external_place_id: string | null;
          external_profile_id: string | null;
          external_resource_name: string | null;
          id: string;
          last_pull_at: string | null;
          last_push_at: string | null;
          last_error: string | null;
          provider: string;
          provider_timezone: string | null;
          pull_enabled: boolean;
          push_enabled: boolean;
          restaurant_id: string;
          sync_enabled: boolean;
          updated_at: string;
          write_state: string;
          write_state_actor_user_id: string | null;
          write_state_changed_at: string;
          write_state_reason_code: string | null;
        };
        Insert: {
          connection_generation?: number;
          connection_status?: string;
          consent_epoch?: number;
          created_at?: string;
          external_account_id?: string | null;
          external_account_name?: string | null;
          external_location_id?: string | null;
          external_location_name?: string | null;
          external_location_title?: string | null;
          external_place_id?: string | null;
          external_profile_id?: string | null;
          external_resource_name?: string | null;
          id?: string;
          last_pull_at?: string | null;
          last_push_at?: string | null;
          last_error?: string | null;
          provider: string;
          provider_timezone?: string | null;
          pull_enabled?: boolean;
          push_enabled?: boolean;
          restaurant_id: string;
          sync_enabled?: boolean;
          updated_at?: string;
          write_state?: string;
          write_state_actor_user_id?: string | null;
          write_state_changed_at?: string;
          write_state_reason_code?: string | null;
        };
        Update: {
          connection_generation?: number;
          connection_status?: string;
          consent_epoch?: number;
          created_at?: string;
          external_account_id?: string | null;
          external_account_name?: string | null;
          external_location_id?: string | null;
          external_location_name?: string | null;
          external_location_title?: string | null;
          external_place_id?: string | null;
          external_profile_id?: string | null;
          external_resource_name?: string | null;
          id?: string;
          last_pull_at?: string | null;
          last_push_at?: string | null;
          last_error?: string | null;
          provider?: string;
          provider_timezone?: string | null;
          pull_enabled?: boolean;
          push_enabled?: boolean;
          restaurant_id?: string;
          sync_enabled?: boolean;
          updated_at?: string;
          write_state?: string;
          write_state_actor_user_id?: string | null;
          write_state_changed_at?: string;
          write_state_reason_code?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'restaurant_external_profiles_restaurant_id_fkey';
            columns: ['restaurant_id'];
            isOneToOne: false;
            referencedRelation: 'restaurants';
            referencedColumns: ['id'];
          },
        ];
      };
      restaurant_addresses: {
        Row: {
          address_type: string;
          address_lines: Json;
          administrative_area: string | null;
          country_code: string | null;
          change_origin: string | null;
          change_reason: string | null;
          changed_by_user_id: string | null;
          changed_via: string | null;
          created_at: string;
          display_order: number;
          formatted_address: string | null;
          id: string;
          is_primary: boolean;
          last_manual_override_at: string | null;
          last_synced_at: string | null;
          language_code: string | null;
          latitude: number | null;
          latlng_json: Json;
          longitude: number | null;
          locality: string | null;
          managed_by: string;
          organization: string | null;
          postal_code: string | null;
          recipients: Json;
          region_code: string | null;
          restaurant_id: string;
          source: string;
          source_record_id: string | null;
          sorting_code: string | null;
          sublocality: string | null;
          updated_at: string;
        };
        Insert: {
          address_type?: string;
          address_lines?: Json;
          administrative_area?: string | null;
          country_code?: string | null;
          change_origin?: string | null;
          change_reason?: string | null;
          changed_by_user_id?: string | null;
          changed_via?: string | null;
          created_at?: string;
          display_order?: number;
          formatted_address?: string | null;
          id?: string;
          is_primary?: boolean;
          last_manual_override_at?: string | null;
          last_synced_at?: string | null;
          language_code?: string | null;
          latitude?: number | null;
          latlng_json?: Json;
          longitude?: number | null;
          locality?: string | null;
          managed_by?: string;
          organization?: string | null;
          postal_code?: string | null;
          recipients?: Json;
          region_code?: string | null;
          restaurant_id: string;
          source?: string;
          source_record_id?: string | null;
          sorting_code?: string | null;
          sublocality?: string | null;
          updated_at?: string;
        };
        Update: {
          address_type?: string;
          address_lines?: Json;
          administrative_area?: string | null;
          country_code?: string | null;
          change_origin?: string | null;
          change_reason?: string | null;
          changed_by_user_id?: string | null;
          changed_via?: string | null;
          created_at?: string;
          display_order?: number;
          formatted_address?: string | null;
          id?: string;
          is_primary?: boolean;
          last_manual_override_at?: string | null;
          last_synced_at?: string | null;
          language_code?: string | null;
          latitude?: number | null;
          latlng_json?: Json;
          longitude?: number | null;
          locality?: string | null;
          managed_by?: string;
          organization?: string | null;
          postal_code?: string | null;
          recipients?: Json;
          region_code?: string | null;
          restaurant_id?: string;
          source?: string;
          source_record_id?: string | null;
          sorting_code?: string | null;
          sublocality?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'restaurant_addresses_restaurant_id_fkey';
            columns: ['restaurant_id'];
            isOneToOne: false;
            referencedRelation: 'restaurants';
            referencedColumns: ['id'];
          },
        ];
      };
      restaurant_attribute_definitions: {
        Row: {
          allowed_values: Json;
          attribute_key: string;
          category_ids: string[];
          country_code: string | null;
          created_at: string;
          display_name: string | null;
          expected_value_type: string;
          first_seen_at: string;
          group_name: string | null;
          id: string;
          is_deprecated: boolean;
          last_seen_at: string;
          provider: string;
          provider_attribute_id: string | null;
          raw_definition_json: Json;
          updated_at: string;
        };
        Insert: {
          allowed_values?: Json;
          attribute_key: string;
          category_ids?: string[];
          country_code?: string | null;
          created_at?: string;
          display_name?: string | null;
          expected_value_type?: string;
          first_seen_at?: string;
          group_name?: string | null;
          id?: string;
          is_deprecated?: boolean;
          last_seen_at?: string;
          provider?: string;
          provider_attribute_id?: string | null;
          raw_definition_json?: Json;
          updated_at?: string;
        };
        Update: {
          allowed_values?: Json;
          attribute_key?: string;
          category_ids?: string[];
          country_code?: string | null;
          created_at?: string;
          display_name?: string | null;
          expected_value_type?: string;
          first_seen_at?: string;
          group_name?: string | null;
          id?: string;
          is_deprecated?: boolean;
          last_seen_at?: string;
          provider?: string;
          provider_attribute_id?: string | null;
          raw_definition_json?: Json;
          updated_at?: string;
        };
        Relationships: [];
      };
      restaurant_attributes: {
        Row: {
          attribute_definition_id: string | null;
          attribute_id: string | null;
          attribute_name: string | null;
          attribute_group: string | null;
          attribute_key: string;
          bool_value: boolean | null;
          change_origin: string | null;
          change_reason: string | null;
          changed_by_user_id: string | null;
          changed_via: string | null;
          created_at: string;
          display_name: string | null;
          display_order: number;
          display_text_negative: string | null;
          display_text_standalone: string | null;
          display_text: string | null;
          display_value_json: Json;
          enum_values: Json;
          id: string;
          last_manual_override_at: string | null;
          last_synced_at: string | null;
          managed_by: string;
          restaurant_id: string;
          raw_enum_values_json: Json;
          raw_value_json: Json;
          source: string;
          source_record_id: string | null;
          text_value: string | null;
          unset_enum_values: Json;
          updated_at: string;
          uri_value: string | null;
          uri_values: Json;
          value_metadata_json: Json;
          value_type: string;
        };
        Insert: {
          attribute_definition_id?: string | null;
          attribute_id?: string | null;
          attribute_name?: string | null;
          attribute_group?: string | null;
          attribute_key: string;
          bool_value?: boolean | null;
          change_origin?: string | null;
          change_reason?: string | null;
          changed_by_user_id?: string | null;
          changed_via?: string | null;
          created_at?: string;
          display_name?: string | null;
          display_order?: number;
          display_text_negative?: string | null;
          display_text_standalone?: string | null;
          display_text?: string | null;
          display_value_json?: Json;
          enum_values?: Json;
          id?: string;
          last_manual_override_at?: string | null;
          last_synced_at?: string | null;
          managed_by?: string;
          restaurant_id: string;
          raw_enum_values_json?: Json;
          raw_value_json?: Json;
          source?: string;
          source_record_id?: string | null;
          text_value?: string | null;
          unset_enum_values?: Json;
          updated_at?: string;
          uri_value?: string | null;
          uri_values?: Json;
          value_metadata_json?: Json;
          value_type: string;
        };
        Update: {
          attribute_definition_id?: string | null;
          attribute_id?: string | null;
          attribute_name?: string | null;
          attribute_group?: string | null;
          attribute_key?: string;
          bool_value?: boolean | null;
          change_origin?: string | null;
          change_reason?: string | null;
          changed_by_user_id?: string | null;
          changed_via?: string | null;
          created_at?: string;
          display_name?: string | null;
          display_order?: number;
          display_text_negative?: string | null;
          display_text_standalone?: string | null;
          display_text?: string | null;
          display_value_json?: Json;
          enum_values?: Json;
          id?: string;
          last_manual_override_at?: string | null;
          last_synced_at?: string | null;
          managed_by?: string;
          restaurant_id?: string;
          raw_enum_values_json?: Json;
          raw_value_json?: Json;
          source?: string;
          source_record_id?: string | null;
          text_value?: string | null;
          unset_enum_values?: Json;
          updated_at?: string;
          uri_value?: string | null;
          uri_values?: Json;
          value_metadata_json?: Json;
          value_type?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'restaurant_attributes_attribute_definition_id_fkey';
            columns: ['attribute_definition_id'];
            isOneToOne: false;
            referencedRelation: 'restaurant_attribute_definitions';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'restaurant_attributes_restaurant_id_fkey';
            columns: ['restaurant_id'];
            isOneToOne: false;
            referencedRelation: 'restaurants';
            referencedColumns: ['id'];
          },
        ];
      };
      restaurant_business_details: {
        Row: {
          business_name: string | null;
          business_status: string | null;
          can_reopen: boolean | null;
          change_origin: string | null;
          change_reason: string | null;
          changed_by_user_id: string | null;
          changed_via: string | null;
          created_at: string;
          description: string | null;
          id: string;
          is_service_area_business: boolean;
          last_manual_override_at: string | null;
          last_synced_at: string | null;
          language_code: string | null;
          managed_by: string;
          opening_date: string | null;
          restaurant_id: string;
          source: string;
          source_record_id: string | null;
          updated_at: string;
        };
        Insert: {
          business_name?: string | null;
          business_status?: string | null;
          can_reopen?: boolean | null;
          change_origin?: string | null;
          change_reason?: string | null;
          changed_by_user_id?: string | null;
          changed_via?: string | null;
          created_at?: string;
          description?: string | null;
          id?: string;
          is_service_area_business?: boolean;
          last_manual_override_at?: string | null;
          last_synced_at?: string | null;
          language_code?: string | null;
          managed_by?: string;
          opening_date?: string | null;
          restaurant_id: string;
          source?: string;
          source_record_id?: string | null;
          updated_at?: string;
        };
        Update: {
          business_name?: string | null;
          business_status?: string | null;
          can_reopen?: boolean | null;
          change_origin?: string | null;
          change_reason?: string | null;
          changed_by_user_id?: string | null;
          changed_via?: string | null;
          created_at?: string;
          description?: string | null;
          id?: string;
          is_service_area_business?: boolean;
          last_manual_override_at?: string | null;
          last_synced_at?: string | null;
          language_code?: string | null;
          managed_by?: string;
          opening_date?: string | null;
          restaurant_id?: string;
          source?: string;
          source_record_id?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'restaurant_business_details_restaurant_id_fkey';
            columns: ['restaurant_id'];
            isOneToOne: false;
            referencedRelation: 'restaurants';
            referencedColumns: ['id'];
          },
        ];
      };
      restaurant_categories: {
        Row: {
          category_code: string | null;
          change_origin: string | null;
          change_reason: string | null;
          changed_by_user_id: string | null;
          changed_via: string | null;
          created_at: string;
          display_order: number;
          display_name: string;
          id: string;
          is_primary: boolean;
          last_manual_override_at: string | null;
          last_synced_at: string | null;
          managed_by: string;
          more_hours_types_json: Json;
          restaurant_id: string;
          source: string;
          source_record_id: string | null;
          updated_at: string;
        };
        Insert: {
          category_code?: string | null;
          change_origin?: string | null;
          change_reason?: string | null;
          changed_by_user_id?: string | null;
          changed_via?: string | null;
          created_at?: string;
          display_name: string;
          display_order?: number;
          id?: string;
          is_primary?: boolean;
          last_manual_override_at?: string | null;
          last_synced_at?: string | null;
          managed_by?: string;
          more_hours_types_json?: Json;
          restaurant_id: string;
          source?: string;
          source_record_id?: string | null;
          updated_at?: string;
        };
        Update: {
          category_code?: string | null;
          change_origin?: string | null;
          change_reason?: string | null;
          changed_by_user_id?: string | null;
          changed_via?: string | null;
          created_at?: string;
          display_name?: string;
          display_order?: number;
          id?: string;
          is_primary?: boolean;
          last_manual_override_at?: string | null;
          last_synced_at?: string | null;
          managed_by?: string;
          more_hours_types_json?: Json;
          restaurant_id?: string;
          source?: string;
          source_record_id?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'restaurant_categories_restaurant_id_fkey';
            columns: ['restaurant_id'];
            isOneToOne: false;
            referencedRelation: 'restaurants';
            referencedColumns: ['id'];
          },
        ];
      };
      restaurant_hours: {
        Row: {
          close_day: number | null;
          close_time: string | null;
          change_origin: string | null;
          change_reason: string | null;
          changed_by_user_id: string | null;
          changed_via: string | null;
          created_at: string;
          display_order: number;
          end_date: string | null;
          hours_type: string;
          id: string;
          is_closed: boolean;
          last_manual_override_at: string | null;
          last_synced_at: string | null;
          managed_by: string;
          open_day: number | null;
          open_time: string | null;
          period_code: string | null;
          period_label: string | null;
          restaurant_id: string;
          source: string;
          source_record_id: string | null;
          start_date: string | null;
          updated_at: string;
        };
        Insert: {
          close_day?: number | null;
          close_time?: string | null;
          change_origin?: string | null;
          change_reason?: string | null;
          changed_by_user_id?: string | null;
          changed_via?: string | null;
          created_at?: string;
          display_order?: number;
          end_date?: string | null;
          hours_type: string;
          id?: string;
          is_closed?: boolean;
          last_manual_override_at?: string | null;
          last_synced_at?: string | null;
          managed_by?: string;
          open_day?: number | null;
          open_time?: string | null;
          period_code?: string | null;
          period_label?: string | null;
          restaurant_id: string;
          source?: string;
          source_record_id?: string | null;
          start_date?: string | null;
          updated_at?: string;
        };
        Update: {
          close_day?: number | null;
          close_time?: string | null;
          change_origin?: string | null;
          change_reason?: string | null;
          changed_by_user_id?: string | null;
          changed_via?: string | null;
          created_at?: string;
          display_order?: number;
          end_date?: string | null;
          hours_type?: string;
          id?: string;
          is_closed?: boolean;
          last_manual_override_at?: string | null;
          last_synced_at?: string | null;
          managed_by?: string;
          open_day?: number | null;
          open_time?: string | null;
          period_code?: string | null;
          period_label?: string | null;
          restaurant_id?: string;
          source?: string;
          source_record_id?: string | null;
          start_date?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'restaurant_hours_restaurant_id_fkey';
            columns: ['restaurant_id'];
            isOneToOne: false;
            referencedRelation: 'restaurants';
            referencedColumns: ['id'];
          },
        ];
      };
      restaurant_links: {
        Row: {
          change_origin: string | null;
          change_reason: string | null;
          changed_by_user_id: string | null;
          changed_via: string | null;
          created_at: string;
          display_order: number;
          id: string;
          is_primary: boolean;
          last_manual_override_at: string | null;
          last_synced_at: string | null;
          label: string | null;
          link_status: string;
          link_type: string;
          managed_by: string;
          restaurant_id: string;
          source: string;
          source_record_id: string | null;
          updated_at: string;
          url: string;
        };
        Insert: {
          change_origin?: string | null;
          change_reason?: string | null;
          changed_by_user_id?: string | null;
          changed_via?: string | null;
          created_at?: string;
          display_order?: number;
          id?: string;
          is_primary?: boolean;
          last_manual_override_at?: string | null;
          last_synced_at?: string | null;
          label?: string | null;
          link_status?: string;
          link_type: string;
          managed_by?: string;
          restaurant_id: string;
          source?: string;
          source_record_id?: string | null;
          updated_at?: string;
          url: string;
        };
        Update: {
          change_origin?: string | null;
          change_reason?: string | null;
          changed_by_user_id?: string | null;
          changed_via?: string | null;
          created_at?: string;
          display_order?: number;
          id?: string;
          is_primary?: boolean;
          last_manual_override_at?: string | null;
          last_synced_at?: string | null;
          label?: string | null;
          link_status?: string;
          link_type?: string;
          managed_by?: string;
          restaurant_id?: string;
          source?: string;
          source_record_id?: string | null;
          updated_at?: string;
          url?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'restaurant_links_restaurant_id_fkey';
            columns: ['restaurant_id'];
            isOneToOne: false;
            referencedRelation: 'restaurants';
            referencedColumns: ['id'];
          },
        ];
      };
      restaurant_phone_numbers: {
        Row: {
          change_origin: string | null;
          change_reason: string | null;
          changed_by_user_id: string | null;
          changed_via: string | null;
          created_at: string;
          display_order: number;
          id: string;
          is_primary: boolean;
          last_manual_override_at: string | null;
          last_synced_at: string | null;
          managed_by: string;
          phone_kind: string;
          phone_number: string;
          restaurant_id: string;
          source: string;
          source_record_id: string | null;
          updated_at: string;
        };
        Insert: {
          change_origin?: string | null;
          change_reason?: string | null;
          changed_by_user_id?: string | null;
          changed_via?: string | null;
          created_at?: string;
          display_order?: number;
          id?: string;
          is_primary?: boolean;
          last_manual_override_at?: string | null;
          last_synced_at?: string | null;
          managed_by?: string;
          phone_kind: string;
          phone_number: string;
          restaurant_id: string;
          source?: string;
          source_record_id?: string | null;
          updated_at?: string;
        };
        Update: {
          change_origin?: string | null;
          change_reason?: string | null;
          changed_by_user_id?: string | null;
          changed_via?: string | null;
          created_at?: string;
          display_order?: number;
          id?: string;
          is_primary?: boolean;
          last_manual_override_at?: string | null;
          last_synced_at?: string | null;
          managed_by?: string;
          phone_kind?: string;
          phone_number?: string;
          restaurant_id?: string;
          source?: string;
          source_record_id?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'restaurant_phone_numbers_restaurant_id_fkey';
            columns: ['restaurant_id'];
            isOneToOne: false;
            referencedRelation: 'restaurants';
            referencedColumns: ['id'];
          },
        ];
      };
      restaurant_service_areas: {
        Row: {
          area_type: string;
          change_origin: string | null;
          change_reason: string | null;
          changed_by_user_id: string | null;
          changed_via: string | null;
          created_at: string;
          display_order: number;
          display_name: string;
          id: string;
          google_place_id: string | null;
          google_place_resource_name: string | null;
          last_manual_override_at: string | null;
          last_synced_at: string | null;
          managed_by: string;
          place_data_json: Json;
          region_code: string | null;
          restaurant_id: string;
          source: string;
          source_record_id: string | null;
          updated_at: string;
        };
        Insert: {
          area_type?: string;
          change_origin?: string | null;
          change_reason?: string | null;
          changed_by_user_id?: string | null;
          changed_via?: string | null;
          created_at?: string;
          display_order?: number;
          display_name: string;
          id?: string;
          google_place_id?: string | null;
          google_place_resource_name?: string | null;
          last_manual_override_at?: string | null;
          last_synced_at?: string | null;
          managed_by?: string;
          place_data_json?: Json;
          region_code?: string | null;
          restaurant_id: string;
          source?: string;
          source_record_id?: string | null;
          updated_at?: string;
        };
        Update: {
          area_type?: string;
          change_origin?: string | null;
          change_reason?: string | null;
          changed_by_user_id?: string | null;
          changed_via?: string | null;
          created_at?: string;
          display_order?: number;
          display_name?: string;
          id?: string;
          google_place_id?: string | null;
          google_place_resource_name?: string | null;
          last_manual_override_at?: string | null;
          last_synced_at?: string | null;
          managed_by?: string;
          place_data_json?: Json;
          region_code?: string | null;
          restaurant_id?: string;
          source?: string;
          source_record_id?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'restaurant_service_areas_restaurant_id_fkey';
            columns: ['restaurant_id'];
            isOneToOne: false;
            referencedRelation: 'restaurants';
            referencedColumns: ['id'];
          },
        ];
      };
      restaurant_service_items: {
        Row: {
          change_origin: string | null;
          change_reason: string | null;
          changed_by_user_id: string | null;
          changed_via: string | null;
          created_at: string;
          description: string | null;
          display_name: string | null;
          display_order: number;
          id: string;
          item_key: string;
          item_type: string | null;
          last_manual_override_at: string | null;
          last_synced_at: string | null;
          managed_by: string;
          payload_json: Json;
          restaurant_id: string;
          source: string;
          source_record_id: string | null;
          updated_at: string;
        };
        Insert: {
          change_origin?: string | null;
          change_reason?: string | null;
          changed_by_user_id?: string | null;
          changed_via?: string | null;
          created_at?: string;
          description?: string | null;
          display_name?: string | null;
          display_order?: number;
          id?: string;
          item_key: string;
          item_type?: string | null;
          last_manual_override_at?: string | null;
          last_synced_at?: string | null;
          managed_by?: string;
          payload_json?: Json;
          restaurant_id: string;
          source?: string;
          source_record_id?: string | null;
          updated_at?: string;
        };
        Update: {
          change_origin?: string | null;
          change_reason?: string | null;
          changed_by_user_id?: string | null;
          changed_via?: string | null;
          created_at?: string;
          description?: string | null;
          display_name?: string | null;
          display_order?: number;
          id?: string;
          item_key?: string;
          item_type?: string | null;
          last_manual_override_at?: string | null;
          last_synced_at?: string | null;
          managed_by?: string;
          payload_json?: Json;
          restaurant_id?: string;
          source?: string;
          source_record_id?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'restaurant_service_items_restaurant_id_fkey';
            columns: ['restaurant_id'];
            isOneToOne: false;
            referencedRelation: 'restaurants';
            referencedColumns: ['id'];
          },
        ];
      };
      restaurant_profile_change_log: {
        Row: {
          applied_at: string | null;
          change_origin: string | null;
          change_reason: string | null;
          changed_by_user_id: string | null;
          changed_via: string | null;
          created_at: string;
          decision_id: string | null;
          detected_at: string;
          draft_id: string | null;
          entity_id: string | null;
          entity_table: string;
          external_profile_id: string | null;
          external_provider: string | null;
          external_sync_run_id: string | null;
          field_path: string;
          id: string;
          metadata: Json;
          new_value: Json | null;
          old_value: Json | null;
          publish_event_id: string | null;
          publish_job_id: string | null;
          restaurant_id: string;
          status: string;
          updated_at: string;
          valid_from: string | null;
          valid_to: string | null;
        };
        Insert: {
          applied_at?: string | null;
          change_origin?: string | null;
          change_reason?: string | null;
          changed_by_user_id?: string | null;
          changed_via?: string | null;
          created_at?: string;
          decision_id?: string | null;
          detected_at?: string;
          draft_id?: string | null;
          entity_id?: string | null;
          entity_table: string;
          external_profile_id?: string | null;
          external_provider?: string | null;
          external_sync_run_id?: string | null;
          field_path: string;
          id?: string;
          metadata?: Json;
          new_value?: Json | null;
          old_value?: Json | null;
          publish_event_id?: string | null;
          publish_job_id?: string | null;
          restaurant_id: string;
          status?: string;
          updated_at?: string;
          valid_from?: string | null;
          valid_to?: string | null;
        };
        Update: {
          applied_at?: string | null;
          change_origin?: string | null;
          change_reason?: string | null;
          changed_by_user_id?: string | null;
          changed_via?: string | null;
          created_at?: string;
          decision_id?: string | null;
          detected_at?: string;
          draft_id?: string | null;
          entity_id?: string | null;
          entity_table?: string;
          external_profile_id?: string | null;
          external_provider?: string | null;
          external_sync_run_id?: string | null;
          field_path?: string;
          id?: string;
          metadata?: Json;
          new_value?: Json | null;
          old_value?: Json | null;
          publish_event_id?: string | null;
          publish_job_id?: string | null;
          restaurant_id?: string;
          status?: string;
          updated_at?: string;
          valid_from?: string | null;
          valid_to?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'restaurant_profile_change_log_external_profile_id_fkey';
            columns: ['external_profile_id'];
            isOneToOne: false;
            referencedRelation: 'restaurant_external_profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'restaurant_profile_change_log_external_sync_run_id_fkey';
            columns: ['external_sync_run_id'];
            isOneToOne: false;
            referencedRelation: 'restaurant_external_profile_sync_runs';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'restaurant_profile_change_log_restaurant_id_fkey';
            columns: ['restaurant_id'];
            isOneToOne: false;
            referencedRelation: 'restaurants';
            referencedColumns: ['id'];
          },
        ];
      };
      restaurants: {
        Row: {
          address: string | null;
          booking_policy: string | null;
          capacity: number | null;
          contact_email: string | null;
          contact_phone: string | null;
          created_at: string;
          email_send_reminder_24h: boolean;
          email_send_reminder_short: boolean;
          email_send_review_request: boolean;
          email_templates: Json | null;
          google_map_url: string | null;
          google_review_url: string | null;
          id: string;
          is_active: boolean;
          logo_url: string | null;
          manager_daily_summary_enabled: boolean;
          manager_name: string | null;
          manager_notification_phone: string | null;
          manager_whatsapp_consent_actor_id: string | null;
          manager_whatsapp_consent_phone: string | null;
          manager_whatsapp_consent_version: string | null;
          manager_whatsapp_enabled: boolean;
          manager_whatsapp_opt_in_at: string | null;
          monthly_report_enabled: boolean;
          name: string;
          reservation_default_duration_minutes: number;
          reservation_interval_minutes: number;
          reservation_last_seating_buffer_minutes: number;
          reservation_lifecycle_grace_minutes: number | null;
          slug: string;
          sms_display_name: string | null;
          timezone: string;
          updated_at: string;
        };
        Insert: {
          address?: string | null;
          booking_policy?: string | null;
          capacity?: number | null;
          contact_email?: string | null;
          contact_phone?: string | null;
          created_at?: string;
          email_send_reminder_24h?: boolean;
          email_send_reminder_short?: boolean;
          email_send_review_request?: boolean;
          email_templates?: Json | null;
          google_map_url?: string | null;
          google_review_url?: string | null;
          id?: string;
          is_active?: boolean;
          logo_url?: string | null;
          manager_daily_summary_enabled?: boolean;
          manager_name?: string | null;
          manager_notification_phone?: string | null;
          manager_whatsapp_consent_actor_id?: string | null;
          manager_whatsapp_consent_phone?: string | null;
          manager_whatsapp_consent_version?: string | null;
          manager_whatsapp_enabled?: boolean;
          manager_whatsapp_opt_in_at?: string | null;
          monthly_report_enabled?: boolean;
          name: string;
          reservation_default_duration_minutes?: number;
          reservation_interval_minutes?: number;
          reservation_last_seating_buffer_minutes?: number;
          reservation_lifecycle_grace_minutes?: number | null;
          slug: string;
          sms_display_name?: string | null;
          timezone?: string;
          updated_at?: string;
        };
        Update: {
          address?: string | null;
          booking_policy?: string | null;
          capacity?: number | null;
          contact_email?: string | null;
          contact_phone?: string | null;
          created_at?: string;
          email_send_reminder_24h?: boolean;
          email_send_reminder_short?: boolean;
          email_send_review_request?: boolean;
          email_templates?: Json | null;
          google_map_url?: string | null;
          google_review_url?: string | null;
          id?: string;
          is_active?: boolean;
          logo_url?: string | null;
          manager_daily_summary_enabled?: boolean;
          manager_name?: string | null;
          manager_notification_phone?: string | null;
          manager_whatsapp_consent_actor_id?: string | null;
          manager_whatsapp_consent_phone?: string | null;
          manager_whatsapp_consent_version?: string | null;
          manager_whatsapp_enabled?: boolean;
          manager_whatsapp_opt_in_at?: string | null;
          monthly_report_enabled?: boolean;
          name?: string;
          reservation_default_duration_minutes?: number;
          reservation_interval_minutes?: number;
          reservation_last_seating_buffer_minutes?: number;
          reservation_lifecycle_grace_minutes?: number | null;
          slug?: string;
          sms_display_name?: string | null;
          timezone?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      service_policy: {
        Row: {
          allow_after_hours: boolean;
          clean_buffer_minutes: number;
          created_at: string;
          dinner_end: string;
          dinner_start: string;
          id: string;
          lunch_end: string;
          lunch_start: string;
          updated_at: string;
        };
        Insert: {
          allow_after_hours?: boolean;
          clean_buffer_minutes?: number;
          created_at?: string;
          dinner_end?: string;
          dinner_start?: string;
          id?: string;
          lunch_end?: string;
          lunch_start?: string;
          updated_at?: string;
        };
        Update: {
          allow_after_hours?: boolean;
          clean_buffer_minutes?: number;
          created_at?: string;
          dinner_end?: string;
          dinner_start?: string;
          id?: string;
          lunch_end?: string;
          lunch_start?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      strategic_configs: {
        Row: {
          created_at: string;
          demand_multiplier_override: number | null;
          future_conflict_penalty: number | null;
          id: string;
          restaurant_id: string | null;
          scarcity_weight: number;
          updated_at: string;
          updated_by: string | null;
        };
        Insert: {
          created_at?: string;
          demand_multiplier_override?: number | null;
          future_conflict_penalty?: number | null;
          id?: string;
          restaurant_id?: string | null;
          scarcity_weight?: number;
          updated_at?: string;
          updated_by?: string | null;
        };
        Update: {
          created_at?: string;
          demand_multiplier_override?: number | null;
          future_conflict_penalty?: number | null;
          id?: string;
          restaurant_id?: string | null;
          scarcity_weight?: number;
          updated_at?: string;
          updated_by?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'strategic_configs_restaurant_id_fkey';
            columns: ['restaurant_id'];
            isOneToOne: true;
            referencedRelation: 'restaurants';
            referencedColumns: ['id'];
          },
        ];
      };
      table_adjacencies: {
        Row: {
          created_at: string;
          table_a: string;
          table_b: string;
        };
        Insert: {
          created_at?: string;
          table_a: string;
          table_b: string;
        };
        Update: {
          created_at?: string;
          table_a?: string;
          table_b?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'table_adjacencies_table_a_fkey';
            columns: ['table_a'];
            isOneToOne: false;
            referencedRelation: 'table_inventory';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'table_adjacencies_table_b_fkey';
            columns: ['table_b'];
            isOneToOne: false;
            referencedRelation: 'table_inventory';
            referencedColumns: ['id'];
          },
        ];
      };
      table_hold_members: {
        Row: {
          created_at: string;
          hold_id: string;
          id: string;
          table_id: string;
        };
        Insert: {
          created_at?: string;
          hold_id: string;
          id?: string;
          table_id: string;
        };
        Update: {
          created_at?: string;
          hold_id?: string;
          id?: string;
          table_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'table_hold_members_hold_id_fkey';
            columns: ['hold_id'];
            isOneToOne: false;
            referencedRelation: 'table_holds';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'table_hold_members_table_id_fkey';
            columns: ['table_id'];
            isOneToOne: false;
            referencedRelation: 'table_inventory';
            referencedColumns: ['id'];
          },
        ];
      };
      table_hold_windows: {
        Row: {
          booking_id: string | null;
          end_at: string;
          expires_at: string;
          hold_id: string;
          hold_window: unknown;
          restaurant_id: string;
          start_at: string;
          table_id: string;
        };
        Insert: {
          booking_id?: string | null;
          end_at: string;
          expires_at: string;
          hold_id: string;
          hold_window?: unknown;
          restaurant_id: string;
          start_at: string;
          table_id: string;
        };
        Update: {
          booking_id?: string | null;
          end_at?: string;
          expires_at?: string;
          hold_id?: string;
          hold_window?: unknown;
          restaurant_id?: string;
          start_at?: string;
          table_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'table_hold_windows_hold_id_fkey';
            columns: ['hold_id'];
            isOneToOne: false;
            referencedRelation: 'table_holds';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'table_hold_windows_restaurant_id_fkey';
            columns: ['restaurant_id'];
            isOneToOne: false;
            referencedRelation: 'restaurants';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'table_hold_windows_table_id_fkey';
            columns: ['table_id'];
            isOneToOne: false;
            referencedRelation: 'table_inventory';
            referencedColumns: ['id'];
          },
        ];
      };
      table_holds: {
        Row: {
          booking_id: string | null;
          created_at: string;
          created_by: string | null;
          end_at: string;
          expires_at: string;
          id: string;
          last_touched_at: string;
          metadata: Json | null;
          restaurant_id: string;
          session_id: string | null;
          start_at: string;
          status: Database['public']['Enums']['table_hold_status'];
          updated_at: string;
          zone_id: string;
        };
        Insert: {
          booking_id?: string | null;
          created_at?: string;
          created_by?: string | null;
          end_at: string;
          expires_at: string;
          id?: string;
          last_touched_at?: string;
          metadata?: Json | null;
          restaurant_id: string;
          session_id?: string | null;
          start_at: string;
          status?: Database['public']['Enums']['table_hold_status'];
          updated_at?: string;
          zone_id: string;
        };
        Update: {
          booking_id?: string | null;
          created_at?: string;
          created_by?: string | null;
          end_at?: string;
          expires_at?: string;
          id?: string;
          last_touched_at?: string;
          metadata?: Json | null;
          restaurant_id?: string;
          session_id?: string | null;
          start_at?: string;
          status?: Database['public']['Enums']['table_hold_status'];
          updated_at?: string;
          zone_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'table_holds_booking_id_fkey';
            columns: ['booking_id'];
            isOneToOne: false;
            referencedRelation: 'bookings';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'table_holds_restaurant_id_fkey';
            columns: ['restaurant_id'];
            isOneToOne: false;
            referencedRelation: 'restaurants';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'table_holds_session_id_fkey';
            columns: ['session_id'];
            isOneToOne: false;
            referencedRelation: 'manual_assignment_sessions';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'table_holds_zone_id_fkey';
            columns: ['zone_id'];
            isOneToOne: false;
            referencedRelation: 'zones';
            referencedColumns: ['id'];
          },
        ];
      };
      table_inventory: {
        Row: {
          active: boolean;
          capacity: number;
          category: Database['public']['Enums']['table_category'];
          created_at: string;
          id: string;
          max_party_size: number | null;
          min_party_size: number;
          mobility: Database['public']['Enums']['table_mobility'];
          notes: string | null;
          position: Json | null;
          restaurant_id: string;
          seating_type: Database['public']['Enums']['table_seating_type'];
          section: string | null;
          status: Database['public']['Enums']['table_status'];
          table_number: string;
          updated_at: string;
          zone_id: string;
        };
        Insert: {
          active?: boolean;
          capacity: number;
          category: Database['public']['Enums']['table_category'];
          created_at?: string;
          id?: string;
          max_party_size?: number | null;
          min_party_size?: number;
          mobility?: Database['public']['Enums']['table_mobility'];
          notes?: string | null;
          position?: Json | null;
          restaurant_id: string;
          seating_type?: Database['public']['Enums']['table_seating_type'];
          section?: string | null;
          status?: Database['public']['Enums']['table_status'];
          table_number: string;
          updated_at?: string;
          zone_id: string;
        };
        Update: {
          active?: boolean;
          capacity?: number;
          category?: Database['public']['Enums']['table_category'];
          created_at?: string;
          id?: string;
          max_party_size?: number | null;
          min_party_size?: number;
          mobility?: Database['public']['Enums']['table_mobility'];
          notes?: string | null;
          position?: Json | null;
          restaurant_id?: string;
          seating_type?: Database['public']['Enums']['table_seating_type'];
          section?: string | null;
          status?: Database['public']['Enums']['table_status'];
          table_number?: string;
          updated_at?: string;
          zone_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'table_inventory_allowed_capacity_fkey';
            columns: ['restaurant_id', 'capacity'];
            isOneToOne: false;
            referencedRelation: 'allowed_capacities';
            referencedColumns: ['restaurant_id', 'capacity'];
          },
          {
            foreignKeyName: 'table_inventory_restaurant_id_fkey';
            columns: ['restaurant_id'];
            isOneToOne: false;
            referencedRelation: 'restaurants';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'table_inventory_zone_id_fkey';
            columns: ['zone_id'];
            isOneToOne: false;
            referencedRelation: 'zones';
            referencedColumns: ['id'];
          },
        ];
      };
      table_merge_graph: {
        Row: {
          created_at: string;
          merge_score: number | null;
          notes: string | null;
          restaurant_id: string;
          status: string;
          table_a: string;
          table_b: string;
          updated_at: string | null;
        };
        Insert: {
          created_at?: string;
          merge_score?: number | null;
          notes?: string | null;
          restaurant_id: string;
          status?: string;
          table_a: string;
          table_b: string;
          updated_at?: string | null;
        };
        Update: {
          created_at?: string;
          merge_score?: number | null;
          notes?: string | null;
          restaurant_id?: string;
          status?: string;
          table_a?: string;
          table_b?: string;
          updated_at?: string | null;
        };
        Relationships: [];
      };
      table_scarcity_metrics: {
        Row: {
          computed_at: string;
          id: string;
          restaurant_id: string;
          scarcity_score: number;
          table_type: string;
        };
        Insert: {
          computed_at?: string;
          id?: string;
          restaurant_id: string;
          scarcity_score: number;
          table_type: string;
        };
        Update: {
          computed_at?: string;
          id?: string;
          restaurant_id?: string;
          scarcity_score?: number;
          table_type?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'table_scarcity_metrics_restaurant_id_fkey';
            columns: ['restaurant_id'];
            isOneToOne: false;
            referencedRelation: 'restaurants';
            referencedColumns: ['id'];
          },
        ];
      };
      table_soft_holds: {
        Row: {
          booking_id: string | null;
          created_at: string;
          expires_at: string;
          hold_window: unknown;
          id: string;
          restaurant_id: string;
          session_token: string;
          table_id: string;
        };
        Insert: {
          booking_id?: string | null;
          created_at?: string;
          expires_at: string;
          hold_window: unknown;
          id?: string;
          restaurant_id: string;
          session_token: string;
          table_id: string;
        };
        Update: {
          booking_id?: string | null;
          created_at?: string;
          expires_at?: string;
          hold_window?: unknown;
          id?: string;
          restaurant_id?: string;
          session_token?: string;
          table_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'table_soft_holds_booking_id_fkey';
            columns: ['booking_id'];
            isOneToOne: false;
            referencedRelation: 'bookings';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'table_soft_holds_restaurant_id_fkey';
            columns: ['restaurant_id'];
            isOneToOne: false;
            referencedRelation: 'restaurants';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'table_soft_holds_table_id_fkey';
            columns: ['table_id'];
            isOneToOne: false;
            referencedRelation: 'table_inventory';
            referencedColumns: ['id'];
          },
        ];
      };
      user_profiles: {
        Row: {
          created_at: string;
          id: string;
          is_email_suppressed: boolean;
          marketing_opt_in: boolean;
          name: string | null;
          phone: string | null;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          id: string;
          is_email_suppressed?: boolean;
          marketing_opt_in?: boolean;
          name?: string | null;
          phone?: string | null;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          is_email_suppressed?: boolean;
          marketing_opt_in?: boolean;
          name?: string | null;
          phone?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      waiting_list: {
        Row: {
          booking_date: string;
          created_at: string;
          customer_email: string;
          customer_name: string;
          customer_phone: string | null;
          desired_time: string;
          id: string;
          notes: string | null;
          party_size: number;
          restaurant_id: string;
          seating_preference: Database['public']['Enums']['seating_preference_type'];
          updated_at: string;
        };
        Insert: {
          booking_date: string;
          created_at?: string;
          customer_email: string;
          customer_name: string;
          customer_phone?: string | null;
          desired_time: string;
          id?: string;
          notes?: string | null;
          party_size: number;
          restaurant_id: string;
          seating_preference?: Database['public']['Enums']['seating_preference_type'];
          updated_at?: string;
        };
        Update: {
          booking_date?: string;
          created_at?: string;
          customer_email?: string;
          customer_name?: string;
          customer_phone?: string | null;
          desired_time?: string;
          id?: string;
          notes?: string | null;
          party_size?: number;
          restaurant_id?: string;
          seating_preference?: Database['public']['Enums']['seating_preference_type'];
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'waiting_list_restaurant_id_fkey';
            columns: ['restaurant_id'];
            isOneToOne: false;
            referencedRelation: 'restaurants';
            referencedColumns: ['id'];
          },
        ];
      };
      zones: {
        Row: {
          active: boolean;
          created_at: string;
          id: string;
          name: string;
          restaurant_id: string;
          sort_order: number;
          updated_at: string;
        };
        Insert: {
          active?: boolean;
          created_at?: string;
          id?: string;
          name: string;
          restaurant_id: string;
          sort_order?: number;
          updated_at?: string;
        };
        Update: {
          active?: boolean;
          created_at?: string;
          id?: string;
          name?: string;
          restaurant_id?: string;
          sort_order?: number;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'zones_restaurant_id_fkey';
            columns: ['restaurant_id'];
            isOneToOne: false;
            referencedRelation: 'restaurants';
            referencedColumns: ['id'];
          },
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      read_operational_incident: { Args: { p_key: string }; Returns: Json };
      compare_and_swap_operational_incident: {
        Args: { p_key: string; p_expected_version: number; p_incident: Json };
        Returns: boolean;
      };
      all_sha256_text: { Args: { p_values: string[] }; Returns: boolean };
      array_sort_unique_text: { Args: { p_values: string[] }; Returns: string[] };
      apply_gbp_profile_import_to_core_v1: {
        Args: {
          p_connection_generation: number;
          p_consent_epoch: number;
          p_expected_account_id: string;
          p_expected_location_id: string;
          p_expected_profile_id: string;
          p_external_profile_row_id: string;
          p_field_key: string;
          p_restaurant_id: string;
          p_value: string | null;
        };
        Returns: Database['public']['Tables']['restaurants']['Row'];
      };
      begin_gbp_dual_sync_snapshot_run_v1: {
        Args: {
          p_connection_generation: number;
          p_consent_epoch: number;
          p_external_account_id: string;
          p_external_location_id: string;
          p_external_profile_id: string;
          p_external_profile_row_id: string;
          p_restaurant_id: string;
          p_run_id: string;
          p_run_kind: string;
          p_started_at: string;
        };
        Returns: GbpDualSyncSnapshotRunV1Row;
      };
      claim_gbp_core_changes_v1: {
        Args: { p_limit?: number; p_worker_id: string };
        Returns: Database['public']['Tables']['gbp_core_change_outbox_v1']['Row'][];
      };
      claim_gbp_core_changes_v2: {
        Args: { p_lease_seconds?: number; p_limit?: number; p_worker_id: string };
        Returns: Database['public']['Tables']['gbp_core_change_outbox_v1']['Row'][];
      };
      claim_gbp_terminal_notices_v1: {
        Args: {
          p_lease_seconds?: number;
          p_limit?: number;
          p_now?: string;
          p_worker_id: string;
        };
        Returns: Database['public']['Tables']['gbp_terminal_outcome_notices_v1']['Row'][];
      };
      claim_gbp_write_bundle_v1: {
        Args: {
          p_bundle_hash: string;
          p_bundle_id: string;
          p_connection_generation: number;
          p_consent_epoch: number;
          p_execution_id: string;
          p_decision_hashes: string[];
          p_external_account_id: string;
          p_external_location_id: string;
          p_external_profile_id: string;
          p_external_profile_row_id: string;
          p_grant_ids: string[];
          p_manifest_hashes: string[];
          p_policy_version: string;
          p_request_hashes: string[];
          p_renderer_version: string;
          p_restaurant_id: string;
          p_update_masks_hashes: string[];
        };
        Returns: Database['public']['Tables']['gbp_write_grants_v1']['Row'][];
      };
      cancel_gbp_claimed_bundle_before_dispatch_v1: {
        Args: {
          p_bundle_id: string;
          p_execution_id: string;
          p_reason_code: string;
          p_restaurant_id: string;
        };
        Returns: Database['public']['Tables']['gbp_write_grants_v1']['Row'][];
      };
      complete_gbp_core_change_v1: {
        Args: {
          p_outbox_id: string;
          p_restaurant_id: string;
          p_succeeded: boolean;
          p_worker_id: string;
        };
        Returns: boolean;
      };
      complete_gbp_core_change_v2: {
        Args: {
          p_error_code?: string | null;
          p_lease_token: string;
          p_outbox_id: string;
          p_outcome: string;
          p_restaurant_id: string;
          p_worker_id: string;
        };
        Returns: Database['public']['Tables']['gbp_core_change_outbox_v1']['Row'];
      };
      complete_gbp_oauth_identity_v1: {
        Args: {
          p_connected_email: string | null;
          p_connected_name: string | null;
          p_granted_scopes: string[];
          p_identity_verified_at: string;
          p_nonce_hash: string;
          p_provider_user_id: string;
          p_refreshed_at: string;
          p_refresh_token_encrypted: string;
          p_requested_by_user_id: string;
          p_restaurant_id: string;
          p_state_hash: string;
          p_target_external_profile_row_id: string;
          p_token_type: string | null;
        };
        Returns: Database['public']['Tables']['restaurant_external_profiles']['Row'];
      };
      consume_gbp_oauth_attempt_v1: {
        Args: {
          p_connection_generation: number;
          p_consent_epoch: number;
          p_expected_external_account_id: string | null;
          p_expected_external_location_id: string | null;
          p_expected_external_profile_id: string | null;
          p_external_profile_row_id: string | null;
          p_nonce_hash: string;
          p_restaurant_id: string;
          p_state_hash: string;
        };
        Returns: Database['public']['Tables']['restaurant_external_profile_oauth_states']['Row'];
      };
      create_gbp_oauth_attempt_v1: {
        Args: {
          p_connection_generation: number;
          p_consent_epoch: number;
          p_expected_external_account_id: string | null;
          p_expected_external_location_id: string | null;
          p_expected_external_profile_id: string | null;
          p_expires_at: string;
          p_external_profile_row_id: string | null;
          p_nonce_hash: string;
          p_requested_by_user_id: string;
          p_restaurant_id: string;
          p_return_path: string;
          p_state_hash: string;
        };
        Returns: Database['public']['Tables']['restaurant_external_profile_oauth_states']['Row'];
      };
      dispatch_gbp_write_bundle_v1: {
        Args: { p_bundle_id: string; p_execution_id: string; p_restaurant_id: string };
        Returns: Database['public']['Tables']['gbp_write_grants_v1']['Row'][];
      };
      dispatch_gbp_write_grant_v1: {
        Args: {
          p_bundle_id: string;
          p_bundle_order: number;
          p_execution_id: string;
          p_grant_id: string;
          p_restaurant_id: string;
        };
        Returns: Database['public']['Tables']['gbp_write_grants_v1']['Row'];
      };
      dispatch_gbp_terminal_notice_v1: {
        Args: {
          p_dispatch_key: string;
          p_lease_token: string;
          p_notice_id: string;
          p_now?: string;
          p_restaurant_id: string;
          p_worker_id: string;
        };
        Returns: Database['public']['Tables']['gbp_terminal_outcome_notices_v1']['Row'];
      };
      disconnect_gbp_connection_v1: {
        Args: {
          p_actor_user_id: string;
          p_connection_generation: number;
          p_consent_epoch: number;
          p_expected_account_id: string | null;
          p_expected_location_id: string | null;
          p_expected_profile_id: string | null;
          p_external_profile_row_id: string;
          p_reason_code: string;
          p_restaurant_id: string;
        };
        Returns: Database['public']['Tables']['restaurant_external_profiles']['Row'];
      };
      enqueue_gbp_core_change_v1: { Args: never; Returns: unknown };
      enqueue_gbp_scheduled_refreshes_v1: {
        Args: { p_bucket: string; p_limit?: number; p_now: string };
        Returns: Database['public']['CompositeTypes']['gbp_scheduled_refresh_result_v1'][];
      };
      expire_gbp_write_grants_v1: { Args: { p_limit?: number }; Returns: number };
      fail_gbp_dual_sync_snapshot_run_v1: {
        Args: {
          p_connection_generation: number;
          p_consent_epoch: number;
          p_error_code: string;
          p_external_account_id: string;
          p_external_location_id: string;
          p_external_profile_id: string;
          p_external_profile_row_id: string;
          p_finished_at: string;
          p_restaurant_id: string;
          p_run_id: string;
          p_run_kind: string;
        };
        Returns: GbpDualSyncSnapshotRunV1Row;
      };
      finalize_gbp_write_bundle_v1: {
        Args: {
          p_bundle_id: string;
          p_execution_id: string;
          p_reason_code: string;
          p_restaurant_id: string;
          p_status: string;
        };
        Returns: Database['public']['Tables']['gbp_write_grants_v1']['Row'][];
      };
      finalize_gbp_write_grant_v1: {
        Args: {
          p_bundle_id: string;
          p_bundle_order: number;
          p_execution_id: string;
          p_grant_id: string;
          p_reason_code: string;
          p_restaurant_id: string;
          p_status: string;
        };
        Returns: Database['public']['Tables']['gbp_write_grants_v1']['Row'];
      };
      finalize_gbp_terminal_notice_v1: {
        Args: {
          p_lease_token: string;
          p_notice_id: string;
          p_now?: string;
          p_outcome: string;
          p_restaurant_id: string;
          p_safe_error_code?: string | null;
          p_worker_id: string;
        };
        Returns: Database['public']['Tables']['gbp_terminal_outcome_notices_v1']['Row'];
      };
      guard_gbp_grant_transition_v1: { Args: never; Returns: unknown };
      guard_gbp_field_provenance_v1: { Args: never; Returns: unknown };
      guard_gbp_mutation_job_v1: { Args: never; Returns: unknown };
      get_gbp_core_outbox_census_v1: {
        Args: { p_restaurant_id: string };
        Returns: Database['public']['CompositeTypes']['gbp_core_outbox_census_v1'];
      };
      get_gbp_terminal_notice_census_v1: {
        Args: { p_now?: string; p_restaurant_id?: string | null };
        Returns: Database['public']['CompositeTypes']['gbp_terminal_notice_census_v1'];
      };
      get_gbp_content_retention_readiness_v1: {
        Args: { p_now?: string };
        Returns: Database['public']['CompositeTypes']['gbp_content_retention_readiness_v1'];
      };
      get_current_gbp_dual_sync_snapshot_runs_v1: {
        Args: {
          p_connection_generation: number;
          p_consent_epoch: number;
          p_external_account_id: string;
          p_external_location_id: string;
          p_external_profile_id: string;
          p_external_profile_row_id: string;
          p_now?: string;
          p_restaurant_id: string;
          p_run_kind?: string | null;
        };
        Returns: GbpDualSyncSnapshotRunV1Row[];
      };
      get_current_gbp_external_profile_snapshots_v1: {
        Args: {
          p_connection_generation: number;
          p_consent_epoch: number;
          p_external_account_id: string;
          p_external_location_id: string;
          p_external_profile_id: string;
          p_external_profile_row_id: string;
          p_now?: string;
          p_restaurant_id: string;
          p_snapshot_type?: string | null;
        };
        Returns: Database['public']['Tables']['restaurant_external_profile_snapshots']['Row'][];
      };
      get_current_gbp_food_menu_snapshots_v1: {
        Args: {
          p_connection_generation: number;
          p_consent_epoch: number;
          p_external_account_id: string;
          p_external_location_id: string;
          p_external_profile_id: string;
          p_external_profile_row_id: string;
          p_now?: string;
          p_restaurant_id: string;
        };
        Returns: GbpFoodMenuSnapshotV1Row[];
      };
      inherit_gbp_content_lineage_v1: {
        Args: {
          p_connection_generation: number;
          p_consent_epoch: number;
          p_external_profile_row_id: string;
          p_parent_lineage_id: string;
          p_restaurant_id: string;
          p_target_content_field: string;
          p_target_source_row_id: string;
          p_target_store_key: string;
        };
        Returns: Database['public']['Tables']['gbp_content_lineage_v1']['Row'];
      };
      issue_and_enqueue_gbp_write_bundle_v1: {
        Args: {
          p_actor_user_id: string;
          p_bundle_hash: string;
          p_bundle_id: string;
          p_connection_generation: number;
          p_consent_epoch: number;
          p_expires_at: string;
          p_external_account_id: string;
          p_external_location_id: string;
          p_external_profile_id: string;
          p_external_profile_row_id: string;
          p_grants: Database['public']['CompositeTypes']['gbp_write_grant_issue_v1'][];
          p_issued_at: string;
          p_job_id: string;
          p_policy_version: string;
          p_renderer_version: string;
          p_restaurant_id: string;
        };
        Returns: Database['public']['CompositeTypes']['gbp_write_bundle_enqueue_result_v1'];
      };
      issue_and_claim_gbp_write_bundle_v1: {
        Args: {
          p_actor_user_id: string;
          p_bundle_hash: string;
          p_bundle_id: string;
          p_connection_generation: number;
          p_consent_epoch: number;
          p_execution_id: string;
          p_expires_at: string;
          p_external_account_id: string;
          p_external_location_id: string;
          p_external_profile_id: string;
          p_external_profile_row_id: string;
          p_grants: Database['public']['CompositeTypes']['gbp_write_grant_issue_v1'][];
          p_issued_at: string;
          p_policy_version: string;
          p_renderer_version: string;
          p_restaurant_id: string;
        };
        Returns: Database['public']['Tables']['gbp_write_grants_v1']['Row'][];
      };
      issue_gbp_write_bundle_v1: {
        Args: {
          p_actor_user_id: string;
          p_bundle_hash: string;
          p_bundle_id: string;
          p_connection_generation: number;
          p_consent_epoch: number;
          p_expires_at: string;
          p_external_account_id: string;
          p_external_location_id: string;
          p_external_profile_id: string;
          p_external_profile_row_id: string;
          p_grants: Database['public']['CompositeTypes']['gbp_write_grant_issue_v1'][];
          p_issued_at: string;
          p_policy_version: string;
          p_renderer_version: string;
          p_restaurant_id: string;
        };
        Returns: Database['public']['Tables']['gbp_write_grants_v1']['Row'][];
      };
      rebind_gbp_connection_v1: {
        Args: {
          p_actor_user_id: string;
          p_connection_generation: number;
          p_consent_epoch: number;
          p_expected_account_id: string | null;
          p_expected_location_id: string | null;
          p_expected_profile_id: string | null;
          p_external_profile_row_id: string;
          p_new_account_id: string;
          p_new_location_id: string;
          p_new_profile_id: string;
          p_reason_code: string;
          p_restaurant_id: string;
        };
        Returns: Database['public']['Tables']['restaurant_external_profiles']['Row'];
      };
      record_gbp_grant_created_v1: { Args: never; Returns: unknown };
      refresh_gbp_notification_ref_count_v1: { Args: never; Returns: unknown };
      repair_gbp_core_change_v1: {
        Args: {
          p_after_hash?: string | null;
          p_before_hash?: string | null;
          p_field_keys?: string[] | null;
          p_idempotency_hash: string;
          p_insert_missing?: boolean;
          p_operation?: string | null;
          p_operator_repair: boolean;
          p_operator_user_id: string;
          p_outbox_id: string;
          p_restaurant_id: string;
          p_source_row_id?: string | null;
          p_source_table?: string | null;
        };
        Returns: Database['public']['Tables']['gbp_core_change_outbox_v1']['Row'];
      };
      record_gbp_provider_observation_v1: {
        Args: {
          p_connection_generation: number;
          p_consent_epoch: number;
          p_expires_at: string;
          p_external_account_id: string;
          p_external_location_id: string;
          p_external_profile_id: string;
          p_external_profile_row_id: string;
          p_field_key: string;
          p_observed_at: string;
          p_restaurant_id: string;
          p_source_row_id: string;
          p_source_table: string;
          p_value_hash: string;
        };
        Returns: string;
      };
      record_gbp_content_observation_v1: {
        Args: {
          p_connection_generation: number;
          p_consent_epoch: number;
          p_content_fields: string[];
          p_external_account_id: string;
          p_external_location_id: string;
          p_external_profile_id: string;
          p_external_profile_row_id: string;
          p_observed_at: string;
          p_restaurant_id: string;
          p_source_row_id: string;
          p_store_key: string;
          p_value_hashes: string[];
        };
        Returns: Database['public']['Tables']['gbp_content_lineage_v1']['Row'][];
      };
      run_gbp_content_retention_v1: {
        Args: {
          p_connection_generation?: number | null;
          p_consent_epoch?: number | null;
          p_dry_run: boolean;
          p_external_profile_row_id?: string | null;
          p_limit: number;
          p_now: string;
          p_restaurant_id?: string | null;
          p_time_budget_ms: number;
        };
        Returns: Database['public']['CompositeTypes']['gbp_content_retention_result_v1'][];
      };
      purge_gbp_profile_content_v1: {
        Args: {
          p_connection_generation: number;
          p_consent_epoch: number;
          p_external_account_id: string;
          p_external_location_id: string;
          p_external_profile_id: string;
          p_external_profile_row_id: string;
          p_restaurant_id: string;
        };
        Returns: number;
      };
      persist_gbp_dual_sync_snapshot_run_v1: {
        Args: {
          p_connection_generation: number;
          p_consent_epoch: number;
          p_external_account_id: string;
          p_external_location_id: string;
          p_external_profile_id: string;
          p_external_profile_row_id: string;
          p_observed_at: string;
          p_raw_payload: Json;
          p_restaurant_id: string;
          p_run_id: string;
          p_run_kind: string;
        };
        Returns: GbpDualSyncSnapshotRunV1Row;
      };
      persist_gbp_external_profile_snapshot_v1: {
        Args: {
          p_connection_generation: number;
          p_consent_epoch: number;
          p_external_account_id: string;
          p_external_location_id: string;
          p_external_profile_id: string;
          p_external_profile_row_id: string;
          p_observed_at: string;
          p_payload: Json;
          p_restaurant_id: string;
          p_snapshot_id: string;
          p_snapshot_type: string;
          p_source_revision: string | null;
        };
        Returns: Database['public']['Tables']['restaurant_external_profile_snapshots']['Row'];
      };
      persist_gbp_food_menu_snapshot_v1: {
        Args: {
          p_connection_generation: number;
          p_consent_epoch: number;
          p_external_account_id: string;
          p_external_location_id: string;
          p_external_profile_id: string;
          p_external_profile_row_id: string;
          p_food_menus_name: string | null;
          p_google_etag: string | null;
          p_observed_at: string;
          p_raw_food_menus: Json;
          p_restaurant_id: string;
          p_snapshot_id: string;
          p_source: string;
        };
        Returns: GbpFoodMenuSnapshotV1Row;
      };
      refresh_gbp_credential_v1: {
        Args: {
          p_connection_generation: number;
          p_consent_epoch: number;
          p_expected_account_id: string | null;
          p_expected_location_id: string | null;
          p_expected_profile_id: string | null;
          p_expected_refresh_token_encrypted: string;
          p_external_profile_row_id: string;
          p_granted_scopes: string[];
          p_refreshed_at: string;
          p_refresh_token_encrypted: string;
          p_restaurant_id: string;
          p_token_type: string | null;
        };
        Returns: Database['public']['Tables']['restaurant_external_profile_credentials']['Row'];
      };
      reject_gbp_append_only_mutation_v1: { Args: never; Returns: unknown };
      reject_gbp_readiness_mutation_v1: { Args: never; Returns: unknown };
      set_gbp_readiness_hash_v1: { Args: never; Returns: unknown };
      set_gbp_write_access_v1: {
        Args: {
          p_actor_user_id: string;
          p_connection_generation: number;
          p_consent_epoch: number;
          p_enabled: boolean;
          p_external_account_id: string;
          p_external_location_id: string;
          p_external_profile_id: string;
          p_external_profile_row_id: string;
          p_restaurant_id: string;
        };
        Returns: Database['public']['Tables']['restaurant_external_profiles']['Row'];
      };
      transition_gbp_connection_v1: {
        Args: {
          p_actor_user_id: string;
          p_connection_generation: number;
          p_consent_epoch: number;
          p_expected_account_id: string | null;
          p_expected_location_id: string | null;
          p_expected_profile_id: string | null;
          p_external_profile_row_id: string;
          p_next_state: string;
          p_reason_code: string;
          p_restaurant_id: string;
        };
        Returns: Database['public']['Tables']['restaurant_external_profiles']['Row'];
      };
      transition_gbp_connection_provider_failure_v1: {
        Args: {
          p_connection_generation: number;
          p_consent_epoch: number;
          p_expected_account_id: string | null;
          p_expected_location_id: string | null;
          p_expected_profile_id: string | null;
          p_external_profile_row_id: string;
          p_next_state: string;
          p_reason_code: string;
          p_restaurant_id: string;
        };
        Returns: Database['public']['Tables']['restaurant_external_profiles']['Row'];
      };
      link_gbp_notification_participation_v1: {
        Args: {
          p_connection_generation: number;
          p_consent_epoch: number;
          p_external_account_id: string;
          p_external_location_id: string;
          p_external_profile_id: string;
          p_external_profile_row_id: string;
          p_managed_topic: string;
          p_provider_notification_setting_id?: string | null;
          p_restaurant_id: string;
        };
        Returns: Database['public']['Tables']['gbp_notification_registries_v1']['Row'];
      };
      materialize_gbp_terminal_notice_v1: {
        Args: {
          p_event_id: string;
          p_grant_id: string;
          p_restaurant_id: string;
          p_safe_reason_code: string;
          p_terminal_at: string;
          p_terminal_kind: string;
        };
        Returns: Database['public']['Tables']['gbp_terminal_outcome_notices_v1']['Row'];
      };
      read_gbp_pending_update_masks_v1: {
        Args: {
          p_connection_generation: number;
          p_consent_epoch: number;
          p_external_account_id: string;
          p_external_location_id: string;
          p_external_profile_id: string;
          p_external_profile_row_id: string;
          p_now?: string;
          p_restaurant_id: string;
        };
        Returns: Database['public']['Tables']['gbp_pending_update_masks_v1']['Row'][];
      };
      record_gbp_pubsub_and_enqueue_v1: {
        Args: {
          p_authentication_result: string;
          p_connection_generation: number | null;
          p_consent_epoch: number | null;
          p_event_hash: string;
          p_event_type: string | null;
          p_external_account_id: string | null;
          p_external_location_id: string | null;
          p_external_profile_id: string | null;
          p_external_profile_row_id: string | null;
          p_idempotency_key: string;
          p_message_id: string;
          p_processing_result: string;
          p_received_at: string;
          p_registry_id: string | null;
          p_restaurant_id: string | null;
          p_subscription: string;
        };
        Returns: Database['public']['CompositeTypes']['gbp_pubsub_receipt_result_v1'];
      };
      record_google_review_notification_v1: {
        Args: {
          p_event_type: string;
          p_external_account_id: string;
          p_external_location_id: string;
          p_observed_at?: string;
          p_provider_event_hash: string;
        };
        Returns: string;
      };
      schedule_review_request_v1: {
        Args: {
          p_booking_id: string;
          p_campaign_key?: string;
          p_email_eligible: boolean;
          p_experiment_arm?: string;
          p_restaurant_id: string;
          p_scheduled_for: string;
          p_whatsapp_eligible: boolean;
        };
        Returns: Json;
      };
      can_send_review_request_v1: {
        Args: {
          p_channel: string;
          p_now?: string;
          p_restaurant_id: string;
          p_review_request_id: string;
        };
        Returns: boolean;
      };
      record_review_request_event_v1: {
        Args: {
          p_channel: string | null;
          p_cost_microunits?: number | null;
          p_event_type: string;
          p_idempotency_key: string;
          p_metadata?: Json;
          p_occurred_at: string;
          p_provider: string;
          p_provider_event_id: string | null;
          p_restaurant_id: string;
          p_review_request_id: string;
        };
        Returns: boolean;
      };
      record_review_link_click_v1: {
        Args: {
          p_booking_id: string;
          p_channel: string;
          p_event_id: string;
          p_occurred_at: string;
          p_restaurant_id: string;
        };
        Returns: boolean;
      };
      get_review_growth_dashboard_v1: {
        Args: { p_from: string; p_restaurant_id: string; p_to: string };
        Returns: Json;
      };
      accelerate_review_email_followup_v1: {
        Args: { p_now?: string; p_restaurant_id: string; p_review_request_id: string };
        Returns: boolean;
      };
      reconcile_missing_gbp_terminal_notices_v1: {
        Args: { p_limit?: number; p_now?: string };
        Returns: Database['public']['Tables']['gbp_terminal_outcome_notices_v1']['Row'][];
      };
      recover_stale_gbp_dispatched_notices_v1: {
        Args: { p_limit?: number; p_now?: string };
        Returns: Database['public']['Tables']['gbp_terminal_outcome_notices_v1']['Row'][];
      };
      recover_stale_gbp_dispatched_grants_v1: {
        Args: {
          p_connection_generation: number;
          p_consent_epoch: number;
          p_cutoff: string;
          p_external_account_id: string;
          p_external_location_id: string;
          p_external_profile_id: string;
          p_external_profile_row_id: string;
          p_limit?: number;
          p_now?: string;
          p_restaurant_id: string;
        };
        Returns: Database['public']['Tables']['gbp_write_grants_v1']['Row'][];
      };
      terminalize_gbp_pending_update_masks_v1: {
        Args: {
          p_connection_generation: number;
          p_consent_epoch: number;
          p_event_id: string;
          p_external_account_id: string;
          p_external_location_id: string;
          p_external_profile_id: string;
          p_external_profile_row_id: string;
          p_restaurant_id: string;
          p_terminal_at: string;
          p_terminal_status: string;
        };
        Returns: Database['public']['Tables']['gbp_pending_update_masks_v1']['Row'];
      };
      unlink_gbp_notification_participation_v1: {
        Args: {
          p_connection_generation: number;
          p_consent_epoch: number;
          p_external_account_id: string;
          p_external_location_id: string;
          p_external_profile_id: string;
          p_external_profile_row_id: string;
          p_restaurant_id: string;
        };
        Returns: Database['public']['Tables']['gbp_notification_registries_v1']['Row'];
      };
      upsert_gbp_pending_update_masks_v1: {
        Args: {
          p_attribute_paths: string[];
          p_connection_generation: number;
          p_consent_epoch: number;
          p_event_id: string;
          p_expires_at: string;
          p_external_account_id: string;
          p_external_location_id: string;
          p_external_profile_id: string;
          p_external_profile_row_id: string;
          p_location_masks: string[];
          p_observed_at: string;
          p_restaurant_id: string;
          p_source_job_id: string | null;
          p_source_receipt_message_id: string | null;
          p_source_receipt_subscription: string | null;
        };
        Returns: Database['public']['Tables']['gbp_pending_update_masks_v1']['Row'];
      };
      claim_review_scheduling_jobs_v1: {
        Args: { p_limit?: number };
        Returns: { booking_id: string; restaurant_id: string; claim_token: string }[];
      };
      finish_review_scheduling_job_v1: {
        Args: {
          p_booking_id: string;
          p_restaurant_id: string;
          p_claim_token: string;
          p_error_code?: string | null;
        };
        Returns: boolean;
      };
      recover_review_scheduling_jobs_v1: {
        Args: { p_restaurant_id: string; p_booking_ids: string[] };
        Returns: number;
      };
      claim_due_mobile_review_notifications: {
        Args: { p_limit?: number };
        Returns: Database['public']['Tables']['mobile_notifications']['Row'][];
      };
      claim_mobile_notification_fallback: {
        Args: {
          p_fallback_for_attempt_id: string;
          p_notification_id: string;
          p_recipient_phone: string;
          p_restaurant_id: string;
        };
        Returns: string;
      };
      claim_mobile_notification_preaccept_fallback: {
        Args: {
          p_fallback_for_attempt_id: string;
          p_notification_id: string;
          p_recipient_phone: string;
          p_restaurant_id: string;
        };
        Returns: string | null;
      };
      finalize_mobile_sms_attempt: {
        Args: {
          p_attempt_id: string;
          p_error_code: string | null;
          p_provider_message_id: string | null;
          p_status: string;
        };
        Returns: string | null;
      };
      finalize_mobile_whatsapp_attempt: {
        Args: {
          p_attempt_id: string;
          p_error_code: string | null;
          p_provider_message_id: string | null;
          p_status: string;
        };
        Returns: string | null;
      };
      schedule_mobile_review_notification: {
        Args: {
          p_booking_id: string;
          p_recipient_phone: string;
          p_restaurant_id: string;
          p_scheduled_for: string;
        };
        Returns: string | null;
      };
      acquire_soft_holds_atomic: {
        Args: {
          p_booking_id?: string;
          p_restaurant_id: string;
          p_session_token: string;
          p_table_ids: string[];
          p_ttl_seconds?: number;
          p_window: unknown;
        };
        Returns: {
          acquired: boolean;
          blocking_expires_at: string;
          blocking_session: string;
          table_id: string;
        }[];
      };
      allocations_overlap: {
        Args: { a: unknown; b: unknown };
        Returns: boolean;
      };
      apply_booking_state_transition: {
        Args: {
          p_booking_id: string;
          p_checked_in_at: string | null;
          p_checked_out_at: string | null;
          p_history_changed_at: string;
          p_history_changed_by: string | null;
          p_history_from: Database['public']['Enums']['booking_status'];
          p_history_metadata?: Json;
          p_history_reason: string;
          p_history_to: Database['public']['Enums']['booking_status'];
          p_status: Database['public']['Enums']['booking_status'];
          p_updated_at: string;
        };
        Returns: {
          checked_in_at: string | null;
          checked_out_at: string | null;
          status: Database['public']['Enums']['booking_status'];
          updated_at: string | null;
        }[];
      };
      are_tables_connected: { Args: { table_ids: string[] }; Returns: boolean };
      assign_merged_tables: {
        Args: {
          p_assigned_by?: string;
          p_booking_id: string;
          p_idempotency_key?: string;
          p_require_adjacency?: boolean;
          p_table_ids: string[];
        };
        Returns: undefined;
      };
      assign_single_table: {
        Args: {
          p_assigned_by?: string;
          p_booking_id: string;
          p_idempotency_key?: string;
          p_table_id: string;
        };
        Returns: undefined;
      };
      assign_tables_atomic: {
        Args: {
          p_assigned_by?: string;
          p_booking_id: string;
          p_idempotency_key?: string;
          p_table_ids: string[];
          p_window: unknown;
        };
        Returns: {
          assignment_id: string;
          table_id: string;
        }[];
      };
      claim_booking_email_intent: {
        Args: { p_dedupe_key: string; p_restaurant_id: string };
        Returns: Database['public']['Tables']['email_dispatch_intents']['Row'][];
      };
      claim_capacity_outbox_batch: {
        Args: { p_limit?: number; p_lease_seconds?: number; p_max_attempts?: number };
        Returns: Database['public']['Tables']['capacity_outbox']['Row'][];
      };
      claim_due_email_dispatch_intents: {
        Args: { p_email_types?: string[] | null; p_max_count?: number | null };
        Returns: {
          attempts_made: number;
          backoff_delay_ms: number;
          backoff_type: string;
          booking_id: string;
          cancelled_at: string | null;
          claimed_at: string | null;
          created_at: string;
          dedupe_key: string;
          email_type: string;
          id: string;
          last_attempt_at: string | null;
          last_error: string | null;
          max_attempts: number;
          payload: Json;
          processed_at: string | null;
          restaurant_id: string | null;
          scheduled_for: string;
          status: string;
          updated_at: string;
        }[];
      };
      assign_tables_atomic_v2:
        | {
            Args: {
              p_assigned_by?: string;
              p_booking_id: string;
              p_idempotency_key?: string;
              p_require_adjacency?: boolean;
              p_table_ids: string[];
            };
            Returns: {
              end_at: string;
              merge_group_id: string;
              start_at: string;
              table_id: string;
            }[];
          }
        | {
            Args: {
              p_assigned_by?: string;
              p_booking_id: string;
              p_end_at?: string;
              p_idempotency_key?: string;
              p_require_adjacency?: boolean;
              p_start_at?: string;
              p_table_ids: string[];
            };
            Returns: {
              end_at: string;
              merge_group_id: string;
              start_at: string;
              table_id: string;
            }[];
          };
      booking_status_summary: {
        Args: {
          p_end_date?: string;
          p_restaurant_id: string;
          p_start_date?: string;
          p_status_filter?: Database['public']['Enums']['booking_status'][];
        };
        Returns: {
          status: Database['public']['Enums']['booking_status'];
          total: number;
        }[];
      };
      cancel_booking_and_release_table_state: {
        Args: { p_booking_id: string; p_restaurant_id: string };
        Returns: {
          booking: Database['public']['Tables']['bookings']['Row'];
          cancelled: boolean;
        }[];
      };
      check_soft_hold_ownership: {
        Args: {
          p_session_token: string;
          p_table_ids: string[];
          p_window: unknown;
        };
        Returns: {
          expires_at: string;
          owned: boolean;
          table_id: string;
        }[];
      };
      create_table_hold_atomic: {
        Args: {
          p_booking_id: string | null;
          p_restaurant_id: string;
          p_zone_id: string;
          p_table_ids: string[];
          p_start_at: string;
          p_end_at: string;
          p_expires_at: string;
          p_created_by?: string | null;
          p_metadata?: Json | null;
        };
        Returns: Database['public']['Tables']['table_holds']['Row'][];
      };
      cleanup_expired_soft_holds: {
        Args: { p_batch_size?: number };
        Returns: number;
      };
      confirm_hold_assignment_tx: {
        Args: {
          p_assigned_by?: string;
          p_booking_id: string;
          p_expected_adjacency_hash?: string;
          p_expected_policy_version?: string;
          p_history_changed_by?: string;
          p_history_metadata?: Json;
          p_history_reason?: string;
          p_hold_id: string;
          p_idempotency_key: string;
          p_require_adjacency?: boolean;
          p_target_status?: Database['public']['Enums']['booking_status'];
          p_window_end?: string;
          p_window_start?: string;
        };
        Returns: {
          assignment_id: string;
          end_at: string;
          merge_group_id: string;
          start_at: string;
          table_id: string;
        }[];
      };
      confirm_hold_assignment_with_transition: {
        Args: {
          p_assigned_by?: string;
          p_booking_id: string;
          p_end_at?: string;
          p_history_changed_by?: string;
          p_history_metadata?: Json;
          p_history_reason?: string;
          p_idempotency_key: string;
          p_require_adjacency?: boolean;
          p_start_at?: string;
          p_table_ids: string[];
          p_target_status?: Database['public']['Enums']['booking_status'];
        };
        Returns: {
          end_at: string;
          merge_group_id: string;
          start_at: string;
          table_id: string;
        }[];
      };
      create_booking_with_capacity_check: {
        Args: {
          p_auth_user_id?: string;
          p_booking_date: string;
          p_booking_type: string;
          p_client_request_id?: string;
          p_customer_email: string;
          p_customer_id: string;
          p_customer_name: string;
          p_customer_phone: string;
          p_details?: Json;
          p_end_time: string;
          p_idempotency_key?: string;
          p_loyalty_points_awarded?: number;
          p_marketing_opt_in?: boolean;
          p_notes?: string;
          p_party_size: number;
          p_restaurant_id: string;
          p_seating_preference: string;
          p_source?: string;
          p_start_time: string;
        };
        Returns: Json;
      };
      delete_table_inventory_guarded: {
        Args: { p_current_date: string; p_table_id: string };
        Returns: boolean;
      };
      ensure_booking_email_intent: {
        Args: {
          p_booking_id: string;
          p_dedupe_key: string;
          p_email_type: string;
          p_max_attempts?: number;
          p_restaurant_id: string;
          p_scheduled_for?: string | null;
          p_supersede_types?: string[] | null;
        };
        Returns: { created: boolean; intent_id: string; intent_status: string }[];
      };
      import_restaurant_menu_bundle: {
        Args: {
          p_items: Json;
          p_modifier_groups?: Json;
          p_modifier_options?: Json;
          p_replace_modifiers?: boolean;
          p_restaurant_id: string;
        };
        Returns: Json;
      };
      import_restaurant_drink_menu_bundle: {
        Args: {
          p_items: Json;
          p_modifier_groups?: Json;
          p_modifier_options?: Json;
          p_replace_modifiers?: boolean;
          p_restaurant_id: string;
        };
        Returns: Json;
      };
      current_restaurant_id: { Args: never; Returns: string };
      generate_booking_reference: { Args: never; Returns: string };
      get_or_create_booking_slot: {
        Args: {
          p_default_capacity?: number;
          p_restaurant_id: string;
          p_slot_date: string;
          p_slot_time: string;
        };
        Returns: string;
      };
      is_holds_strict_conflicts_enabled: { Args: never; Returns: boolean };
      is_table_available_v2: {
        Args: {
          p_end_at: string;
          p_exclude_booking_id?: string;
          p_start_at: string;
          p_table_id: string;
        };
        Returns: boolean;
      };
      ops_email_delivery_attempts_feed: {
        Args: {
          p_booking_ref?: string;
          p_email_type?: string;
          p_message_id?: string;
          p_page: number;
          p_page_size: number;
          p_range: string;
          p_recipient_email?: string;
          p_restaurant_id: string;
          p_statuses?: string[];
          p_template_type?: string;
        };
        Returns: {
          booking: Json;
          bookingId: string;
          currentOccurredAt: string;
          currentStatus: string;
          emailType: string;
          events: Json;
          messageId: string;
          provider: string;
          recipientEmail: string;
          templateType: string;
        }[];
      };
      ops_email_delivery_attempts_summary: {
        Args: {
          p_booking_ref?: string;
          p_email_type?: string;
          p_message_id?: string;
          p_range: string;
          p_recipient_email?: string;
          p_restaurant_id: string;
          p_statuses?: string[];
          p_template_type?: string;
        };
        Returns: {
          bounced: number;
          complained: number;
          delivered: number;
          deliveredRate: number;
          deliveryDelayed: number;
          failed: number;
          failureRate: number;
          p50DeliverySeconds: number;
          p95DeliverySeconds: number;
          sent: number;
          topFailedEmailTypes: Json;
          topFailedTemplates: Json;
          total: number;
          uniqueBookings: number;
          uniqueRecipients: number;
        }[];
      };
      ops_customers_history_base: {
        Args: {
          p_last_visit?: string;
          p_marketing_opt_in?: string;
          p_min_bookings?: number;
          p_restaurant_id: string;
          p_search?: string;
        };
        Returns: {
          created_at: string;
          email: string;
          first_booking_at: string | null;
          id: string;
          last_visit_at: string | null;
          marketing_opt_in: boolean;
          name: string;
          phone: string;
          restaurant_id: string;
          total_bookings: number;
          total_cancellations: number;
          total_covers: number;
          updated_at: string;
        }[];
      };
      ops_customers_history_feed: {
        Args: {
          p_last_visit?: string;
          p_marketing_opt_in?: string;
          p_min_bookings?: number;
          p_page?: number;
          p_page_size?: number;
          p_restaurant_id: string;
          p_search?: string;
          p_sort_by?: string;
          p_sort_order?: string;
        };
        Returns: {
          created_at: string;
          email: string;
          first_booking_at: string | null;
          id: string;
          last_visit_at: string | null;
          marketing_opt_in: boolean;
          name: string;
          phone: string;
          restaurant_id: string;
          total_count: number;
          total_bookings: number;
          total_cancellations: number;
          total_covers: number;
          updated_at: string;
        }[];
      };
      ops_customers_history_summary: {
        Args: {
          p_last_visit?: string;
          p_marketing_opt_in?: string;
          p_min_bookings?: number;
          p_restaurant_id: string;
          p_search?: string;
        };
        Returns: {
          never_visited: number;
          opted_in: number;
          opted_out: number;
          returning: number;
          total: number;
          vip: number;
        }[];
      };
      process_late_arrivals: { Args: never; Returns: undefined };
      prune_allocations_history: {
        Args: { p_cutoff: string; p_limit?: number };
        Returns: {
          archived_count: number;
          deleted_count: number;
        }[];
      };
      refresh_table_status: { Args: { p_table_id: string }; Returns: undefined };
      replace_gbp_canonical_business_info: {
        Args: {
          p_addresses?: Json;
          p_attributes?: Json | null;
          p_attributes_payload_hash?: string | null;
          p_attributes_snapshot?: Json | null;
          p_attributes_source_revision?: string | null;
          p_business_details?: Json | null;
          p_categories?: Json;
          p_external_profile_id: string;
          p_field_sync_entity_tables?: string[];
          p_field_sync_statuses?: Json;
          p_hours?: Json;
          p_links?: Json;
          p_location_payload_hash: string;
          p_location_snapshot: Json;
          p_location_source_revision: string | null;
          p_phone_numbers?: Json;
          p_profile_change_log_rows?: Json;
          p_restaurant_id: string;
          p_service_areas?: Json;
          p_service_items?: Json | null;
        };
        Returns: undefined;
      };
      release_hold_and_emit: {
        Args: { p_actor_id?: string; p_hold_id: string };
        Returns: boolean;
      };
      release_soft_holds: {
        Args: { p_session_token: string; p_table_ids?: string[] };
        Returns: number;
      };
      require_restaurant_context: { Args: never; Returns: string };
      modify_booking_with_table_swap: {
        Args: {
          p_booking_id: string;
          p_expected_status: string | null;
          p_history_metadata?: Json;
          p_history_reason?: string;
          p_hold_id: string;
          p_idempotency_key: string;
          p_patch: Json;
          p_require_adjacency?: boolean;
          p_restaurant_id: string;
        };
        Returns: Database['public']['Tables']['bookings']['Row'];
      };
      settle_booking_email_intent: {
        Args: {
          p_error_code?: string | null;
          p_expected_attempts: number;
          p_intent_id: string;
          p_outcome: string;
          p_restaurant_id: string;
          p_retry_delay_seconds?: number;
        };
        Returns: string | null;
      };
      set_hold_conflict_enforcement: {
        Args: { enabled: boolean };
        Returns: boolean;
      };
      set_restaurant_context: {
        Args: { p_restaurant_id: string };
        Returns: string;
      };
      sync_confirmed_assignment_windows: {
        Args: {
          p_actor_id?: string;
          p_booking_id: string;
          p_hold_id?: string;
          p_idempotency_key?: string;
          p_merge_group_id?: string;
          p_payload_checksum?: string;
          p_table_ids: string[];
          p_window_end: string;
          p_window_start: string;
        };
        Returns: {
          allocation_id: string | null;
          assigned_at: string;
          assigned_by: string | null;
          assignment_window: unknown;
          booking_id: string;
          created_at: string;
          end_at: string | null;
          id: string;
          idempotency_key: string | null;
          merge_group_id: string | null;
          notes: string | null;
          slot_id: string | null;
          start_at: string | null;
          table_id: string;
          updated_at: string;
        }[];
        SetofOptions: {
          from: '*';
          to: 'booking_table_assignments';
          isOneToOne: false;
          isSetofReturn: true;
        };
      };
      upsert_restaurant_menu_item_with_modifiers: {
        Args: {
          p_item: Json;
          p_restaurant_id: string;
        };
        Returns: Json;
      };
      upsert_restaurant_drink_menu_item_with_modifiers: {
        Args: {
          p_item: Json;
          p_restaurant_id: string;
        };
        Returns: Json;
      };
      unassign_table_from_booking: {
        Args: { p_booking_id: string; p_table_id: string };
        Returns: boolean;
      };
      unassign_tables_atomic: {
        Args: { p_booking_id: string; p_table_ids?: string[] };
        Returns: {
          table_id: string;
        }[];
      };
      update_booking_with_capacity_check: {
        Args: {
          p_auth_user_id?: string;
          p_booking_date: string;
          p_booking_id: string;
          p_booking_type: string;
          p_client_request_id?: string;
          p_customer_email: string;
          p_customer_id: string;
          p_customer_name: string;
          p_customer_phone: string;
          p_details?: Json;
          p_end_time: string;
          p_loyalty_points_awarded?: number;
          p_marketing_opt_in?: boolean;
          p_notes?: string;
          p_party_size: number;
          p_restaurant_id: string;
          p_seating_preference: string;
          p_source?: string;
          p_start_time: string;
        };
        Returns: Json;
      };
      user_restaurants: { Args: never; Returns: string[] };
      user_restaurants_admin: { Args: never; Returns: string[] };
      validate_booking_capacity_after_assignment: {
        Args: { p_booking_id: string };
        Returns: undefined;
      };
    };
    Enums: {
      analytics_event_type:
        | 'booking.created'
        | 'booking.cancelled'
        | 'booking.allocated'
        | 'booking.waitlisted';
      booking_change_type: 'created' | 'updated' | 'cancelled' | 'deleted';
      booking_status:
        | 'confirmed'
        | 'pending'
        | 'cancelled'
        | 'completed'
        | 'PRIORITY_WAITLIST'
        | 'no_show'
        | 'pending_allocation'
        | 'checked_in';
      capacity_override_type: 'holiday' | 'event' | 'manual' | 'emergency';
      manual_assignment_session_state:
        | 'none'
        | 'proposed'
        | 'held'
        | 'confirmed'
        | 'expired'
        | 'conflicted'
        | 'cancelled';
      seating_preference_type: 'any' | 'indoor' | 'outdoor' | 'bar' | 'window' | 'quiet' | 'booth';
      table_category: 'bar' | 'dining' | 'lounge' | 'patio' | 'private';
      table_hold_status: 'active' | 'expired' | 'confirmed' | 'cancelled';
      table_mobility: 'movable' | 'fixed';
      table_seating_type: 'standard' | 'sofa' | 'booth' | 'high_top';
      table_status: 'available' | 'reserved' | 'occupied' | 'out_of_service';
    };
    CompositeTypes: {
      gbp_content_retention_readiness_v1: GbpContentRetentionReadinessV1;
      gbp_content_retention_result_v1: GbpContentRetentionResultV1;
      gbp_core_outbox_census_v1: GbpCoreOutboxCensusV1;
      gbp_pubsub_receipt_result_v1: GbpPubsubReceiptResultV1;
      gbp_scheduled_refresh_result_v1: GbpScheduledRefreshResultV1;
      gbp_terminal_notice_census_v1: GbpTerminalNoticeCensusV1;
      gbp_write_bundle_enqueue_result_v1: GbpWriteBundleEnqueueResultV1;
      gbp_write_grant_issue_v1: GbpWriteGrantIssueV1;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, 'public'>];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
    ? (DefaultSchema['Tables'] & DefaultSchema['Views'])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema['Tables']
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema['Tables']
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema['Enums']
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums']
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums'][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema['Enums']
    ? DefaultSchema['Enums'][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema['CompositeTypes']
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes']
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes'][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema['CompositeTypes']
    ? DefaultSchema['CompositeTypes'][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  auth: {
    Enums: {
      aal_level: ['aal1', 'aal2', 'aal3'],
      code_challenge_method: ['s256', 'plain'],
      factor_status: ['unverified', 'verified'],
      factor_type: ['totp', 'webauthn', 'phone'],
      oauth_authorization_status: ['pending', 'approved', 'denied', 'expired'],
      oauth_client_type: ['public', 'confidential'],
      oauth_registration_type: ['dynamic', 'manual'],
      oauth_response_type: ['code'],
      one_time_token_type: [
        'confirmation_token',
        'reauthentication_token',
        'recovery_token',
        'email_change_token_new',
        'email_change_token_current',
        'phone_change_token',
      ],
    },
  },
  public: {
    Enums: {
      analytics_event_type: [
        'booking.created',
        'booking.cancelled',
        'booking.allocated',
        'booking.waitlisted',
      ],
      booking_change_type: ['created', 'updated', 'cancelled', 'deleted'],
      booking_status: [
        'confirmed',
        'pending',
        'cancelled',
        'completed',
        'PRIORITY_WAITLIST',
        'no_show',
        'pending_allocation',
        'checked_in',
      ],
      capacity_override_type: ['holiday', 'event', 'manual', 'emergency'],
      manual_assignment_session_state: [
        'none',
        'proposed',
        'held',
        'confirmed',
        'expired',
        'conflicted',
        'cancelled',
      ],
      seating_preference_type: ['any', 'indoor', 'outdoor', 'bar', 'window', 'quiet', 'booth'],
      table_category: ['bar', 'dining', 'lounge', 'patio', 'private'],
      table_hold_status: ['active', 'expired', 'confirmed', 'cancelled'],
      table_mobility: ['movable', 'fixed'],
      table_seating_type: ['standard', 'sofa', 'booth', 'high_top'],
      table_status: ['available', 'reserved', 'occupied', 'out_of_service'],
    },
  },
} as const;
