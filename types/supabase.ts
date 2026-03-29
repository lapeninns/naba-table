export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.1"
  }
  auth: {
    Tables: {
      audit_log_entries: {
        Row: {
          created_at: string | null
          id: string
          instance_id: string | null
          ip_address: string
          payload: Json | null
        }
        Insert: {
          created_at?: string | null
          id: string
          instance_id?: string | null
          ip_address?: string
          payload?: Json | null
        }
        Update: {
          created_at?: string | null
          id?: string
          instance_id?: string | null
          ip_address?: string
          payload?: Json | null
        }
        Relationships: []
      }
      flow_state: {
        Row: {
          auth_code: string | null
          auth_code_issued_at: string | null
          authentication_method: string
          code_challenge: string | null
          code_challenge_method:
            | Database["auth"]["Enums"]["code_challenge_method"]
            | null
          created_at: string | null
          email_optional: boolean
          id: string
          invite_token: string | null
          linking_target_id: string | null
          oauth_client_state_id: string | null
          provider_access_token: string | null
          provider_refresh_token: string | null
          provider_type: string
          referrer: string | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          auth_code?: string | null
          auth_code_issued_at?: string | null
          authentication_method: string
          code_challenge?: string | null
          code_challenge_method?:
            | Database["auth"]["Enums"]["code_challenge_method"]
            | null
          created_at?: string | null
          email_optional?: boolean
          id: string
          invite_token?: string | null
          linking_target_id?: string | null
          oauth_client_state_id?: string | null
          provider_access_token?: string | null
          provider_refresh_token?: string | null
          provider_type: string
          referrer?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          auth_code?: string | null
          auth_code_issued_at?: string | null
          authentication_method?: string
          code_challenge?: string | null
          code_challenge_method?:
            | Database["auth"]["Enums"]["code_challenge_method"]
            | null
          created_at?: string | null
          email_optional?: boolean
          id?: string
          invite_token?: string | null
          linking_target_id?: string | null
          oauth_client_state_id?: string | null
          provider_access_token?: string | null
          provider_refresh_token?: string | null
          provider_type?: string
          referrer?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      identities: {
        Row: {
          created_at: string | null
          email: string | null
          id: string
          identity_data: Json
          last_sign_in_at: string | null
          provider: string
          provider_id: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          email?: string | null
          id?: string
          identity_data: Json
          last_sign_in_at?: string | null
          provider: string
          provider_id: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          email?: string | null
          id?: string
          identity_data?: Json
          last_sign_in_at?: string | null
          provider?: string
          provider_id?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "identities_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      instances: {
        Row: {
          created_at: string | null
          id: string
          raw_base_config: string | null
          updated_at: string | null
          uuid: string | null
        }
        Insert: {
          created_at?: string | null
          id: string
          raw_base_config?: string | null
          updated_at?: string | null
          uuid?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          raw_base_config?: string | null
          updated_at?: string | null
          uuid?: string | null
        }
        Relationships: []
      }
      mfa_amr_claims: {
        Row: {
          authentication_method: string
          created_at: string
          id: string
          session_id: string
          updated_at: string
        }
        Insert: {
          authentication_method: string
          created_at: string
          id: string
          session_id: string
          updated_at: string
        }
        Update: {
          authentication_method?: string
          created_at?: string
          id?: string
          session_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "mfa_amr_claims_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      mfa_challenges: {
        Row: {
          created_at: string
          factor_id: string
          id: string
          ip_address: unknown
          otp_code: string | null
          verified_at: string | null
          web_authn_session_data: Json | null
        }
        Insert: {
          created_at: string
          factor_id: string
          id: string
          ip_address: unknown
          otp_code?: string | null
          verified_at?: string | null
          web_authn_session_data?: Json | null
        }
        Update: {
          created_at?: string
          factor_id?: string
          id?: string
          ip_address?: unknown
          otp_code?: string | null
          verified_at?: string | null
          web_authn_session_data?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "mfa_challenges_auth_factor_id_fkey"
            columns: ["factor_id"]
            isOneToOne: false
            referencedRelation: "mfa_factors"
            referencedColumns: ["id"]
          },
        ]
      }
      mfa_factors: {
        Row: {
          created_at: string
          factor_type: Database["auth"]["Enums"]["factor_type"]
          friendly_name: string | null
          id: string
          last_challenged_at: string | null
          last_webauthn_challenge_data: Json | null
          phone: string | null
          secret: string | null
          status: Database["auth"]["Enums"]["factor_status"]
          updated_at: string
          user_id: string
          web_authn_aaguid: string | null
          web_authn_credential: Json | null
        }
        Insert: {
          created_at: string
          factor_type: Database["auth"]["Enums"]["factor_type"]
          friendly_name?: string | null
          id: string
          last_challenged_at?: string | null
          last_webauthn_challenge_data?: Json | null
          phone?: string | null
          secret?: string | null
          status: Database["auth"]["Enums"]["factor_status"]
          updated_at: string
          user_id: string
          web_authn_aaguid?: string | null
          web_authn_credential?: Json | null
        }
        Update: {
          created_at?: string
          factor_type?: Database["auth"]["Enums"]["factor_type"]
          friendly_name?: string | null
          id?: string
          last_challenged_at?: string | null
          last_webauthn_challenge_data?: Json | null
          phone?: string | null
          secret?: string | null
          status?: Database["auth"]["Enums"]["factor_status"]
          updated_at?: string
          user_id?: string
          web_authn_aaguid?: string | null
          web_authn_credential?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "mfa_factors_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      oauth_authorizations: {
        Row: {
          approved_at: string | null
          authorization_code: string | null
          authorization_id: string
          client_id: string
          code_challenge: string | null
          code_challenge_method:
            | Database["auth"]["Enums"]["code_challenge_method"]
            | null
          created_at: string
          expires_at: string
          id: string
          nonce: string | null
          redirect_uri: string
          resource: string | null
          response_type: Database["auth"]["Enums"]["oauth_response_type"]
          scope: string
          state: string | null
          status: Database["auth"]["Enums"]["oauth_authorization_status"]
          user_id: string | null
        }
        Insert: {
          approved_at?: string | null
          authorization_code?: string | null
          authorization_id: string
          client_id: string
          code_challenge?: string | null
          code_challenge_method?:
            | Database["auth"]["Enums"]["code_challenge_method"]
            | null
          created_at?: string
          expires_at?: string
          id: string
          nonce?: string | null
          redirect_uri: string
          resource?: string | null
          response_type?: Database["auth"]["Enums"]["oauth_response_type"]
          scope: string
          state?: string | null
          status?: Database["auth"]["Enums"]["oauth_authorization_status"]
          user_id?: string | null
        }
        Update: {
          approved_at?: string | null
          authorization_code?: string | null
          authorization_id?: string
          client_id?: string
          code_challenge?: string | null
          code_challenge_method?:
            | Database["auth"]["Enums"]["code_challenge_method"]
            | null
          created_at?: string
          expires_at?: string
          id?: string
          nonce?: string | null
          redirect_uri?: string
          resource?: string | null
          response_type?: Database["auth"]["Enums"]["oauth_response_type"]
          scope?: string
          state?: string | null
          status?: Database["auth"]["Enums"]["oauth_authorization_status"]
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "oauth_authorizations_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "oauth_clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "oauth_authorizations_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      oauth_client_states: {
        Row: {
          code_verifier: string | null
          created_at: string
          id: string
          provider_type: string
        }
        Insert: {
          code_verifier?: string | null
          created_at: string
          id: string
          provider_type: string
        }
        Update: {
          code_verifier?: string | null
          created_at?: string
          id?: string
          provider_type?: string
        }
        Relationships: []
      }
      oauth_clients: {
        Row: {
          client_name: string | null
          client_secret_hash: string | null
          client_type: Database["auth"]["Enums"]["oauth_client_type"]
          client_uri: string | null
          created_at: string
          deleted_at: string | null
          grant_types: string
          id: string
          logo_uri: string | null
          redirect_uris: string
          registration_type: Database["auth"]["Enums"]["oauth_registration_type"]
          token_endpoint_auth_method: string
          updated_at: string
        }
        Insert: {
          client_name?: string | null
          client_secret_hash?: string | null
          client_type?: Database["auth"]["Enums"]["oauth_client_type"]
          client_uri?: string | null
          created_at?: string
          deleted_at?: string | null
          grant_types: string
          id: string
          logo_uri?: string | null
          redirect_uris: string
          registration_type: Database["auth"]["Enums"]["oauth_registration_type"]
          token_endpoint_auth_method: string
          updated_at?: string
        }
        Update: {
          client_name?: string | null
          client_secret_hash?: string | null
          client_type?: Database["auth"]["Enums"]["oauth_client_type"]
          client_uri?: string | null
          created_at?: string
          deleted_at?: string | null
          grant_types?: string
          id?: string
          logo_uri?: string | null
          redirect_uris?: string
          registration_type?: Database["auth"]["Enums"]["oauth_registration_type"]
          token_endpoint_auth_method?: string
          updated_at?: string
        }
        Relationships: []
      }
      oauth_consents: {
        Row: {
          client_id: string
          granted_at: string
          id: string
          revoked_at: string | null
          scopes: string
          user_id: string
        }
        Insert: {
          client_id: string
          granted_at?: string
          id: string
          revoked_at?: string | null
          scopes: string
          user_id: string
        }
        Update: {
          client_id?: string
          granted_at?: string
          id?: string
          revoked_at?: string | null
          scopes?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "oauth_consents_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "oauth_clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "oauth_consents_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      one_time_tokens: {
        Row: {
          created_at: string
          id: string
          relates_to: string
          token_hash: string
          token_type: Database["auth"]["Enums"]["one_time_token_type"]
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id: string
          relates_to: string
          token_hash: string
          token_type: Database["auth"]["Enums"]["one_time_token_type"]
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          relates_to?: string
          token_hash?: string
          token_type?: Database["auth"]["Enums"]["one_time_token_type"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "one_time_tokens_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      refresh_tokens: {
        Row: {
          created_at: string | null
          id: number
          instance_id: string | null
          parent: string | null
          revoked: boolean | null
          session_id: string | null
          token: string | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          id?: number
          instance_id?: string | null
          parent?: string | null
          revoked?: boolean | null
          session_id?: string | null
          token?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          id?: number
          instance_id?: string | null
          parent?: string | null
          revoked?: boolean | null
          session_id?: string | null
          token?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "refresh_tokens_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      saml_providers: {
        Row: {
          attribute_mapping: Json | null
          created_at: string | null
          entity_id: string
          id: string
          metadata_url: string | null
          metadata_xml: string
          name_id_format: string | null
          sso_provider_id: string
          updated_at: string | null
        }
        Insert: {
          attribute_mapping?: Json | null
          created_at?: string | null
          entity_id: string
          id: string
          metadata_url?: string | null
          metadata_xml: string
          name_id_format?: string | null
          sso_provider_id: string
          updated_at?: string | null
        }
        Update: {
          attribute_mapping?: Json | null
          created_at?: string | null
          entity_id?: string
          id?: string
          metadata_url?: string | null
          metadata_xml?: string
          name_id_format?: string | null
          sso_provider_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "saml_providers_sso_provider_id_fkey"
            columns: ["sso_provider_id"]
            isOneToOne: false
            referencedRelation: "sso_providers"
            referencedColumns: ["id"]
          },
        ]
      }
      saml_relay_states: {
        Row: {
          created_at: string | null
          flow_state_id: string | null
          for_email: string | null
          id: string
          redirect_to: string | null
          request_id: string
          sso_provider_id: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          flow_state_id?: string | null
          for_email?: string | null
          id: string
          redirect_to?: string | null
          request_id: string
          sso_provider_id: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          flow_state_id?: string | null
          for_email?: string | null
          id?: string
          redirect_to?: string | null
          request_id?: string
          sso_provider_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "saml_relay_states_flow_state_id_fkey"
            columns: ["flow_state_id"]
            isOneToOne: false
            referencedRelation: "flow_state"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "saml_relay_states_sso_provider_id_fkey"
            columns: ["sso_provider_id"]
            isOneToOne: false
            referencedRelation: "sso_providers"
            referencedColumns: ["id"]
          },
        ]
      }
      schema_migrations: {
        Row: {
          version: string
        }
        Insert: {
          version: string
        }
        Update: {
          version?: string
        }
        Relationships: []
      }
      sessions: {
        Row: {
          aal: Database["auth"]["Enums"]["aal_level"] | null
          created_at: string | null
          factor_id: string | null
          id: string
          ip: unknown
          not_after: string | null
          oauth_client_id: string | null
          refresh_token_counter: number | null
          refresh_token_hmac_key: string | null
          refreshed_at: string | null
          scopes: string | null
          tag: string | null
          updated_at: string | null
          user_agent: string | null
          user_id: string
        }
        Insert: {
          aal?: Database["auth"]["Enums"]["aal_level"] | null
          created_at?: string | null
          factor_id?: string | null
          id: string
          ip?: unknown
          not_after?: string | null
          oauth_client_id?: string | null
          refresh_token_counter?: number | null
          refresh_token_hmac_key?: string | null
          refreshed_at?: string | null
          scopes?: string | null
          tag?: string | null
          updated_at?: string | null
          user_agent?: string | null
          user_id: string
        }
        Update: {
          aal?: Database["auth"]["Enums"]["aal_level"] | null
          created_at?: string | null
          factor_id?: string | null
          id?: string
          ip?: unknown
          not_after?: string | null
          oauth_client_id?: string | null
          refresh_token_counter?: number | null
          refresh_token_hmac_key?: string | null
          refreshed_at?: string | null
          scopes?: string | null
          tag?: string | null
          updated_at?: string | null
          user_agent?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sessions_oauth_client_id_fkey"
            columns: ["oauth_client_id"]
            isOneToOne: false
            referencedRelation: "oauth_clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sessions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      sso_domains: {
        Row: {
          created_at: string | null
          domain: string
          id: string
          sso_provider_id: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          domain: string
          id: string
          sso_provider_id: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          domain?: string
          id?: string
          sso_provider_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sso_domains_sso_provider_id_fkey"
            columns: ["sso_provider_id"]
            isOneToOne: false
            referencedRelation: "sso_providers"
            referencedColumns: ["id"]
          },
        ]
      }
      sso_providers: {
        Row: {
          created_at: string | null
          disabled: boolean | null
          id: string
          resource_id: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          disabled?: boolean | null
          id: string
          resource_id?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          disabled?: boolean | null
          id?: string
          resource_id?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      users: {
        Row: {
          aud: string | null
          banned_until: string | null
          confirmation_sent_at: string | null
          confirmation_token: string | null
          confirmed_at: string | null
          created_at: string | null
          deleted_at: string | null
          email: string | null
          email_change: string | null
          email_change_confirm_status: number | null
          email_change_sent_at: string | null
          email_change_token_current: string | null
          email_change_token_new: string | null
          email_confirmed_at: string | null
          encrypted_password: string | null
          id: string
          instance_id: string | null
          invited_at: string | null
          is_anonymous: boolean
          is_sso_user: boolean
          is_super_admin: boolean | null
          last_sign_in_at: string | null
          phone: string | null
          phone_change: string | null
          phone_change_sent_at: string | null
          phone_change_token: string | null
          phone_confirmed_at: string | null
          raw_app_meta_data: Json | null
          raw_user_meta_data: Json | null
          reauthentication_sent_at: string | null
          reauthentication_token: string | null
          recovery_sent_at: string | null
          recovery_token: string | null
          role: string | null
          updated_at: string | null
        }
        Insert: {
          aud?: string | null
          banned_until?: string | null
          confirmation_sent_at?: string | null
          confirmation_token?: string | null
          confirmed_at?: string | null
          created_at?: string | null
          deleted_at?: string | null
          email?: string | null
          email_change?: string | null
          email_change_confirm_status?: number | null
          email_change_sent_at?: string | null
          email_change_token_current?: string | null
          email_change_token_new?: string | null
          email_confirmed_at?: string | null
          encrypted_password?: string | null
          id: string
          instance_id?: string | null
          invited_at?: string | null
          is_anonymous?: boolean
          is_sso_user?: boolean
          is_super_admin?: boolean | null
          last_sign_in_at?: string | null
          phone?: string | null
          phone_change?: string | null
          phone_change_sent_at?: string | null
          phone_change_token?: string | null
          phone_confirmed_at?: string | null
          raw_app_meta_data?: Json | null
          raw_user_meta_data?: Json | null
          reauthentication_sent_at?: string | null
          reauthentication_token?: string | null
          recovery_sent_at?: string | null
          recovery_token?: string | null
          role?: string | null
          updated_at?: string | null
        }
        Update: {
          aud?: string | null
          banned_until?: string | null
          confirmation_sent_at?: string | null
          confirmation_token?: string | null
          confirmed_at?: string | null
          created_at?: string | null
          deleted_at?: string | null
          email?: string | null
          email_change?: string | null
          email_change_confirm_status?: number | null
          email_change_sent_at?: string | null
          email_change_token_current?: string | null
          email_change_token_new?: string | null
          email_confirmed_at?: string | null
          encrypted_password?: string | null
          id?: string
          instance_id?: string | null
          invited_at?: string | null
          is_anonymous?: boolean
          is_sso_user?: boolean
          is_super_admin?: boolean | null
          last_sign_in_at?: string | null
          phone?: string | null
          phone_change?: string | null
          phone_change_sent_at?: string | null
          phone_change_token?: string | null
          phone_confirmed_at?: string | null
          raw_app_meta_data?: Json | null
          raw_user_meta_data?: Json | null
          reauthentication_sent_at?: string | null
          reauthentication_token?: string | null
          recovery_sent_at?: string | null
          recovery_token?: string | null
          role?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      email: { Args: never; Returns: string }
      jwt: { Args: never; Returns: Json }
      role: { Args: never; Returns: string }
      uid: { Args: never; Returns: string }
    }
    Enums: {
      aal_level: "aal1" | "aal2" | "aal3"
      code_challenge_method: "s256" | "plain"
      factor_status: "unverified" | "verified"
      factor_type: "totp" | "webauthn" | "phone"
      oauth_authorization_status: "pending" | "approved" | "denied" | "expired"
      oauth_client_type: "public" | "confidential"
      oauth_registration_type: "dynamic" | "manual"
      oauth_response_type: "code"
      one_time_token_type:
        | "confirmation_token"
        | "reauthentication_token"
        | "recovery_token"
        | "email_change_token_new"
        | "email_change_token_current"
        | "phone_change_token"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      _migrations: {
        Row: {
          id: number
          name: string
          status: string | null
          timestamp: string | null
        }
        Insert: {
          id?: number
          name: string
          status?: string | null
          timestamp?: string | null
        }
        Update: {
          id?: number
          name?: string
          status?: string | null
          timestamp?: string | null
        }
        Relationships: []
      }
      allocations: {
        Row: {
          booking_id: string | null
          created_at: string
          created_by: string | null
          id: string
          is_maintenance: boolean
          resource_id: string
          resource_type: string
          restaurant_id: string
          shadow: boolean
          updated_at: string
          window: unknown
        }
        Insert: {
          booking_id?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          is_maintenance?: boolean
          resource_id: string
          resource_type: string
          restaurant_id: string
          shadow?: boolean
          updated_at?: string
          window: unknown
        }
        Update: {
          booking_id?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          is_maintenance?: boolean
          resource_id?: string
          resource_type?: string
          restaurant_id?: string
          shadow?: boolean
          updated_at?: string
          window?: unknown
        }
        Relationships: [
          {
            foreignKeyName: "allocations_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "allocations_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      allocations_archive: {
        Row: {
          archived_at: string
          booking_id: string | null
          created_at: string
          created_by: string | null
          id: string
          is_maintenance: boolean
          resource_id: string
          resource_type: string
          restaurant_id: string
          shadow: boolean
          updated_at: string
          window: unknown
        }
        Insert: {
          archived_at?: string
          booking_id?: string | null
          created_at: string
          created_by?: string | null
          id: string
          is_maintenance?: boolean
          resource_id: string
          resource_type: string
          restaurant_id: string
          shadow?: boolean
          updated_at: string
          window: unknown
        }
        Update: {
          archived_at?: string
          booking_id?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          is_maintenance?: boolean
          resource_id?: string
          resource_type?: string
          restaurant_id?: string
          shadow?: boolean
          updated_at?: string
          window?: unknown
        }
        Relationships: []
      }
      allowed_capacities: {
        Row: {
          capacity: number
          created_at: string
          restaurant_id: string
          updated_at: string
        }
        Insert: {
          capacity: number
          created_at?: string
          restaurant_id: string
          updated_at?: string
        }
        Update: {
          capacity?: number
          created_at?: string
          restaurant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "allowed_capacities_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      analytics_events: {
        Row: {
          booking_id: string
          created_at: string
          customer_id: string | null
          emitted_by: string
          event_type: Database["public"]["Enums"]["analytics_event_type"]
          id: string
          occurred_at: string
          payload: Json
          restaurant_id: string
          schema_version: string
        }
        Insert: {
          booking_id: string
          created_at?: string
          customer_id?: string | null
          emitted_by?: string
          event_type: Database["public"]["Enums"]["analytics_event_type"]
          id?: string
          occurred_at: string
          payload: Json
          restaurant_id: string
          schema_version: string
        }
        Update: {
          booking_id?: string
          created_at?: string
          customer_id?: string | null
          emitted_by?: string
          event_type?: Database["public"]["Enums"]["analytics_event_type"]
          id?: string
          occurred_at?: string
          payload?: Json
          restaurant_id?: string
          schema_version?: string
        }
        Relationships: [
          {
            foreignKeyName: "analytics_events_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "analytics_events_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "analytics_events_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action: string
          actor: string | null
          created_at: string
          entity: string
          entity_id: string
          id: string
          metadata: Json | null
        }
        Insert: {
          action: string
          actor?: string | null
          created_at?: string
          entity: string
          entity_id: string
          id?: string
          metadata?: Json | null
        }
        Update: {
          action?: string
          actor?: string | null
          created_at?: string
          entity?: string
          entity_id?: string
          id?: string
          metadata?: Json | null
        }
        Relationships: []
      }
      booking_assignment_attempts: {
        Row: {
          attempt_no: number
          booking_id: string
          created_at: string
          id: string
          metadata: Json
          reason: string | null
          result: string
          strategy: string
        }
        Insert: {
          attempt_no: number
          booking_id: string
          created_at?: string
          id?: string
          metadata?: Json
          reason?: string | null
          result: string
          strategy: string
        }
        Update: {
          attempt_no?: number
          booking_id?: string
          created_at?: string
          id?: string
          metadata?: Json
          reason?: string | null
          result?: string
          strategy?: string
        }
        Relationships: [
          {
            foreignKeyName: "booking_assignment_attempts_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
        ]
      }
      booking_assignment_idempotency: {
        Row: {
          assignment_window: unknown
          booking_id: string
          created_at: string
          expires_at: string | null
          idempotency_key: string
          merge_group_allocation_id: string | null
          payload_checksum: string
          table_ids: string[]
          table_set_hash: string | null
        }
        Insert: {
          assignment_window: unknown
          booking_id: string
          created_at?: string
          expires_at?: string | null
          idempotency_key: string
          merge_group_allocation_id?: string | null
          payload_checksum?: string
          table_ids?: string[]
          table_set_hash?: string | null
        }
        Update: {
          assignment_window?: unknown
          booking_id?: string
          created_at?: string
          expires_at?: string | null
          idempotency_key?: string
          merge_group_allocation_id?: string | null
          payload_checksum?: string
          table_ids?: string[]
          table_set_hash?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "booking_assignment_idempotency_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_assignment_idempotency_merge_group_fkey"
            columns: ["merge_group_allocation_id"]
            isOneToOne: false
            referencedRelation: "allocations"
            referencedColumns: ["id"]
          },
        ]
      }
      booking_confirmation_results: {
        Row: {
          actor_id: string | null
          assignment_window: unknown
          booking_id: string
          created_at: string
          hold_id: string
          idempotency_key: string
          metadata: Json
          restaurant_id: string
          table_ids: string[]
        }
        Insert: {
          actor_id?: string | null
          assignment_window: unknown
          booking_id: string
          created_at?: string
          hold_id: string
          idempotency_key: string
          metadata?: Json
          restaurant_id: string
          table_ids: string[]
        }
        Update: {
          actor_id?: string | null
          assignment_window?: unknown
          booking_id?: string
          created_at?: string
          hold_id?: string
          idempotency_key?: string
          metadata?: Json
          restaurant_id?: string
          table_ids?: string[]
        }
        Relationships: [
          {
            foreignKeyName: "booking_confirmation_results_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_confirmation_results_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      booking_occasions: {
        Row: {
          availability: Json
          created_at: string
          created_by: string | null
          default_duration_minutes: number
          deleted_at: string | null
          description: string | null
          display_order: number
          is_active: boolean
          is_builtin: boolean
          key: string
          label: string
          short_label: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          availability?: Json
          created_at?: string
          created_by?: string | null
          default_duration_minutes?: number
          deleted_at?: string | null
          description?: string | null
          display_order?: number
          is_active?: boolean
          is_builtin?: boolean
          key: string
          label: string
          short_label: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          availability?: Json
          created_at?: string
          created_by?: string | null
          default_duration_minutes?: number
          deleted_at?: string | null
          description?: string | null
          display_order?: number
          is_active?: boolean
          is_builtin?: boolean
          key?: string
          label?: string
          short_label?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      booking_occasions_audit: {
        Row: {
          action: string
          after_change: Json | null
          before_change: Json | null
          changed_at: string
          changed_by: string | null
          id: string
          occasion_key: string
        }
        Insert: {
          action: string
          after_change?: Json | null
          before_change?: Json | null
          changed_at?: string
          changed_by?: string | null
          id?: string
          occasion_key: string
        }
        Update: {
          action?: string
          after_change?: Json | null
          before_change?: Json | null
          changed_at?: string
          changed_by?: string | null
          id?: string
          occasion_key?: string
        }
        Relationships: []
      }
      booking_slots: {
        Row: {
          available_capacity: number
          created_at: string
          id: string
          reserved_count: number
          restaurant_id: string
          service_period_id: string | null
          slot_date: string
          slot_time: string
          updated_at: string
          version: number
        }
        Insert: {
          available_capacity?: number
          created_at?: string
          id?: string
          reserved_count?: number
          restaurant_id: string
          service_period_id?: string | null
          slot_date: string
          slot_time: string
          updated_at?: string
          version?: number
        }
        Update: {
          available_capacity?: number
          created_at?: string
          id?: string
          reserved_count?: number
          restaurant_id?: string
          service_period_id?: string | null
          slot_date?: string
          slot_time?: string
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "booking_slots_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_slots_service_period_id_fkey"
            columns: ["service_period_id"]
            isOneToOne: false
            referencedRelation: "restaurant_service_periods"
            referencedColumns: ["id"]
          },
        ]
      }
      booking_state_history: {
        Row: {
          booking_id: string
          changed_at: string
          changed_by: string | null
          from_status: Database["public"]["Enums"]["booking_status"] | null
          id: number
          metadata: Json
          reason: string | null
          to_status: Database["public"]["Enums"]["booking_status"]
        }
        Insert: {
          booking_id: string
          changed_at?: string
          changed_by?: string | null
          from_status?: Database["public"]["Enums"]["booking_status"] | null
          id?: number
          metadata?: Json
          reason?: string | null
          to_status: Database["public"]["Enums"]["booking_status"]
        }
        Update: {
          booking_id?: string
          changed_at?: string
          changed_by?: string | null
          from_status?: Database["public"]["Enums"]["booking_status"] | null
          id?: number
          metadata?: Json
          reason?: string | null
          to_status?: Database["public"]["Enums"]["booking_status"]
        }
        Relationships: [
          {
            foreignKeyName: "booking_state_history_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
        ]
      }
      booking_table_assignments: {
        Row: {
          allocation_id: string | null
          assigned_at: string
          assigned_by: string | null
          assignment_window: unknown
          booking_id: string
          created_at: string
          end_at: string | null
          id: string
          idempotency_key: string | null
          merge_group_id: string | null
          notes: string | null
          slot_id: string | null
          start_at: string | null
          table_id: string
          updated_at: string
        }
        Insert: {
          allocation_id?: string | null
          assigned_at?: string
          assigned_by?: string | null
          assignment_window?: unknown
          booking_id: string
          created_at?: string
          end_at?: string | null
          id?: string
          idempotency_key?: string | null
          merge_group_id?: string | null
          notes?: string | null
          slot_id?: string | null
          start_at?: string | null
          table_id: string
          updated_at?: string
        }
        Update: {
          allocation_id?: string | null
          assigned_at?: string
          assigned_by?: string | null
          assignment_window?: unknown
          booking_id?: string
          created_at?: string
          end_at?: string | null
          id?: string
          idempotency_key?: string | null
          merge_group_id?: string | null
          notes?: string | null
          slot_id?: string | null
          start_at?: string | null
          table_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "booking_table_assignments_allocation_id_fkey"
            columns: ["allocation_id"]
            isOneToOne: false
            referencedRelation: "allocations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_table_assignments_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_table_assignments_merge_group_id_fkey"
            columns: ["merge_group_id"]
            isOneToOne: false
            referencedRelation: "allocations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_table_assignments_slot_id_fkey"
            columns: ["slot_id"]
            isOneToOne: false
            referencedRelation: "booking_slots"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_table_assignments_table_id_fkey"
            columns: ["table_id"]
            isOneToOne: false
            referencedRelation: "table_inventory"
            referencedColumns: ["id"]
          },
        ]
      }
      booking_versions: {
        Row: {
          booking_id: string
          change_type: Database["public"]["Enums"]["booking_change_type"]
          changed_at: string
          changed_by: string | null
          created_at: string
          new_data: Json | null
          old_data: Json | null
          restaurant_id: string
          version_id: string
        }
        Insert: {
          booking_id: string
          change_type: Database["public"]["Enums"]["booking_change_type"]
          changed_at?: string
          changed_by?: string | null
          created_at?: string
          new_data?: Json | null
          old_data?: Json | null
          restaurant_id: string
          version_id?: string
        }
        Update: {
          booking_id?: string
          change_type?: Database["public"]["Enums"]["booking_change_type"]
          changed_at?: string
          changed_by?: string | null
          created_at?: string
          new_data?: Json | null
          old_data?: Json | null
          restaurant_id?: string
          version_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "booking_versions_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_versions_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      bookings: {
        Row: {
          assigned_zone_id: string | null
          assignment_state_version: number
          assignment_strategy: string | null
          auth_user_id: string | null
          auto_assign_idempotency_key: string | null
          auto_assign_last_result: Json | null
          booking_date: string
          booking_type: string
          checked_in_at: string | null
          checked_out_at: string | null
          client_request_id: string
          confirmation_token: string | null
          confirmation_token_expires_at: string | null
          confirmation_token_used_at: string | null
          created_at: string
          customer_email: string
          customer_id: string
          customer_name: string
          customer_phone: string
          details: Json | null
          end_at: string | null
          end_time: string
          id: string
          idempotency_key: string | null
          loyalty_points_awarded: number
          marketing_opt_in: boolean
          notes: string | null
          party_size: number
          pending_ref: string | null
          reference: string
          restaurant_id: string
          seating_preference: Database["public"]["Enums"]["seating_preference_type"]
          source: string
          start_at: string | null
          start_time: string
          status: Database["public"]["Enums"]["booking_status"]
          updated_at: string
        }
        Insert: {
          assigned_zone_id?: string | null
          assignment_state_version?: number
          assignment_strategy?: string | null
          auth_user_id?: string | null
          auto_assign_idempotency_key?: string | null
          auto_assign_last_result?: Json | null
          booking_date: string
          booking_type?: string
          checked_in_at?: string | null
          checked_out_at?: string | null
          client_request_id?: string
          confirmation_token?: string | null
          confirmation_token_expires_at?: string | null
          confirmation_token_used_at?: string | null
          created_at?: string
          customer_email: string
          customer_id: string
          customer_name: string
          customer_phone: string
          details?: Json | null
          end_at?: string | null
          end_time: string
          id?: string
          idempotency_key?: string | null
          loyalty_points_awarded?: number
          marketing_opt_in?: boolean
          notes?: string | null
          party_size: number
          pending_ref?: string | null
          reference: string
          restaurant_id: string
          seating_preference?: Database["public"]["Enums"]["seating_preference_type"]
          source?: string
          start_at?: string | null
          start_time: string
          status?: Database["public"]["Enums"]["booking_status"]
          updated_at?: string
        }
        Update: {
          assigned_zone_id?: string | null
          assignment_state_version?: number
          assignment_strategy?: string | null
          auth_user_id?: string | null
          auto_assign_idempotency_key?: string | null
          auto_assign_last_result?: Json | null
          booking_date?: string
          booking_type?: string
          checked_in_at?: string | null
          checked_out_at?: string | null
          client_request_id?: string
          confirmation_token?: string | null
          confirmation_token_expires_at?: string | null
          confirmation_token_used_at?: string | null
          created_at?: string
          customer_email?: string
          customer_id?: string
          customer_name?: string
          customer_phone?: string
          details?: Json | null
          end_at?: string | null
          end_time?: string
          id?: string
          idempotency_key?: string | null
          loyalty_points_awarded?: number
          marketing_opt_in?: boolean
          notes?: string | null
          party_size?: number
          pending_ref?: string | null
          reference?: string
          restaurant_id?: string
          seating_preference?: Database["public"]["Enums"]["seating_preference_type"]
          source?: string
          start_at?: string | null
          start_time?: string
          status?: Database["public"]["Enums"]["booking_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "bookings_assigned_zone_id_fkey"
            columns: ["assigned_zone_id"]
            isOneToOne: false
            referencedRelation: "zones"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_booking_type_fkey"
            columns: ["booking_type"]
            isOneToOne: false
            referencedRelation: "booking_occasions"
            referencedColumns: ["key"]
          },
          {
            foreignKeyName: "bookings_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      capacity_outbox: {
        Row: {
          attempt_count: number
          booking_id: string | null
          created_at: string
          dedupe_key: string | null
          event_type: string
          id: string
          idempotency_key: string | null
          next_attempt_at: string | null
          payload: Json
          restaurant_id: string | null
          status: string
          updated_at: string
        }
        Insert: {
          attempt_count?: number
          booking_id?: string | null
          created_at?: string
          dedupe_key?: string | null
          event_type: string
          id?: string
          idempotency_key?: string | null
          next_attempt_at?: string | null
          payload?: Json
          restaurant_id?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          attempt_count?: number
          booking_id?: string | null
          created_at?: string
          dedupe_key?: string | null
          event_type?: string
          id?: string
          idempotency_key?: string | null
          next_attempt_at?: string | null
          payload?: Json
          restaurant_id?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      customer_profiles: {
        Row: {
          customer_id: string
          first_booking_at: string | null
          last_booking_at: string | null
          last_marketing_opt_in_at: string | null
          marketing_opt_in: boolean
          notes: string | null
          preferences: Json
          total_bookings: number
          total_cancellations: number
          total_covers: number
          updated_at: string
        }
        Insert: {
          customer_id: string
          first_booking_at?: string | null
          last_booking_at?: string | null
          last_marketing_opt_in_at?: string | null
          marketing_opt_in?: boolean
          notes?: string | null
          preferences?: Json
          total_bookings?: number
          total_cancellations?: number
          total_covers?: number
          updated_at?: string
        }
        Update: {
          customer_id?: string
          first_booking_at?: string | null
          last_booking_at?: string | null
          last_marketing_opt_in_at?: string | null
          marketing_opt_in?: boolean
          notes?: string | null
          preferences?: Json
          total_bookings?: number
          total_cancellations?: number
          total_covers?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "customer_profiles_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: true
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      customers: {
        Row: {
          auth_user_id: string | null
          created_at: string
          email: string
          email_normalized: string | null
          full_name: string
          id: string
          marketing_opt_in: boolean
          notes: string | null
          phone: string
          phone_normalized: string | null
          restaurant_id: string
          updated_at: string
          user_profile_id: string | null
        }
        Insert: {
          auth_user_id?: string | null
          created_at?: string
          email: string
          email_normalized?: string | null
          full_name: string
          id?: string
          marketing_opt_in?: boolean
          notes?: string | null
          phone: string
          phone_normalized?: string | null
          restaurant_id: string
          updated_at?: string
          user_profile_id?: string | null
        }
        Update: {
          auth_user_id?: string | null
          created_at?: string
          email?: string
          email_normalized?: string | null
          full_name?: string
          id?: string
          marketing_opt_in?: boolean
          notes?: string | null
          phone?: string
          phone_normalized?: string | null
          restaurant_id?: string
          updated_at?: string
          user_profile_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "customers_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customers_user_profile_id_fkey"
            columns: ["user_profile_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      demand_profiles: {
        Row: {
          created_at: string
          day_of_week: number
          end_minute: number | null
          id: string
          multiplier: number
          priority: number | null
          restaurant_id: string
          service_window: string
          start_minute: number | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          day_of_week: number
          end_minute?: number | null
          id?: string
          multiplier?: number
          priority?: number | null
          restaurant_id: string
          service_window: string
          start_minute?: number | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          day_of_week?: number
          end_minute?: number | null
          id?: string
          multiplier?: number
          priority?: number | null
          restaurant_id?: string
          service_window?: string
          start_minute?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "demand_profiles_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      email_delivery_log: {
        Row: {
          booking_id: string | null
          created_at: string
          email_type: string | null
          error: string | null
          id: string
          message_id: string
          metadata: Json | null
          occurred_at: string
          provider: string | null
          provider_event_id: string | null
          recipient_email: string
          restaurant_id: string | null
          status: string
          template_type: string | null
        }
        Insert: {
          booking_id?: string | null
          created_at?: string
          email_type?: string | null
          error?: string | null
          id?: string
          message_id: string
          metadata?: Json | null
          occurred_at?: string
          provider?: string | null
          provider_event_id?: string | null
          recipient_email: string
          restaurant_id?: string | null
          status: string
          template_type?: string | null
        }
        Update: {
          booking_id?: string | null
          created_at?: string
          email_type?: string | null
          error?: string | null
          id?: string
          message_id?: string
          metadata?: Json | null
          occurred_at?: string
          provider?: string | null
          provider_event_id?: string | null
          recipient_email?: string
          restaurant_id?: string | null
          status?: string
          template_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "email_delivery_log_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_delivery_log_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      email_dispatch_intents: {
        Row: {
          attempts_made: number
          backoff_delay_ms: number
          backoff_type: string
          booking_id: string
          cancelled_at: string | null
          claimed_at: string | null
          created_at: string
          dedupe_key: string
          email_type: string
          id: string
          last_attempt_at: string | null
          last_error: string | null
          max_attempts: number
          payload: Json
          processed_at: string | null
          restaurant_id: string | null
          scheduled_for: string
          status: string
          updated_at: string
        }
        Insert: {
          attempts_made?: number
          backoff_delay_ms?: number
          backoff_type?: string
          booking_id: string
          cancelled_at?: string | null
          claimed_at?: string | null
          created_at?: string
          dedupe_key: string
          email_type: string
          id?: string
          last_attempt_at?: string | null
          last_error?: string | null
          max_attempts?: number
          payload?: Json
          processed_at?: string | null
          restaurant_id?: string | null
          scheduled_for: string
          status?: string
          updated_at?: string
        }
        Update: {
          attempts_made?: number
          backoff_delay_ms?: number
          backoff_type?: string
          booking_id?: string
          cancelled_at?: string | null
          claimed_at?: string | null
          created_at?: string
          dedupe_key?: string
          email_type?: string
          id?: string
          last_attempt_at?: string | null
          last_error?: string | null
          max_attempts?: number
          payload?: Json
          processed_at?: string | null
          restaurant_id?: string | null
          scheduled_for?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "email_dispatch_intents_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_dispatch_intents_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      feature_flag_overrides: {
        Row: {
          environment: string
          flag: string
          id: string
          notes: Json | null
          updated_at: string
          updated_by: string | null
          value: boolean
        }
        Insert: {
          environment: string
          flag: string
          id?: string
          notes?: Json | null
          updated_at?: string
          updated_by?: string | null
          value: boolean
        }
        Update: {
          environment?: string
          flag?: string
          id?: string
          notes?: Json | null
          updated_at?: string
          updated_by?: string | null
          value?: boolean
        }
        Relationships: []
      }
      leads: {
        Row: {
          created_at: string
          email: string
          id: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
        }
        Relationships: []
      }
      manual_assignment_sessions: {
        Row: {
          adjacency_version: string | null
          assignments_version: string | null
          booking_id: string
          context_version: string | null
          created_at: string
          created_by: string | null
          expires_at: string | null
          flags_version: string | null
          hold_id: string | null
          holds_version: string | null
          id: string
          policy_version: string | null
          restaurant_id: string
          selection: Json | null
          selection_version: number
          snapshot_hash: string | null
          state: Database["public"]["Enums"]["manual_assignment_session_state"]
          table_version: string | null
          updated_at: string
          window_version: string | null
        }
        Insert: {
          adjacency_version?: string | null
          assignments_version?: string | null
          booking_id: string
          context_version?: string | null
          created_at?: string
          created_by?: string | null
          expires_at?: string | null
          flags_version?: string | null
          hold_id?: string | null
          holds_version?: string | null
          id?: string
          policy_version?: string | null
          restaurant_id: string
          selection?: Json | null
          selection_version?: number
          snapshot_hash?: string | null
          state?: Database["public"]["Enums"]["manual_assignment_session_state"]
          table_version?: string | null
          updated_at?: string
          window_version?: string | null
        }
        Update: {
          adjacency_version?: string | null
          assignments_version?: string | null
          booking_id?: string
          context_version?: string | null
          created_at?: string
          created_by?: string | null
          expires_at?: string | null
          flags_version?: string | null
          hold_id?: string | null
          holds_version?: string | null
          id?: string
          policy_version?: string | null
          restaurant_id?: string
          selection?: Json | null
          selection_version?: number
          snapshot_hash?: string | null
          state?: Database["public"]["Enums"]["manual_assignment_session_state"]
          table_version?: string | null
          updated_at?: string
          window_version?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "manual_assignment_sessions_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: true
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "manual_assignment_sessions_hold_fkey"
            columns: ["hold_id"]
            isOneToOne: false
            referencedRelation: "table_holds"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "manual_assignment_sessions_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      merge_rules: {
        Row: {
          created_at: string
          cross_category_merge: boolean
          enabled: boolean
          from_a: number
          from_b: number
          id: string
          require_adjacency: boolean
          require_same_zone: boolean
          to_capacity: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          cross_category_merge?: boolean
          enabled?: boolean
          from_a: number
          from_b: number
          id?: string
          require_adjacency?: boolean
          require_same_zone?: boolean
          to_capacity: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          cross_category_merge?: boolean
          enabled?: boolean
          from_a?: number
          from_b?: number
          id?: string
          require_adjacency?: boolean
          require_same_zone?: boolean
          to_capacity?: number
          updated_at?: string
        }
        Relationships: []
      }
      observability_events: {
        Row: {
          booking_id: string | null
          context: Json | null
          created_at: string
          event_type: string
          id: string
          restaurant_id: string | null
          severity: string
          source: string
        }
        Insert: {
          booking_id?: string | null
          context?: Json | null
          created_at?: string
          event_type: string
          id?: string
          restaurant_id?: string | null
          severity?: string
          source: string
        }
        Update: {
          booking_id?: string | null
          context?: Json | null
          created_at?: string
          event_type?: string
          id?: string
          restaurant_id?: string | null
          severity?: string
          source?: string
        }
        Relationships: []
      }
      profile_update_requests: {
        Row: {
          applied_at: string
          id: string
          idempotency_key: string
          payload_hash: string
          profile_id: string
        }
        Insert: {
          applied_at?: string
          id?: string
          idempotency_key: string
          payload_hash: string
          profile_id: string
        }
        Update: {
          applied_at?: string
          id?: string
          idempotency_key?: string
          payload_hash?: string
          profile_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "profile_update_requests_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          email: string | null
          has_access: boolean
          id: string
          image: string | null
          name: string | null
          phone: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          has_access?: boolean
          id: string
          image?: string | null
          name?: string | null
          phone?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string | null
          has_access?: boolean
          id?: string
          image?: string | null
          name?: string | null
          phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      restaurant_capacity_rules: {
        Row: {
          created_at: string
          day_of_week: number | null
          effective_date: string | null
          id: string
          label: string | null
          max_covers: number | null
          max_parties: number | null
          notes: string | null
          override_type:
            | Database["public"]["Enums"]["capacity_override_type"]
            | null
          restaurant_id: string
          service_period_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          day_of_week?: number | null
          effective_date?: string | null
          id?: string
          label?: string | null
          max_covers?: number | null
          max_parties?: number | null
          notes?: string | null
          override_type?:
            | Database["public"]["Enums"]["capacity_override_type"]
            | null
          restaurant_id: string
          service_period_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          day_of_week?: number | null
          effective_date?: string | null
          id?: string
          label?: string | null
          max_covers?: number | null
          max_parties?: number | null
          notes?: string | null
          override_type?:
            | Database["public"]["Enums"]["capacity_override_type"]
            | null
          restaurant_id?: string
          service_period_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "restaurant_capacity_rules_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "restaurant_capacity_rules_service_period_id_fkey"
            columns: ["service_period_id"]
            isOneToOne: false
            referencedRelation: "restaurant_service_periods"
            referencedColumns: ["id"]
          },
        ]
      }
      restaurant_invites: {
        Row: {
          accepted_at: string | null
          created_at: string
          email: string
          email_normalized: string | null
          expires_at: string
          id: string
          invited_by: string | null
          restaurant_id: string
          revoked_at: string | null
          role: string
          status: string
          token_hash: string
          updated_at: string
        }
        Insert: {
          accepted_at?: string | null
          created_at?: string
          email: string
          email_normalized?: string | null
          expires_at: string
          id?: string
          invited_by?: string | null
          restaurant_id: string
          revoked_at?: string | null
          role: string
          status?: string
          token_hash: string
          updated_at?: string
        }
        Update: {
          accepted_at?: string | null
          created_at?: string
          email?: string
          email_normalized?: string | null
          expires_at?: string
          id?: string
          invited_by?: string | null
          restaurant_id?: string
          revoked_at?: string | null
          role?: string
          status?: string
          token_hash?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "restaurant_invites_invited_by_fkey"
            columns: ["invited_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "restaurant_invites_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      restaurant_memberships: {
        Row: {
          created_at: string
          restaurant_id: string
          role: string
          user_id: string
        }
        Insert: {
          created_at?: string
          restaurant_id: string
          role: string
          user_id: string
        }
        Update: {
          created_at?: string
          restaurant_id?: string
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "restaurant_memberships_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      restaurant_operating_hours: {
        Row: {
          closes_at: string | null
          created_at: string
          day_of_week: number | null
          effective_date: string | null
          id: string
          is_closed: boolean
          notes: string | null
          opens_at: string | null
          reservation_interval_minutes: number | null
          reservation_slot_times: string[] | null
          restaurant_id: string
          updated_at: string
        }
        Insert: {
          closes_at?: string | null
          created_at?: string
          day_of_week?: number | null
          effective_date?: string | null
          id?: string
          is_closed?: boolean
          notes?: string | null
          opens_at?: string | null
          reservation_interval_minutes?: number | null
          reservation_slot_times?: string[] | null
          restaurant_id: string
          updated_at?: string
        }
        Update: {
          closes_at?: string | null
          created_at?: string
          day_of_week?: number | null
          effective_date?: string | null
          id?: string
          is_closed?: boolean
          notes?: string | null
          opens_at?: string | null
          reservation_interval_minutes?: number | null
          reservation_slot_times?: string[] | null
          restaurant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "restaurant_operating_hours_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      restaurant_service_periods: {
        Row: {
          booking_option: string
          created_at: string
          day_of_week: number | null
          end_time: string
          id: string
          name: string
          restaurant_id: string
          start_time: string
          updated_at: string
        }
        Insert: {
          booking_option?: string
          created_at?: string
          day_of_week?: number | null
          end_time: string
          id?: string
          name: string
          restaurant_id: string
          start_time: string
          updated_at?: string
        }
        Update: {
          booking_option?: string
          created_at?: string
          day_of_week?: number | null
          end_time?: string
          id?: string
          name?: string
          restaurant_id?: string
          start_time?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "restaurant_service_periods_booking_option_fkey"
            columns: ["booking_option"]
            isOneToOne: false
            referencedRelation: "booking_occasions"
            referencedColumns: ["key"]
          },
          {
            foreignKeyName: "restaurant_service_periods_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      restaurant_turn_bands: {
        Row: {
          booking_option: string
          created_at: string
          duration_minutes: number
          id: string
          max_party_size: number
          restaurant_id: string
          updated_at: string
        }
        Insert: {
          booking_option: string
          created_at?: string
          duration_minutes: number
          id?: string
          max_party_size: number
          restaurant_id: string
          updated_at?: string
        }
        Update: {
          booking_option?: string
          created_at?: string
          duration_minutes?: number
          id?: string
          max_party_size?: number
          restaurant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "restaurant_turn_bands_booking_option_fkey"
            columns: ["booking_option"]
            isOneToOne: false
            referencedRelation: "booking_occasions"
            referencedColumns: ["key"]
          },
          {
            foreignKeyName: "restaurant_turn_bands_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      restaurants: {
        Row: {
          address: string | null
          booking_policy: string | null
          capacity: number | null
          contact_email: string | null
          contact_phone: string | null
          created_at: string
          email_send_reminder_24h: boolean
          email_send_reminder_short: boolean
          email_send_review_request: boolean
          email_templates: Json | null
          google_map_url: string | null
          google_review_url: string | null
          id: string
          is_active: boolean
          logo_url: string | null
          name: string
          reservation_default_duration_minutes: number
          reservation_interval_minutes: number
          reservation_last_seating_buffer_minutes: number
          reservation_lifecycle_grace_minutes: number | null
          slug: string
          timezone: string
          updated_at: string
        }
        Insert: {
          address?: string | null
          booking_policy?: string | null
          capacity?: number | null
          contact_email?: string | null
          contact_phone?: string | null
          created_at?: string
          email_send_reminder_24h?: boolean
          email_send_reminder_short?: boolean
          email_send_review_request?: boolean
          email_templates?: Json | null
          google_map_url?: string | null
          google_review_url?: string | null
          id?: string
          is_active?: boolean
          logo_url?: string | null
          name: string
          reservation_default_duration_minutes?: number
          reservation_interval_minutes?: number
          reservation_last_seating_buffer_minutes?: number
          reservation_lifecycle_grace_minutes?: number | null
          slug: string
          timezone?: string
          updated_at?: string
        }
        Update: {
          address?: string | null
          booking_policy?: string | null
          capacity?: number | null
          contact_email?: string | null
          contact_phone?: string | null
          created_at?: string
          email_send_reminder_24h?: boolean
          email_send_reminder_short?: boolean
          email_send_review_request?: boolean
          email_templates?: Json | null
          google_map_url?: string | null
          google_review_url?: string | null
          id?: string
          is_active?: boolean
          logo_url?: string | null
          name?: string
          reservation_default_duration_minutes?: number
          reservation_interval_minutes?: number
          reservation_last_seating_buffer_minutes?: number
          reservation_lifecycle_grace_minutes?: number | null
          slug?: string
          timezone?: string
          updated_at?: string
        }
        Relationships: []
      }
      service_policy: {
        Row: {
          allow_after_hours: boolean
          clean_buffer_minutes: number
          created_at: string
          dinner_end: string
          dinner_start: string
          id: string
          lunch_end: string
          lunch_start: string
          updated_at: string
        }
        Insert: {
          allow_after_hours?: boolean
          clean_buffer_minutes?: number
          created_at?: string
          dinner_end?: string
          dinner_start?: string
          id?: string
          lunch_end?: string
          lunch_start?: string
          updated_at?: string
        }
        Update: {
          allow_after_hours?: boolean
          clean_buffer_minutes?: number
          created_at?: string
          dinner_end?: string
          dinner_start?: string
          id?: string
          lunch_end?: string
          lunch_start?: string
          updated_at?: string
        }
        Relationships: []
      }
      strategic_configs: {
        Row: {
          created_at: string
          demand_multiplier_override: number | null
          future_conflict_penalty: number | null
          id: string
          restaurant_id: string | null
          scarcity_weight: number
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          demand_multiplier_override?: number | null
          future_conflict_penalty?: number | null
          id?: string
          restaurant_id?: string | null
          scarcity_weight?: number
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          demand_multiplier_override?: number | null
          future_conflict_penalty?: number | null
          id?: string
          restaurant_id?: string | null
          scarcity_weight?: number
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "strategic_configs_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: true
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      table_adjacencies: {
        Row: {
          created_at: string
          table_a: string
          table_b: string
        }
        Insert: {
          created_at?: string
          table_a: string
          table_b: string
        }
        Update: {
          created_at?: string
          table_a?: string
          table_b?: string
        }
        Relationships: [
          {
            foreignKeyName: "table_adjacencies_table_a_fkey"
            columns: ["table_a"]
            isOneToOne: false
            referencedRelation: "table_inventory"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "table_adjacencies_table_b_fkey"
            columns: ["table_b"]
            isOneToOne: false
            referencedRelation: "table_inventory"
            referencedColumns: ["id"]
          },
        ]
      }
      table_hold_members: {
        Row: {
          created_at: string
          hold_id: string
          id: string
          table_id: string
        }
        Insert: {
          created_at?: string
          hold_id: string
          id?: string
          table_id: string
        }
        Update: {
          created_at?: string
          hold_id?: string
          id?: string
          table_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "table_hold_members_hold_id_fkey"
            columns: ["hold_id"]
            isOneToOne: false
            referencedRelation: "table_holds"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "table_hold_members_table_id_fkey"
            columns: ["table_id"]
            isOneToOne: false
            referencedRelation: "table_inventory"
            referencedColumns: ["id"]
          },
        ]
      }
      table_hold_windows: {
        Row: {
          booking_id: string | null
          end_at: string
          expires_at: string
          hold_id: string
          hold_window: unknown
          restaurant_id: string
          start_at: string
          table_id: string
        }
        Insert: {
          booking_id?: string | null
          end_at: string
          expires_at: string
          hold_id: string
          hold_window?: unknown
          restaurant_id: string
          start_at: string
          table_id: string
        }
        Update: {
          booking_id?: string | null
          end_at?: string
          expires_at?: string
          hold_id?: string
          hold_window?: unknown
          restaurant_id?: string
          start_at?: string
          table_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "table_hold_windows_hold_id_fkey"
            columns: ["hold_id"]
            isOneToOne: false
            referencedRelation: "table_holds"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "table_hold_windows_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "table_hold_windows_table_id_fkey"
            columns: ["table_id"]
            isOneToOne: false
            referencedRelation: "table_inventory"
            referencedColumns: ["id"]
          },
        ]
      }
      table_holds: {
        Row: {
          booking_id: string | null
          created_at: string
          created_by: string | null
          end_at: string
          expires_at: string
          id: string
          last_touched_at: string
          metadata: Json | null
          restaurant_id: string
          session_id: string | null
          start_at: string
          status: Database["public"]["Enums"]["table_hold_status"]
          updated_at: string
          zone_id: string
        }
        Insert: {
          booking_id?: string | null
          created_at?: string
          created_by?: string | null
          end_at: string
          expires_at: string
          id?: string
          last_touched_at?: string
          metadata?: Json | null
          restaurant_id: string
          session_id?: string | null
          start_at: string
          status?: Database["public"]["Enums"]["table_hold_status"]
          updated_at?: string
          zone_id: string
        }
        Update: {
          booking_id?: string | null
          created_at?: string
          created_by?: string | null
          end_at?: string
          expires_at?: string
          id?: string
          last_touched_at?: string
          metadata?: Json | null
          restaurant_id?: string
          session_id?: string | null
          start_at?: string
          status?: Database["public"]["Enums"]["table_hold_status"]
          updated_at?: string
          zone_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "table_holds_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "table_holds_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "table_holds_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "manual_assignment_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "table_holds_zone_id_fkey"
            columns: ["zone_id"]
            isOneToOne: false
            referencedRelation: "zones"
            referencedColumns: ["id"]
          },
        ]
      }
      table_inventory: {
        Row: {
          active: boolean
          capacity: number
          category: Database["public"]["Enums"]["table_category"]
          created_at: string
          id: string
          max_party_size: number | null
          min_party_size: number
          mobility: Database["public"]["Enums"]["table_mobility"]
          notes: string | null
          position: Json | null
          restaurant_id: string
          seating_type: Database["public"]["Enums"]["table_seating_type"]
          section: string | null
          status: Database["public"]["Enums"]["table_status"]
          table_number: string
          updated_at: string
          zone_id: string
        }
        Insert: {
          active?: boolean
          capacity: number
          category: Database["public"]["Enums"]["table_category"]
          created_at?: string
          id?: string
          max_party_size?: number | null
          min_party_size?: number
          mobility?: Database["public"]["Enums"]["table_mobility"]
          notes?: string | null
          position?: Json | null
          restaurant_id: string
          seating_type?: Database["public"]["Enums"]["table_seating_type"]
          section?: string | null
          status?: Database["public"]["Enums"]["table_status"]
          table_number: string
          updated_at?: string
          zone_id: string
        }
        Update: {
          active?: boolean
          capacity?: number
          category?: Database["public"]["Enums"]["table_category"]
          created_at?: string
          id?: string
          max_party_size?: number | null
          min_party_size?: number
          mobility?: Database["public"]["Enums"]["table_mobility"]
          notes?: string | null
          position?: Json | null
          restaurant_id?: string
          seating_type?: Database["public"]["Enums"]["table_seating_type"]
          section?: string | null
          status?: Database["public"]["Enums"]["table_status"]
          table_number?: string
          updated_at?: string
          zone_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "table_inventory_allowed_capacity_fkey"
            columns: ["restaurant_id", "capacity"]
            isOneToOne: false
            referencedRelation: "allowed_capacities"
            referencedColumns: ["restaurant_id", "capacity"]
          },
          {
            foreignKeyName: "table_inventory_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "table_inventory_zone_id_fkey"
            columns: ["zone_id"]
            isOneToOne: false
            referencedRelation: "zones"
            referencedColumns: ["id"]
          },
        ]
      }
      table_merge_graph: {
        Row: {
          created_at: string
          merge_score: number | null
          notes: string | null
          restaurant_id: string
          status: string
          table_a: string
          table_b: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string
          merge_score?: number | null
          notes?: string | null
          restaurant_id: string
          status?: string
          table_a: string
          table_b: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string
          merge_score?: number | null
          notes?: string | null
          restaurant_id?: string
          status?: string
          table_a?: string
          table_b?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      table_scarcity_metrics: {
        Row: {
          computed_at: string
          id: string
          restaurant_id: string
          scarcity_score: number
          table_type: string
        }
        Insert: {
          computed_at?: string
          id?: string
          restaurant_id: string
          scarcity_score: number
          table_type: string
        }
        Update: {
          computed_at?: string
          id?: string
          restaurant_id?: string
          scarcity_score?: number
          table_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "table_scarcity_metrics_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      table_soft_holds: {
        Row: {
          booking_id: string | null
          created_at: string
          expires_at: string
          hold_window: unknown
          id: string
          restaurant_id: string
          session_token: string
          table_id: string
        }
        Insert: {
          booking_id?: string | null
          created_at?: string
          expires_at: string
          hold_window: unknown
          id?: string
          restaurant_id: string
          session_token: string
          table_id: string
        }
        Update: {
          booking_id?: string | null
          created_at?: string
          expires_at?: string
          hold_window?: unknown
          id?: string
          restaurant_id?: string
          session_token?: string
          table_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "table_soft_holds_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "table_soft_holds_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "table_soft_holds_table_id_fkey"
            columns: ["table_id"]
            isOneToOne: false
            referencedRelation: "table_inventory"
            referencedColumns: ["id"]
          },
        ]
      }
      user_profiles: {
        Row: {
          created_at: string
          id: string
          is_email_suppressed: boolean
          marketing_opt_in: boolean
          name: string | null
          phone: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          id: string
          is_email_suppressed?: boolean
          marketing_opt_in?: boolean
          name?: string | null
          phone?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_email_suppressed?: boolean
          marketing_opt_in?: boolean
          name?: string | null
          phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      waiting_list: {
        Row: {
          booking_date: string
          created_at: string
          customer_email: string
          customer_name: string
          customer_phone: string | null
          desired_time: string
          id: string
          notes: string | null
          party_size: number
          restaurant_id: string
          seating_preference: Database["public"]["Enums"]["seating_preference_type"]
          updated_at: string
        }
        Insert: {
          booking_date: string
          created_at?: string
          customer_email: string
          customer_name: string
          customer_phone?: string | null
          desired_time: string
          id?: string
          notes?: string | null
          party_size: number
          restaurant_id: string
          seating_preference?: Database["public"]["Enums"]["seating_preference_type"]
          updated_at?: string
        }
        Update: {
          booking_date?: string
          created_at?: string
          customer_email?: string
          customer_name?: string
          customer_phone?: string | null
          desired_time?: string
          id?: string
          notes?: string | null
          party_size?: number
          restaurant_id?: string
          seating_preference?: Database["public"]["Enums"]["seating_preference_type"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "waiting_list_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      zones: {
        Row: {
          active: boolean
          created_at: string
          id: string
          name: string
          restaurant_id: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          id?: string
          name: string
          restaurant_id: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          id?: string
          name?: string
          restaurant_id?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "zones_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      acquire_soft_holds_atomic: {
        Args: {
          p_booking_id?: string
          p_restaurant_id: string
          p_session_token: string
          p_table_ids: string[]
          p_ttl_seconds?: number
          p_window: unknown
        }
        Returns: {
          acquired: boolean
          blocking_expires_at: string
          blocking_session: string
          table_id: string
        }[]
      }
      allocations_overlap: {
        Args: { a: unknown; b: unknown }
        Returns: boolean
      }
      apply_booking_state_transition: {
        Args: {
          p_booking_id: string
          p_checked_in_at: string | null
          p_checked_out_at: string | null
          p_history_changed_at: string
          p_history_changed_by: string | null
          p_history_from: Database["public"]["Enums"]["booking_status"]
          p_history_metadata?: Json
          p_history_reason: string
          p_history_to: Database["public"]["Enums"]["booking_status"]
          p_status: Database["public"]["Enums"]["booking_status"]
          p_updated_at: string
        }
        Returns: {
          checked_in_at: string | null
          checked_out_at: string | null
          status: Database["public"]["Enums"]["booking_status"]
          updated_at: string | null
        }[]
      }
      are_tables_connected: { Args: { table_ids: string[] }; Returns: boolean }
      assign_merged_tables: {
        Args: {
          p_assigned_by?: string
          p_booking_id: string
          p_idempotency_key?: string
          p_require_adjacency?: boolean
          p_table_ids: string[]
        }
        Returns: undefined
      }
      assign_single_table: {
        Args: {
          p_assigned_by?: string
          p_booking_id: string
          p_idempotency_key?: string
          p_table_id: string
        }
        Returns: undefined
      }
      assign_tables_atomic: {
        Args: {
          p_assigned_by?: string
          p_booking_id: string
          p_idempotency_key?: string
          p_table_ids: string[]
          p_window: unknown
        }
        Returns: {
          assignment_id: string
          table_id: string
        }[]
      }
      claim_due_email_dispatch_intents: {
        Args: { p_email_types?: string[] | null; p_max_count?: number | null }
        Returns: {
          attempts_made: number
          backoff_delay_ms: number
          backoff_type: string
          booking_id: string
          cancelled_at: string | null
          claimed_at: string | null
          created_at: string
          dedupe_key: string
          email_type: string
          id: string
          last_attempt_at: string | null
          last_error: string | null
          max_attempts: number
          payload: Json
          processed_at: string | null
          restaurant_id: string | null
          scheduled_for: string
          status: string
          updated_at: string
        }[]
      }
      assign_tables_atomic_v2:
        | {
            Args: {
              p_assigned_by?: string
              p_booking_id: string
              p_idempotency_key?: string
              p_require_adjacency?: boolean
              p_table_ids: string[]
            }
            Returns: {
              end_at: string
              merge_group_id: string
              start_at: string
              table_id: string
            }[]
          }
        | {
            Args: {
              p_assigned_by?: string
              p_booking_id: string
              p_end_at?: string
              p_idempotency_key?: string
              p_require_adjacency?: boolean
              p_start_at?: string
              p_table_ids: string[]
            }
            Returns: {
              end_at: string
              merge_group_id: string
              start_at: string
              table_id: string
            }[]
          }
      booking_status_summary: {
        Args: {
          p_end_date?: string
          p_restaurant_id: string
          p_start_date?: string
          p_status_filter?: Database["public"]["Enums"]["booking_status"][]
        }
        Returns: {
          status: Database["public"]["Enums"]["booking_status"]
          total: number
        }[]
      }
      check_soft_hold_ownership: {
        Args: {
          p_session_token: string
          p_table_ids: string[]
          p_window: unknown
        }
        Returns: {
          expires_at: string
          owned: boolean
          table_id: string
        }[]
      }
      cleanup_expired_soft_holds: {
        Args: { p_batch_size?: number }
        Returns: number
      }
      confirm_hold_assignment_tx: {
        Args: {
          p_assigned_by?: string
          p_booking_id: string
          p_expected_adjacency_hash?: string
          p_expected_policy_version?: string
          p_history_changed_by?: string
          p_history_metadata?: Json
          p_history_reason?: string
          p_hold_id: string
          p_idempotency_key: string
          p_require_adjacency?: boolean
          p_target_status?: Database["public"]["Enums"]["booking_status"]
          p_window_end?: string
          p_window_start?: string
        }
        Returns: {
          assignment_id: string
          end_at: string
          merge_group_id: string
          start_at: string
          table_id: string
        }[]
      }
      confirm_hold_assignment_with_transition: {
        Args: {
          p_assigned_by?: string
          p_booking_id: string
          p_end_at?: string
          p_history_changed_by?: string
          p_history_metadata?: Json
          p_history_reason?: string
          p_idempotency_key: string
          p_require_adjacency?: boolean
          p_start_at?: string
          p_table_ids: string[]
          p_target_status?: Database["public"]["Enums"]["booking_status"]
        }
        Returns: {
          end_at: string
          merge_group_id: string
          start_at: string
          table_id: string
        }[]
      }
      create_booking_with_capacity_check: {
        Args: {
          p_auth_user_id?: string
          p_booking_date: string
          p_booking_type: string
          p_client_request_id?: string
          p_customer_email: string
          p_customer_id: string
          p_customer_name: string
          p_customer_phone: string
          p_details?: Json
          p_end_time: string
          p_idempotency_key?: string
          p_loyalty_points_awarded?: number
          p_marketing_opt_in?: boolean
          p_notes?: string
          p_party_size: number
          p_restaurant_id: string
          p_seating_preference: string
          p_source?: string
          p_start_time: string
        }
        Returns: Json
      }
      current_restaurant_id: { Args: never; Returns: string }
      generate_booking_reference: { Args: never; Returns: string }
      get_or_create_booking_slot: {
        Args: {
          p_default_capacity?: number
          p_restaurant_id: string
          p_slot_date: string
          p_slot_time: string
        }
        Returns: string
      }
      is_holds_strict_conflicts_enabled: { Args: never; Returns: boolean }
      is_table_available_v2: {
        Args: {
          p_end_at: string
          p_exclude_booking_id?: string
          p_start_at: string
          p_table_id: string
        }
        Returns: boolean
      }
      ops_email_delivery_attempts_feed: {
        Args: {
          p_booking_ref?: string
          p_email_type?: string
          p_message_id?: string
          p_page: number
          p_page_size: number
          p_range: string
          p_recipient_email?: string
          p_restaurant_id: string
          p_statuses?: string[]
          p_template_type?: string
        }
        Returns: {
          booking: Json
          bookingId: string
          currentOccurredAt: string
          currentStatus: string
          emailType: string
          events: Json
          messageId: string
          provider: string
          recipientEmail: string
          templateType: string
        }[]
      }
      ops_email_delivery_attempts_summary: {
        Args: {
          p_booking_ref?: string
          p_email_type?: string
          p_message_id?: string
          p_range: string
          p_recipient_email?: string
          p_restaurant_id: string
          p_statuses?: string[]
          p_template_type?: string
        }
        Returns: {
          bounced: number
          complained: number
          delivered: number
          deliveredRate: number
          deliveryDelayed: number
          failed: number
          failureRate: number
          p50DeliverySeconds: number
          p95DeliverySeconds: number
          sent: number
          topFailedEmailTypes: Json
          topFailedTemplates: Json
          total: number
          uniqueBookings: number
          uniqueRecipients: number
        }[]
      }
      ops_customers_history_base: {
        Args: {
          p_last_visit?: string
          p_marketing_opt_in?: string
          p_min_bookings?: number
          p_restaurant_id: string
          p_search?: string
        }
        Returns: {
          created_at: string
          email: string
          first_booking_at: string | null
          id: string
          last_visit_at: string | null
          marketing_opt_in: boolean
          name: string
          phone: string
          restaurant_id: string
          total_bookings: number
          total_cancellations: number
          total_covers: number
          updated_at: string
        }[]
      }
      ops_customers_history_feed: {
        Args: {
          p_last_visit?: string
          p_marketing_opt_in?: string
          p_min_bookings?: number
          p_page?: number
          p_page_size?: number
          p_restaurant_id: string
          p_search?: string
          p_sort_by?: string
          p_sort_order?: string
        }
        Returns: {
          created_at: string
          email: string
          first_booking_at: string | null
          id: string
          last_visit_at: string | null
          marketing_opt_in: boolean
          name: string
          phone: string
          restaurant_id: string
          total_count: number
          total_bookings: number
          total_cancellations: number
          total_covers: number
          updated_at: string
        }[]
      }
      ops_customers_history_summary: {
        Args: {
          p_last_visit?: string
          p_marketing_opt_in?: string
          p_min_bookings?: number
          p_restaurant_id: string
          p_search?: string
        }
        Returns: {
          never_visited: number
          opted_in: number
          opted_out: number
          returning: number
          total: number
          vip: number
        }[]
      }
      process_late_arrivals: { Args: never; Returns: undefined }
      prune_allocations_history: {
        Args: { p_cutoff: string; p_limit?: number }
        Returns: {
          archived_count: number
          deleted_count: number
        }[]
      }
      refresh_table_status: { Args: { p_table_id: string }; Returns: undefined }
      release_hold_and_emit: {
        Args: { p_actor_id?: string; p_hold_id: string }
        Returns: boolean
      }
      release_soft_holds: {
        Args: { p_session_token: string; p_table_ids?: string[] }
        Returns: number
      }
      require_restaurant_context: { Args: never; Returns: string }
      set_hold_conflict_enforcement: {
        Args: { enabled: boolean }
        Returns: boolean
      }
      set_restaurant_context: {
        Args: { p_restaurant_id: string }
        Returns: string
      }
      sync_confirmed_assignment_windows: {
        Args: {
          p_actor_id?: string
          p_booking_id: string
          p_hold_id?: string
          p_idempotency_key?: string
          p_merge_group_id?: string
          p_payload_checksum?: string
          p_table_ids: string[]
          p_window_end: string
          p_window_start: string
        }
        Returns: {
          allocation_id: string | null
          assigned_at: string
          assigned_by: string | null
          assignment_window: unknown
          booking_id: string
          created_at: string
          end_at: string | null
          id: string
          idempotency_key: string | null
          merge_group_id: string | null
          notes: string | null
          slot_id: string | null
          start_at: string | null
          table_id: string
          updated_at: string
        }[]
        SetofOptions: {
          from: "*"
          to: "booking_table_assignments"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      unassign_table_from_booking: {
        Args: { p_booking_id: string; p_table_id: string }
        Returns: boolean
      }
      unassign_tables_atomic: {
        Args: { p_booking_id: string; p_table_ids?: string[] }
        Returns: {
          table_id: string
        }[]
      }
      update_booking_with_capacity_check: {
        Args: {
          p_auth_user_id?: string
          p_booking_date: string
          p_booking_id: string
          p_booking_type: string
          p_client_request_id?: string
          p_customer_email: string
          p_customer_id: string
          p_customer_name: string
          p_customer_phone: string
          p_details?: Json
          p_end_time: string
          p_loyalty_points_awarded?: number
          p_marketing_opt_in?: boolean
          p_notes?: string
          p_party_size: number
          p_restaurant_id: string
          p_seating_preference: string
          p_source?: string
          p_start_time: string
        }
        Returns: Json
      }
      user_restaurants: { Args: never; Returns: string[] }
      user_restaurants_admin: { Args: never; Returns: string[] }
      validate_booking_capacity_after_assignment: {
        Args: { p_booking_id: string }
        Returns: undefined
      }
    }
    Enums: {
      analytics_event_type:
        | "booking.created"
        | "booking.cancelled"
        | "booking.allocated"
        | "booking.waitlisted"
      booking_change_type: "created" | "updated" | "cancelled" | "deleted"
      booking_status:
        | "confirmed"
        | "pending"
        | "cancelled"
        | "completed"
        | "PRIORITY_WAITLIST"
        | "no_show"
        | "pending_allocation"
        | "checked_in"
      capacity_override_type: "holiday" | "event" | "manual" | "emergency"
      manual_assignment_session_state:
        | "none"
        | "proposed"
        | "held"
        | "confirmed"
        | "expired"
        | "conflicted"
        | "cancelled"
      seating_preference_type:
        | "any"
        | "indoor"
        | "outdoor"
        | "bar"
        | "window"
        | "quiet"
        | "booth"
      table_category: "bar" | "dining" | "lounge" | "patio" | "private"
      table_hold_status: "active" | "expired" | "confirmed" | "cancelled"
      table_mobility: "movable" | "fixed"
      table_seating_type: "standard" | "sofa" | "booth" | "high_top"
      table_status: "available" | "reserved" | "occupied" | "out_of_service"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  auth: {
    Enums: {
      aal_level: ["aal1", "aal2", "aal3"],
      code_challenge_method: ["s256", "plain"],
      factor_status: ["unverified", "verified"],
      factor_type: ["totp", "webauthn", "phone"],
      oauth_authorization_status: ["pending", "approved", "denied", "expired"],
      oauth_client_type: ["public", "confidential"],
      oauth_registration_type: ["dynamic", "manual"],
      oauth_response_type: ["code"],
      one_time_token_type: [
        "confirmation_token",
        "reauthentication_token",
        "recovery_token",
        "email_change_token_new",
        "email_change_token_current",
        "phone_change_token",
      ],
    },
  },
  public: {
    Enums: {
      analytics_event_type: [
        "booking.created",
        "booking.cancelled",
        "booking.allocated",
        "booking.waitlisted",
      ],
      booking_change_type: ["created", "updated", "cancelled", "deleted"],
      booking_status: [
        "confirmed",
        "pending",
        "cancelled",
        "completed",
        "PRIORITY_WAITLIST",
        "no_show",
        "pending_allocation",
        "checked_in",
      ],
      capacity_override_type: ["holiday", "event", "manual", "emergency"],
      manual_assignment_session_state: [
        "none",
        "proposed",
        "held",
        "confirmed",
        "expired",
        "conflicted",
        "cancelled",
      ],
      seating_preference_type: [
        "any",
        "indoor",
        "outdoor",
        "bar",
        "window",
        "quiet",
        "booth",
      ],
      table_category: ["bar", "dining", "lounge", "patio", "private"],
      table_hold_status: ["active", "expired", "confirmed", "cancelled"],
      table_mobility: ["movable", "fixed"],
      table_seating_type: ["standard", "sofa", "booth", "high_top"],
      table_status: ["available", "reserved", "occupied", "out_of_service"],
    },
  },
} as const
