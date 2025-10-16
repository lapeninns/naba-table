/**
 * Capacity & Availability Engine - Table Assignment Service
 * Story 2: Stub for v2 (Manual Assignment Only in v1)
 * 
 * This service will handle:
 * - Finding suitable tables for party size
 * - Auto-assignment algorithm
 * - Table combinability logic
 * 
 * For v1: All table assignments are manual via ops dashboard
 * For v2: Implement auto-assignment here
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";
import { getServiceSupabaseClient } from "@/server/supabase";

type DbClient = SupabaseClient<Database, "public", any>;

// =====================================================
// Types
// =====================================================

export type Table = {
  id: string;
  tableNumber: string;
  capacity: number;
  minPartySize: number;
  maxPartySize: number | null;
  section: string | null;
  seatingType: string;
  status: string;
  position: Record<string, any> | null;
};

export type TableMatchParams = {
  partySize: number;
  seatingPreference?: string;
  section?: string;
};

export type TableAssignment = {
  tableId: string;
  tableNumber: string;
  capacity: number;
};

// =====================================================
// Table Finding Functions (v2)
// =====================================================

/**
 * Find suitable tables for a party size
 * 
 * v1: Returns empty array (manual assignment only)
 * v2: Will implement smart matching algorithm
 * 
 * Algorithm (v2):
 * 1. Exact match: table.capacity === partySize
 * 2. Next size up: table.capacity > partySize (smallest that fits)
 * 3. Combinable tables: 2+ tables that sum to partySize
 * 
 * @param restaurantId - Restaurant ID
 * @param params - Party size and preferences
 * @param client - Optional Supabase client
 * @returns Array of suitable tables
 */
export async function findSuitableTables(
  restaurantId: string,
  params: TableMatchParams,
  client?: DbClient
): Promise<Table[]> {
  // v1: Not implemented, return empty array
  // Ops staff will assign tables manually
  
  console.warn(
    "[v1] findSuitableTables is not implemented. Use manual table assignment in ops dashboard."
  );
  
  return [];
  
  // v2 Implementation Plan:
  // const supabase = client ?? getServiceSupabaseClient();
  // const { partySize, seatingPreference, section } = params;
  //
  // // Query available tables
  // let query = supabase
  //   .from("table_inventory")
  //   .select("*")
  //   .eq("restaurant_id", restaurantId)
  //   .eq("status", "available")
  //   .gte("capacity", partySize)
  //   .order("capacity", { ascending: true });
  //
  // if (seatingPreference && seatingPreference !== "any") {
  //   query = query.eq("seating_type", seatingPreference);
  // }
  //
  // if (section) {
  //   query = query.eq("section", section);
  // }
  //
  // const { data, error } = await query.limit(10);
  //
  // if (error) {
  //   throw new Error(`Failed to find tables: ${error.message}`);
  // }
  //
  // return data ?? [];
}

/**
 * Assign a table to a booking
 * 
 * v1: Throws error (use RPC function assign_table_to_booking directly)
 * v2: Will wrap RPC and add business logic
 * 
 * @param bookingId - Booking ID
 * @param tableId - Table ID
 * @param assignedBy - User ID of assigner
 * @param client - Optional Supabase client
 * @returns Assignment ID
 */
export async function assignTableToBooking(
  bookingId: string,
  tableId: string,
  assignedBy?: string,
  client?: DbClient
): Promise<string> {
  const supabase = client ?? getServiceSupabaseClient();

  // Call database RPC function
  const { data, error } = await supabase.rpc("assign_table_to_booking", {
    p_booking_id: bookingId,
    p_table_id: tableId,
    p_assigned_by: assignedBy ?? null,
    p_notes: null,
  });

  if (error) {
    throw new Error(`Failed to assign table: ${error.message}`);
  }

  return data as string;
}

/**
 * Unassign a table from a booking
 * 
 * v1: Calls RPC function
 * v2: Will add business logic
 * 
 * @param bookingId - Booking ID
 * @param tableId - Table ID
 * @param client - Optional Supabase client
 * @returns Success boolean
 */
