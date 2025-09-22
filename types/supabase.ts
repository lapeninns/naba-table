export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  public: {
    Tables: {
      availability_rules: {
        Row: {
          booking_type: Database["public"]["Enums"]["booking_type"];
          created_at: string;
          day_of_week: number;
          id: string;
          is_closed: boolean;
          notes: string | null;
          open_time: string;
          close_time: string;
          restaurant_id: string;
        };
        Insert: {
          booking_type?: Database["public"]["Enums"]["booking_type"];
          created_at?: string;
          day_of_week: number;
          id?: string;
          is_closed?: boolean;
          notes?: string | null;
          open_time: string;
          close_time: string;
          restaurant_id: string;
        };
        Update: {
          booking_type?: Database["public"]["Enums"]["booking_type"];
          created_at?: string;
          day_of_week?: number;
          id?: string;
          is_closed?: boolean;
          notes?: string | null;
          open_time?: string;
          close_time?: string;
          restaurant_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "availability_rules_restaurant_id_fkey";
            columns: ["restaurant_id"];
            referencedRelation: "restaurants";
            referencedColumns: ["id"];
          }
        ];
      };
      audit_logs: {
        Row: {
          action: string;
          actor: string | null;
          created_at: string;
          entity: string;
          entity_id: string | null;
          id: number;
          metadata: Json | null;
        };
        Insert: {
          action: string;
          actor?: string | null;
          created_at?: string;
          entity: string;
          entity_id?: string | null;
          id?: number;
          metadata?: Json | null;
        };
        Update: {
          action?: string;
          actor?: string | null;
          created_at?: string;
          entity?: string;
          entity_id?: string | null;
          id?: number;
          metadata?: Json | null;
        };
        Relationships: [];
      };
      bookings: {
        Row: {
          booking_date: string;
          booking_type: Database["public"]["Enums"]["booking_type"];
          created_at: string;
          customer_id: string;
          customer_email: string;
          customer_name: string;
          customer_phone: string;
          end_time: string;
          id: string;
          loyalty_points_awarded: number;
          marketing_opt_in: boolean;
          notes: string | null;
          party_size: number;
          reference: string;
          restaurant_id: string;
          seating_preference: Database["public"]["Enums"]["seating_preference_type"];
          source: string;
          start_time: string;
          status: Database["public"]["Enums"]["booking_status"];
          table_id: string | null;
          updated_at: string;
        };
        Insert: {
          booking_date: string;
          booking_type?: Database["public"]["Enums"]["booking_type"];
          created_at?: string;
          customer_id: string;
          customer_email: string;
          customer_name: string;
          customer_phone: string;
          end_time: string;
          id?: string;
          loyalty_points_awarded?: number;
          marketing_opt_in?: boolean;
          notes?: string | null;
          party_size: number;
          reference?: string;
          restaurant_id: string;
          seating_preference?: Database["public"]["Enums"]["seating_preference_type"];
          source?: string;
          start_time: string;
          status?: Database["public"]["Enums"]["booking_status"];
          table_id?: string | null;
          updated_at?: string;
        };
        Update: {
          booking_date?: string;
          booking_type?: Database["public"]["Enums"]["booking_type"];
          created_at?: string;
          customer_id?: string;
          customer_email?: string;
          customer_name?: string;
          customer_phone?: string;
          end_time?: string;
          id?: string;
          loyalty_points_awarded?: number;
          marketing_opt_in?: boolean;
          notes?: string | null;
          party_size?: number;
          reference?: string;
          restaurant_id?: string;
          seating_preference?: Database["public"]["Enums"]["seating_preference_type"];
          source?: string;
          start_time?: string;
          status?: Database["public"]["Enums"]["booking_status"];
          table_id?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "bookings_restaurant_id_fkey";
            columns: ["restaurant_id"];
            referencedRelation: "restaurants";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "bookings_customer_id_fkey";
            columns: ["customer_id"];
            referencedRelation: "customers";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "bookings_table_id_fkey";
            columns: ["table_id"];
            referencedRelation: "restaurant_tables";
            referencedColumns: ["id"];
          }
        ];
      };
      customer_profiles: {
        Row: {
          customer_id: string;
          first_booking_at: string | null;
          last_booking_at: string | null;
          total_bookings: number;
          total_cancellations: number;
          total_covers: number;
          marketing_opt_in: boolean;
          last_marketing_opt_in_at: string | null;
          last_waitlist_at: string | null;
          preferences: Json;
          notes: string | null;
          updated_at: string;
        };
        Insert: {
          customer_id: string;
          first_booking_at?: string | null;
          last_booking_at?: string | null;
          total_bookings?: number;
          total_cancellations?: number;
          total_covers?: number;
          marketing_opt_in?: boolean;
          last_marketing_opt_in_at?: string | null;
          last_waitlist_at?: string | null;
          preferences?: Json;
          notes?: string | null;
          updated_at?: string;
        };
        Update: {
          customer_id?: string;
          first_booking_at?: string | null;
          last_booking_at?: string | null;
          total_bookings?: number;
          total_cancellations?: number;
          total_covers?: number;
          marketing_opt_in?: boolean;
          last_marketing_opt_in_at?: string | null;
          last_waitlist_at?: string | null;
          preferences?: Json;
          notes?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "customer_profiles_customer_id_fkey";
            columns: ["customer_id"];
            referencedRelation: "customers";
            referencedColumns: ["id"];
          }
        ];
      };
      customers: {
        Row: {
          created_at: string;
          email: string;
          email_normalized: string;
          full_name: string | null;
          id: string;
          marketing_opt_in: boolean;
          phone: string;
          phone_normalized: string;
          restaurant_id: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          email: string;
          email_normalized?: string;
          full_name?: string | null;
          id?: string;
          marketing_opt_in?: boolean;
          phone: string;
          phone_normalized?: string;
          restaurant_id: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          email?: string;
          email_normalized?: string;
          full_name?: string | null;
          id?: string;
          marketing_opt_in?: boolean;
          phone?: string;
          phone_normalized?: string;
          restaurant_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "customers_restaurant_id_fkey";
            columns: ["restaurant_id"];
            referencedRelation: "restaurants";
            referencedColumns: ["id"];
          }
        ];
      };
      loyalty_points: {
        Row: {
          balance: number;
          created_at: string;
          customer_id: string;
          id: string;
          last_awarded_at: string | null;
          lifetime_points: number;
          program_id: string;
          tier: Database["public"]["Enums"]["loyalty_tier"];
          updated_at: string;
        };
        Insert: {
          balance?: number;
          created_at?: string;
          customer_id: string;
          id?: string;
          last_awarded_at?: string | null;
          lifetime_points?: number;
          program_id: string;
          tier?: Database["public"]["Enums"]["loyalty_tier"];
          updated_at?: string;
        };
        Update: {
          balance?: number;
          created_at?: string;
          customer_id?: string;
          id?: string;
          last_awarded_at?: string | null;
          lifetime_points?: number;
          program_id?: string;
          tier?: Database["public"]["Enums"]["loyalty_tier"];
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "loyalty_points_customer_id_fkey";
            columns: ["customer_id"];
            referencedRelation: "customers";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "loyalty_points_program_id_fkey";
            columns: ["program_id"];
            referencedRelation: "loyalty_programs";
            referencedColumns: ["id"];
          }
        ];
      };
      loyalty_point_events: {
        Row: {
          balance_after: number;
          booking_id: string | null;
          created_at: string;
          customer_id: string;
          id: string;
          metadata: Json;
          occurred_at: string;
          points_delta: number;
          program_id: string;
          reason: string;
        };
        Insert: {
          balance_after: number;
          booking_id?: string | null;
          created_at?: string;
          customer_id: string;
          id?: string;
          metadata?: Json;
          occurred_at?: string;
          points_delta: number;
          program_id: string;
          reason: string;
        };
        Update: {
          balance_after?: number;
          booking_id?: string | null;
          created_at?: string;
          customer_id?: string;
          id?: string;
          metadata?: Json;
          occurred_at?: string;
          points_delta?: number;
          program_id?: string;
          reason?: string;
        };
        Relationships: [
          {
            foreignKeyName: "loyalty_point_events_booking_id_fkey";
            columns: ["booking_id"];
            referencedRelation: "bookings";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "loyalty_point_events_customer_id_fkey";
            columns: ["customer_id"];
            referencedRelation: "customers";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "loyalty_point_events_program_id_fkey";
            columns: ["program_id"];
            referencedRelation: "loyalty_programs";
            referencedColumns: ["id"];
          }
        ];
      };
      loyalty_programs: {
        Row: {
          accrual_rule: Json;
          accrual_version: number;
          created_at: string;
          description: string | null;
          id: string;
          is_active: boolean;
          name: string;
          pilot_only: boolean;
          restaurant_id: string;
          slug: string;
          tier_definitions: Json;
          updated_at: string;
        };
        Insert: {
          accrual_rule?: Json;
          accrual_version?: number;
          created_at?: string;
          description?: string | null;
          id?: string;
          is_active?: boolean;
          name: string;
          pilot_only?: boolean;
          restaurant_id: string;
          slug: string;
          tier_definitions?: Json;
          updated_at?: string;
        };
        Update: {
          accrual_rule?: Json;
          accrual_version?: number;
          created_at?: string;
          description?: string | null;
          id?: string;
          is_active?: boolean;
          name?: string;
          pilot_only?: boolean;
          restaurant_id?: string;
          slug?: string;
          tier_definitions?: Json;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "loyalty_programs_restaurant_id_fkey";
            columns: ["restaurant_id"];
            referencedRelation: "restaurants";
            referencedColumns: ["id"];
          }
        ];
      };
      observability_events: {
        Row: {
          context: Json | null;
          created_at: string;
          event_type: string;
          id: string;
          severity: string;
          source: string;
        };
        Insert: {
          context?: Json | null;
          created_at?: string;
          event_type: string;
          id?: string;
          severity?: string;
          source: string;
        };
        Update: {
          context?: Json | null;
          created_at?: string;
          event_type?: string;
          id?: string;
          severity?: string;
          source?: string;
        };
        Relationships: [];
      };
      analytics_events: {
        Row: {
          booking_id: string;
          created_at: string;
          customer_id: string | null;
          emitted_by: string;
          event_type: Database["public"]["Enums"]["analytics_event_type"];
          id: string;
          occurred_at: string;
          payload: Json;
          restaurant_id: string;
          schema_version: number;
        };
        Insert: {
          booking_id: string;
          created_at?: string;
          customer_id?: string | null;
          emitted_by?: string;
          event_type: Database["public"]["Enums"]["analytics_event_type"];
          id?: string;
          occurred_at?: string;
          payload: Json;
          restaurant_id: string;
          schema_version?: number;
        };
        Update: {
          booking_id?: string;
          created_at?: string;
          customer_id?: string | null;
          emitted_by?: string;
          event_type?: Database["public"]["Enums"]["analytics_event_type"];
          id?: string;
          occurred_at?: string;
          payload?: Json;
          restaurant_id?: string;
          schema_version?: number;
        };
        Relationships: [
          {
            foreignKeyName: "analytics_events_booking_id_fkey";
            columns: ["booking_id"];
            referencedRelation: "bookings";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "analytics_events_customer_id_fkey";
            columns: ["customer_id"];
            referencedRelation: "customers";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "analytics_events_restaurant_id_fkey";
            columns: ["restaurant_id"];
            referencedRelation: "restaurants";
            referencedColumns: ["id"];
          }
        ];
      };
      profiles: {
        Row: {
          created_at: string | null;
          customer_id: string | null;
          email: string | null;
          has_access: boolean | null;
          id: string;
          price_id: string | null;
          updated_at: string | null;
        };
        Insert: {
          created_at?: string | null;
          customer_id?: string | null;
          email?: string | null;
          has_access?: boolean | null;
          id: string;
          price_id?: string | null;
          updated_at?: string | null;
        };
        Update: {
          created_at?: string | null;
          customer_id?: string | null;
          email?: string | null;
          has_access?: boolean | null;
          id?: string;
          price_id?: string | null;
          updated_at?: string | null;
        };
        Relationships: [];
      };
      restaurant_areas: {
        Row: {
          created_at: string;
          id: string;
          name: string;
          restaurant_id: string;
          seating_type: Database["public"]["Enums"]["seating_preference_type"];
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          name: string;
          restaurant_id: string;
          seating_type: Database["public"]["Enums"]["seating_preference_type"];
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          name?: string;
          restaurant_id?: string;
          seating_type?: Database["public"]["Enums"]["seating_preference_type"];
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "restaurant_areas_restaurant_id_fkey";
            columns: ["restaurant_id"];
            referencedRelation: "restaurants";
            referencedColumns: ["id"];
          }
        ];
      };
      restaurant_tables: {
        Row: {
          area_id: string | null;
          capacity: number;
          created_at: string;
          features: string[];
          id: string;
          label: string;
          restaurant_id: string;
          seating_type: Database["public"]["Enums"]["seating_preference_type"];
          updated_at: string;
        };
        Insert: {
          area_id?: string | null;
          capacity: number;
          created_at?: string;
          features?: string[];
          id?: string;
          label: string;
          restaurant_id: string;
          seating_type: Database["public"]["Enums"]["seating_preference_type"];
          updated_at?: string;
        };
        Update: {
          area_id?: string | null;
          capacity?: number;
          created_at?: string;
          features?: string[];
          id?: string;
          label?: string;
          restaurant_id?: string;
          seating_type?: Database["public"]["Enums"]["seating_preference_type"];
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "restaurant_tables_area_id_fkey";
            columns: ["area_id"];
            referencedRelation: "restaurant_areas";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "restaurant_tables_restaurant_id_fkey";
            columns: ["restaurant_id"];
            referencedRelation: "restaurants";
            referencedColumns: ["id"];
          }
        ];
      };
      restaurants: {
        Row: {
          capacity: number | null;
          created_at: string;
          id: string;
          name: string;
          slug: string;
          timezone: string;
          updated_at: string;
        };
        Insert: {
          capacity?: number | null;
          created_at?: string;
          id?: string;
          name: string;
          slug: string;
          timezone?: string;
          updated_at?: string;
        };
        Update: {
          capacity?: number | null;
          created_at?: string;
          id?: string;
          name?: string;
          slug?: string;
          timezone?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      reviews: {
        Row: {
          booking_id: string | null;
          comment: string | null;
          created_at: string;
          id: string;
          rating: number;
          restaurant_id: string;
          title: string | null;
        };
        Insert: {
          booking_id?: string | null;
          comment?: string | null;
          created_at?: string;
          id?: string;
          rating: number;
          restaurant_id: string;
          title?: string | null;
        };
        Update: {
          booking_id?: string | null;
          comment?: string | null;
          created_at?: string;
          id?: string;
          rating?: number;
          restaurant_id?: string;
          title?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "reviews_booking_id_fkey";
            columns: ["booking_id"];
            referencedRelation: "bookings";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "reviews_restaurant_id_fkey";
            columns: ["restaurant_id"];
            referencedRelation: "restaurants";
            referencedColumns: ["id"];
          }
        ];
      };
      stripe_events: {
        Row: {
          event_id: string;
          event_type: string;
          id: string;
          payload: Json;
          processed_at: string | null;
          received_at: string;
          status: string;
        };
        Insert: {
          event_id: string;
          event_type: string;
          id?: string;
          payload: Json;
          processed_at?: string | null;
          received_at?: string;
          status?: string;
        };
        Update: {
          event_id?: string;
          event_type?: string;
          id?: string;
          payload?: Json;
          processed_at?: string | null;
          received_at?: string;
          status?: string;
        };
        Relationships: [];
      };
      waiting_list: {
        Row: {
          booking_date: string;
          created_at: string;
          customer_email: string;
          customer_name: string;
          customer_phone: string;
          desired_time: string;
          id: string;
          notes: string | null;
          party_size: number;
          restaurant_id: string;
          seating_preference: Database["public"]["Enums"]["seating_preference_type"];
          status: Database["public"]["Enums"]["waiting_status"];
        };
        Insert: {
          booking_date: string;
          created_at?: string;
          customer_email: string;
          customer_name: string;
          customer_phone: string;
          desired_time: string;
          id?: string;
          notes?: string | null;
          party_size: number;
          restaurant_id: string;
          seating_preference?: Database["public"]["Enums"]["seating_preference_type"];
          status?: Database["public"]["Enums"]["waiting_status"];
        };
        Update: {
          booking_date?: string;
          created_at?: string;
          customer_email?: string;
          customer_name?: string;
          customer_phone?: string;
          desired_time?: string;
          id?: string;
          notes?: string | null;
          party_size?: number;
          restaurant_id?: string;
          seating_preference?: Database["public"]["Enums"]["seating_preference_type"];
          status?: Database["public"]["Enums"]["waiting_status"];
        };
        Relationships: [
          {
            foreignKeyName: "waiting_list_restaurant_id_fkey";
            columns: ["restaurant_id"];
            referencedRelation: "restaurants";
            referencedColumns: ["id"];
          }
        ];
      };
      leads: {
        Row: {
          created_at: string | null;
          email: string;
          id: string;
        };
        Insert: {
          created_at?: string | null;
          email: string;
          id?: string;
        };
        Update: {
          created_at?: string | null;
          email?: string;
          id?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      app_uuid: {
        Args: Record<string, never>;
        Returns: string;
      };
      generate_booking_reference: {
        Args: Record<string, never>;
        Returns: string;
      };
    };
    Enums: {
      booking_status: "confirmed" | "cancelled" | "pending" | "pending_allocation";
      booking_type: "breakfast" | "lunch" | "dinner" | "drinks";
      seating_preference_type: "any" | "indoor" | "window" | "booth" | "bar" | "outdoor";
      loyalty_tier: "bronze" | "silver" | "gold" | "platinum";
      waiting_status: "waiting" | "notified" | "expired" | "fulfilled" | "cancelled";
      analytics_event_type: "booking.created" | "booking.cancelled" | "booking.allocated" | "booking.waitlisted";
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

export type PublicSchema = Database["public"];

export type Tables<T extends keyof PublicSchema["Tables"]> =
  PublicSchema["Tables"][T]["Row"];
export type TablesInsert<T extends keyof PublicSchema["Tables"]> =
  PublicSchema["Tables"][T]["Insert"];
export type TablesUpdate<T extends keyof PublicSchema["Tables"]> =
  PublicSchema["Tables"][T]["Update"];
