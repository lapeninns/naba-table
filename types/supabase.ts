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
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
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
      booking_assignment_idempotency: {
        Row: {
          assignment_window: unknown
          booking_id: string
          created_at: string
          idempotency_key: string
          merge_group_allocation_id: string | null
          table_ids: string[]
        }
        Insert: {
          assignment_window: unknown
          booking_id: string
          created_at?: string
          idempotency_key: string
          merge_group_allocation_id?: string | null
          table_ids: string[]
        }
        Update: {
          assignment_window?: unknown
          booking_id?: string
          created_at?: string
          idempotency_key?: string
          merge_group_allocation_id?: string | null
          table_ids?: string[]
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
      booking_occasions: {
        Row: {
          availability: Json
          created_at: string
          default_duration_minutes: number
          description: string | null
          display_order: number
          is_active: boolean
          key: string
          label: string
          short_label: string
          updated_at: string
        }
        Insert: {
          availability?: Json
          created_at?: string
          default_duration_minutes?: number
          description?: string | null
          display_order?: number
          is_active?: boolean
          key: string
          label: string
          short_label: string
          updated_at?: string
        }
        Update: {
          availability?: Json
          created_at?: string
          default_duration_minutes?: number
          description?: string | null
          display_order?: number
          is_active?: boolean
          key?: string
          label?: string
          short_label?: string
          updated_at?: string
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
          assigned_at: string
          assigned_by: string | null
          booking_id: string
          created_at: string
          id: string
          idempotency_key: string | null
          notes: string | null
          slot_id: string | null
          table_id: string
          updated_at: string
        }
        Insert: {
          assigned_at?: string
          assigned_by?: string | null
          booking_id: string
          created_at?: string
          id?: string
          idempotency_key?: string | null
          notes?: string | null
          slot_id?: string | null
          table_id: string
          updated_at?: string
        }
        Update: {
          assigned_at?: string
          assigned_by?: string | null
          booking_id?: string
          created_at?: string
          id?: string
          idempotency_key?: string | null
          notes?: string | null
          slot_id?: string | null
          table_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "booking_table_assignments_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
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
          auth_user_id: string | null
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
          auth_user_id?: string | null
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
          auth_user_id?: string | null
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
      restaurants: {
        Row: {
          address: string | null
          booking_policy: string | null
          capacity: number | null
          contact_email: string | null
          contact_phone: string | null
          created_at: string
          id: string
          is_active: boolean
          name: string
          reservation_default_duration_minutes: number
          reservation_interval_minutes: number
          reservation_last_seating_buffer_minutes: number
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
          is_active?: boolean
          name: string
          reservation_default_duration_minutes?: number
          reservation_interval_minutes?: number
          reservation_last_seating_buffer_minutes?: number
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
          is_active?: boolean
          name?: string
          reservation_default_duration_minutes?: number
          reservation_interval_minutes?: number
          reservation_last_seating_buffer_minutes?: number
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
      table_holds: {
        Row: {
          booking_id: string | null
          created_at: string
          created_by: string | null
          end_at: string
          expires_at: string
          id: string
          metadata: Json | null
          restaurant_id: string
          start_at: string
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
          metadata?: Json | null
          restaurant_id: string
          start_at: string
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
          metadata?: Json | null
          restaurant_id?: string
          start_at?: string
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
      zones: {
        Row: {
          created_at: string
          id: string
          name: string
          restaurant_id: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          restaurant_id: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
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
      allocations_overlap: {
        Args: { a: unknown; b: unknown }
        Returns: boolean
      }
      apply_booking_state_transition: {
        Args: {
          p_booking_id: string
          p_checked_in_at: string
          p_checked_out_at: string
          p_history_changed_at: string
          p_history_changed_by: string
          p_history_from: Database["public"]["Enums"]["booking_status"]
          p_history_metadata?: Json
          p_history_reason: string
          p_history_to: Database["public"]["Enums"]["booking_status"]
          p_status: Database["public"]["Enums"]["booking_status"]
          p_updated_at: string
        }
        Returns: {
          checked_in_at: string
          checked_out_at: string
          status: Database["public"]["Enums"]["booking_status"]
          updated_at: string
        }[]
      }
      are_tables_connected: { Args: { table_ids: string[] }; Returns: boolean }
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
      assign_tables_atomic_v2: {
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
      refresh_table_status: { Args: { p_table_id: string }; Returns: undefined }
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
        | "no_show"
        | "pending_allocation"
        | "checked_in"
      loyalty_tier: "bronze" | "silver" | "gold" | "platinum"
      seating_preference_type:
        | "any"
        | "indoor"
        | "outdoor"
        | "bar"
        | "window"
        | "quiet"
        | "booth"
      table_category: "bar" | "dining" | "lounge" | "patio" | "private"
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
  graphql_public: {
    Enums: {},
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
        "no_show",
        "pending_allocation",
        "checked_in",
      ],
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
      table_category: ["bar", "dining", "lounge", "patio", "private"],
      table_mobility: ["movable", "fixed"],
      table_seating_type: ["standard", "sofa", "booth", "high_top"],
      table_status: ["available", "reserved", "occupied", "out_of_service"],
    },
  },
} as const