export async function unassignTableFromBooking(
  bookingId: string,
  tableId: string,
  client?: DbClient
): Promise<boolean> {
  const supabase = client ?? getServiceSupabaseClient();

  // Call database RPC function
  const { data, error } = await supabase.rpc("unassign_table_from_booking", {
    p_booking_id: bookingId,
    p_table_id: tableId,
  });

  if (error) {
    throw new Error(`Failed to unassign table: ${error.message}`);
  }

  return data as boolean;
}

/**
 * Get table assignments for a booking
 * 
 * @param bookingId - Booking ID
 * @param client - Optional Supabase client
 * @returns Array of table assignments
 */
export async function getBookingTableAssignments(
  bookingId: string,
  client?: DbClient
): Promise<TableAssignment[]> {
  const supabase = client ?? getServiceSupabaseClient();

  const { data, error } = await supabase
    .from("booking_table_assignments")
    .select(`
      table_id,
      table_inventory (
        table_number,
        capacity
      )
    `)
    .eq("booking_id", bookingId);

  if (error) {
    throw new Error(`Failed to get table assignments: ${error.message}`);
  }

  return (data ?? []).map((assignment: any) => ({
    tableId: assignment.table_id,
    tableNumber: assignment.table_inventory.table_number,
    capacity: assignment.table_inventory.capacity,
  }));
}

// =====================================================
// Auto-Assignment Algorithm (v2 - Placeholder)
// =====================================================

/**
 * Auto-assign tables to a booking
 * 
 * v1: Not implemented
 * v2: Smart assignment algorithm
 * 
 * Strategy:
 * 1. Try exact match first
 * 2. Try next size up (minimize wasted capacity)
 * 3. Try combining 2 tables
 * 4. Fail if no suitable combination
 * 
 * @param bookingId - Booking ID
 * @param partySize - Party size
 * @param preferences - Seating preferences
 * @param client - Optional Supabase client
 * @returns Array of assigned table IDs
 */
export async function autoAssignTables(
  bookingId: string,
  partySize: number,
  preferences?: TableMatchParams,
  client?: DbClient
): Promise<string[]> {
  throw new Error(
    "Auto-assignment not implemented in v1. Use manual assignment in ops dashboard."
  );

  // v2 Implementation Plan:
  // 1. Get booking details (restaurant, date, time)
  // 2. Find suitable tables using findSuitableTables()
  // 3. Select best match(es)
  // 4. Call assignTableToBooking() for each selected table
  // 5. Return assigned table IDs
}

// =====================================================
// Helper Functions
// =====================================================

/**
 * Check if a table is available at a specific time
 * 
 * v1: Basic implementation
 * v2: Add slot-level checking
 */
export async function isTableAvailable(
  tableId: string,
  date: string,
  startTime: string,
  endTime: string,
  client?: DbClient
): Promise<boolean> {
  const supabase = client ?? getServiceSupabaseClient();

  // Check if table has any conflicting assignments
  const { data, error } = await supabase
    .from("booking_table_assignments")
    .select(`
      id,
      bookings!inner (
        booking_date,
        start_time,
        end_time,
        status
      )
    `)
    .eq("table_id", tableId);

  if (error) {
    throw new Error(`Failed to check table availability: ${error.message}`);
  }

  // Check for time overlaps with active bookings
  const hasConflict = (data ?? []).some((assignment: any) => {
    const booking = assignment.bookings;
    
    // Skip cancelled/no-show bookings
    if (["cancelled", "no_show"].includes(booking.status)) {
      return false;
    }

    // Same date?
    if (booking.booking_date !== date) {
      return false;
    }

    // Time overlap?
    // Booking: [booking.start_time, booking.end_time)
    // Requested: [startTime, endTime)
    // Overlap if: booking.start_time < endTime AND startTime < booking.end_time
    return booking.start_time < endTime && startTime < booking.end_time;
  });

  return !hasConflict;
}
