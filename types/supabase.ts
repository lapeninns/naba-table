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
    PostgrestVersion: "13.0.4"
  }
  public: {
    Tables: {
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
          booking_date: string
          booking_type: Database["public"]["Enums"]["booking_type"]
          client_request_id: string
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
          booking_date: string
          booking_type?: Database["public"]["Enums"]["booking_type"]
          client_request_id?: string
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
          booking_date?: string
          booking_type?: Database["public"]["Enums"]["booking_type"]
          client_request_id?: string
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
        }
        Relationships: [
          {
            foreignKeyName: "customers_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      loyalty_point_events: {
        Row: {
          booking_id: string | null
          created_at: string
          customer_id: string
          event_type: string
          id: string
          metadata: Json | null
          points_change: number
          restaurant_id: string
          schema_version: number
        }
        Insert: {
          booking_id?: string | null
          created_at?: string
          customer_id: string
          event_type: string
          id?: string
          metadata?: Json | null
          points_change: number
          restaurant_id: string
          schema_version?: number
        }
        Update: {
          booking_id?: string | null
          created_at?: string
          customer_id?: string
          event_type?: string
          id?: string
          metadata?: Json | null
          points_change?: number
          restaurant_id?: string
          schema_version?: number
        }
        Relationships: [
          {
            foreignKeyName: "loyalty_point_events_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "loyalty_point_events_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "loyalty_point_events_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      loyalty_points: {
        Row: {
          created_at: string
          customer_id: string
          id: string
          restaurant_id: string
          tier: Database["public"]["Enums"]["loyalty_tier"]
          total_points: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          customer_id: string
          id?: string
          restaurant_id: string
          tier?: Database["public"]["Enums"]["loyalty_tier"]
          total_points?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          customer_id?: string
          id?: string
          restaurant_id?: string
          tier?: Database["public"]["Enums"]["loyalty_tier"]
          total_points?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "loyalty_points_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "loyalty_points_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      loyalty_programs: {
        Row: {
          accrual_rule: Json
          created_at: string
          id: string
          is_active: boolean
          name: string
          pilot_only: boolean
          restaurant_id: string
          tier_definitions: Json
          updated_at: string
        }
        Insert: {
          accrual_rule?: Json
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          pilot_only?: boolean
          restaurant_id: string
          tier_definitions?: Json
          updated_at?: string
        }
        Update: {
          accrual_rule?: Json
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          pilot_only?: boolean
          restaurant_id?: string
          tier_definitions?: Json
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "loyalty_programs_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: true
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
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
          id: string
          image: string | null
          name: string | null
          phone: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          id: string
          image?: string | null
          name?: string | null
          phone?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string | null
          id?: string
          image?: string | null
          name?: string | null
          phone?: string | null
          updated_at?: string
        }
        Relationships: []
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
          role: string
          revoked_at: string | null
          status: string
          token_hash: string
          updated_at: string
        }
        Insert: {
          accepted_at?: string | null
          created_at?: string
          email: string
          email_normalized?: never
          expires_at: string
          id?: string
          invited_by?: string | null
          restaurant_id: string
          role: string
          revoked_at?: string | null
          status?: string
          token_hash: string
          updated_at?: string
        }
        Update: {
          accepted_at?: string | null
          created_at?: string
          email?: string
          email_normalized?: never
          expires_at?: string
          id?: string
          invited_by?: string | null
          restaurant_id?: string
          role?: string
          revoked_at?: string | null
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
            foreignKeyName: "restaurant_service_periods_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      restaurant_capacity_rules: {
        Row: {
          created_at: string
          day_of_week: number | null
          effective_date: string | null
          id: string
          max_covers: number | null
          max_parties: number | null
          notes: string | null
          restaurant_id: string
          service_period_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          day_of_week?: number | null
          effective_date?: string | null
          id?: string
          max_covers?: number | null
          max_parties?: number | null
          notes?: string | null
          restaurant_id: string
          service_period_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          day_of_week?: number | null
          effective_date?: string | null
          id?: string
          max_covers?: number | null
          max_parties?: number | null
          notes?: string | null
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
      restaurants: {
        Row: {
          address: string | null
          booking_policy: string | null
          capacity: number | null
          contact_email: string | null
          contact_phone: string | null
          created_at: string
          id: string
          name: string
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
          id?: string
          name: string
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
          id?: string
          name?: string
          slug?: string
          timezone?: string
          updated_at?: string
        }
        Relationships: []
      }
      stripe_events: {
        Row: {
          created_at: string
          event_id: string
          event_type: string
          id: string
          payload: Json
          processed: boolean
        }
        Insert: {
          created_at?: string
          event_id: string
          event_type: string
          id?: string
          payload: Json
          processed?: boolean
        }
        Update: {
          created_at?: string
          event_id?: string
          event_type?: string
          id?: string
          payload?: Json
          processed?: boolean
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      gbt_bit_compress: {
        Args: { "": unknown }
        Returns: unknown
      }
      gbt_bool_compress: {
        Args: { "": unknown }
        Returns: unknown
      }
      gbt_bool_fetch: {
        Args: { "": unknown }
        Returns: unknown
      }
      gbt_bpchar_compress: {
        Args: { "": unknown }
        Returns: unknown
      }
      gbt_bytea_compress: {
        Args: { "": unknown }
        Returns: unknown
      }
      gbt_cash_compress: {
        Args: { "": unknown }
        Returns: unknown
      }
      gbt_cash_fetch: {
        Args: { "": unknown }
        Returns: unknown
      }
      gbt_date_compress: {
        Args: { "": unknown }
        Returns: unknown
      }
      gbt_date_fetch: {
        Args: { "": unknown }
        Returns: unknown
      }
      gbt_decompress: {
        Args: { "": unknown }
        Returns: unknown
      }
      gbt_enum_compress: {
        Args: { "": unknown }
        Returns: unknown
      }
      gbt_enum_fetch: {
        Args: { "": unknown }
        Returns: unknown
      }
      gbt_float4_compress: {
        Args: { "": unknown }
        Returns: unknown
      }
      gbt_float4_fetch: {
        Args: { "": unknown }
        Returns: unknown
      }
      gbt_float8_compress: {
        Args: { "": unknown }
        Returns: unknown
      }
      gbt_float8_fetch: {
        Args: { "": unknown }
        Returns: unknown
      }
      gbt_inet_compress: {
        Args: { "": unknown }
        Returns: unknown
      }
      gbt_int2_compress: {
        Args: { "": unknown }
        Returns: unknown
      }
      gbt_int2_fetch: {
        Args: { "": unknown }
        Returns: unknown
      }
      gbt_int4_compress: {
        Args: { "": unknown }
        Returns: unknown
      }
      gbt_int4_fetch: {
        Args: { "": unknown }
        Returns: unknown
      }
      gbt_int8_compress: {
        Args: { "": unknown }
        Returns: unknown
      }
      gbt_int8_fetch: {
        Args: { "": unknown }
        Returns: unknown
      }
      gbt_intv_compress: {
        Args: { "": unknown }
        Returns: unknown
      }
      gbt_intv_decompress: {
        Args: { "": unknown }
        Returns: unknown
      }
      gbt_intv_fetch: {
        Args: { "": unknown }
        Returns: unknown
      }
      gbt_macad_compress: {
        Args: { "": unknown }
        Returns: unknown
      }
      gbt_macad_fetch: {
        Args: { "": unknown }
        Returns: unknown
      }
      gbt_macad8_compress: {
        Args: { "": unknown }
        Returns: unknown
      }
      gbt_macad8_fetch: {
        Args: { "": unknown }
        Returns: unknown
      }
      gbt_numeric_compress: {
        Args: { "": unknown }
        Returns: unknown
      }
      gbt_oid_compress: {
        Args: { "": unknown }
        Returns: unknown
      }
      gbt_oid_fetch: {
        Args: { "": unknown }
        Returns: unknown
      }
      gbt_text_compress: {
        Args: { "": unknown }
        Returns: unknown
      }
      gbt_time_compress: {
        Args: { "": unknown }
        Returns: unknown
      }
      gbt_time_fetch: {
        Args: { "": unknown }
        Returns: unknown
      }
      gbt_timetz_compress: {
        Args: { "": unknown }
        Returns: unknown
      }
      gbt_ts_compress: {
        Args: { "": unknown }
        Returns: unknown
      }
      gbt_ts_fetch: {
        Args: { "": unknown }
        Returns: unknown
      }
      gbt_tstz_compress: {
        Args: { "": unknown }
        Returns: unknown
      }
      gbt_uuid_compress: {
        Args: { "": unknown }
        Returns: unknown
      }
      gbt_uuid_fetch: {
        Args: { "": unknown }
        Returns: unknown
      }
      gbt_var_decompress: {
        Args: { "": unknown }
        Returns: unknown
      }
      gbt_var_fetch: {
        Args: { "": unknown }
        Returns: unknown
      }
      gbtreekey_var_in: {
        Args: { "": unknown }
        Returns: unknown
      }
      gbtreekey_var_out: {
        Args: { "": unknown }
        Returns: unknown
      }
      gbtreekey16_in: {
        Args: { "": unknown }
        Returns: unknown
      }
      gbtreekey16_out: {
        Args: { "": unknown }
        Returns: unknown
      }
      gbtreekey2_in: {
        Args: { "": unknown }
        Returns: unknown
      }
      gbtreekey2_out: {
        Args: { "": unknown }
        Returns: unknown
      }
      gbtreekey32_in: {
        Args: { "": unknown }
        Returns: unknown
      }
      gbtreekey32_out: {
        Args: { "": unknown }
        Returns: unknown
      }
      gbtreekey4_in: {
        Args: { "": unknown }
        Returns: unknown
      }
      gbtreekey4_out: {
        Args: { "": unknown }
        Returns: unknown
      }
      gbtreekey8_in: {
        Args: { "": unknown }
        Returns: unknown
      }
      gbtreekey8_out: {
        Args: { "": unknown }
        Returns: unknown
      }
      generate_booking_reference: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      user_restaurants: {
        Args: Record<PropertyKey, never>
        Returns: string[]
      }
    }
    Enums: {
      analytics_event_type:
        | "booking.created"
        | "booking.cancelled"
        | "booking.allocated"
      booking_change_type: "created" | "updated" | "cancelled" | "deleted"
      booking_status:
        | "confirmed"
        | "pending"
        | "cancelled"
        | "completed"
        | "no_show"
        | "pending_allocation"
      booking_type: "breakfast" | "lunch" | "dinner" | "drinks"
      loyalty_tier: "bronze" | "silver" | "gold" | "platinum"
      seating_preference_type:
        | "any"
        | "indoor"
        | "outdoor"
        | "bar"
        | "window"
        | "quiet"
        | "booth"
      seating_type: "indoor" | "outdoor" | "bar" | "patio" | "private_room"
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
  public: {
    Enums: {
      analytics_event_type: [
        "booking.created",
        "booking.cancelled",
        "booking.allocated",
      ],
      booking_change_type: ["created", "updated", "cancelled", "deleted"],
      booking_status: [
        "confirmed",
        "pending",
        "cancelled",
        "completed",
        "no_show",
        "pending_allocation",
      ],
      booking_type: ["breakfast", "lunch", "dinner", "drinks"],
      loyalty_tier: ["bronze", "silver", "gold", "platinum"],
      seating_preference_type: [
        "any",
        "indoor",
        "outdoor",
        "bar",
        "window",
        "quiet",
        "booth",
      ],
      seating_type: ["indoor", "outdoor", "bar", "patio", "private_room"],
    },
  },
} as const
