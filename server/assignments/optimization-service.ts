import { recordObservabilityEvent } from "@/server/observability";
import { getServiceSupabaseClient } from "@/server/supabase";

import type { Table } from "@/server/capacity/table-assignment/types";
import type { Database, Tables } from "@/types/supabase";
import type { SupabaseClient } from "@supabase/supabase-js";



export type OptimizationWeights = {
  maximizeCapacityUtilization: number;
  minimizeTableFragmentation: number;
  respectPreferences: number;
  balanceStaffWorkload: number;
};

export class OptimizationService {
  constructor(private readonly supabase: SupabaseClient<Database> = getServiceSupabaseClient()) {}

  async optimizeDay(restaurantId: string, date: string): Promise<void> {
    const bookings = await this.getBookingsForDay(restaurantId, date);
    const tables = await this.getRestaurantTables(restaurantId);
    if (bookings.length === 0 || tables.length === 0) {
      return;
    }

    const optimizer = new TableOptimizer(tables, bookings);
    const currentScore = optimizer.scoreAssignments(bookings);
    const optimized = optimizer.optimize({
      maximizeCapacityUtilization: 0.3,
      minimizeTableFragmentation: 0.3,
      respectPreferences: 0.2,
      balanceStaffWorkload: 0.2,
    });

    if (optimized.score <= currentScore * 1.1) {
      return;
    }

    await this.applyOptimizedAssignments(restaurantId, optimized.assignments, optimized.score);
  }

  private async getBookingsForDay(restaurantId: string, date: string): Promise<Array<Tables<"bookings">>> {
    const { data } = await this.supabase
      .from("bookings")
      .select("id, party_size, assigned_zone_id, status")
      .eq("restaurant_id", restaurantId)
      .eq("booking_date", date)
      .in("status", ["pending", "pending_allocation", "confirmed"]);
    return (Array.isArray(data) ? data : []) as Array<Tables<"bookings">>;
  }

  private async getRestaurantTables(restaurantId: string): Promise<Table[]> {
    const { data } = await this.supabase
      .from("table_inventory")
      .select("id, capacity, zone_id, status, active")
      .eq("restaurant_id", restaurantId);
    if (!Array.isArray(data)) {
      return [];
    }
    return data.map((row) => ({
      id: row.id,
      capacity: row.capacity ?? 0,
      tableNumber: row.id,
      zoneId: row.zone_id,
      status: row.status,
      active: row.active,
    }));
  }

  private async applyOptimizedAssignments(
    restaurantId: string,
    assignments: OptimizedAssignment[],
    score: number,
  ): Promise<void> {
    await recordObservabilityEvent({
      source: "assignment.optimizer",
      eventType: "optimizer.plan_ready",
      restaurantId,
      context: {
        score,
        suggestions: assignments,
      },
    });
  }
}

type OptimizedAssignment = {
  bookingId: string;
  tableIds: string[];
};

class TableOptimizer {
  constructor(private readonly tables: Table[], private readonly bookings: Tables<"bookings">[]) {}

  scoreAssignments(bookings: Tables<"bookings">[]): number {
    return bookings.reduce((score, booking) => {
      return score + (booking.party_size ?? 0);
    }, 0);
  }

  optimize(weights: OptimizationWeights): { assignments: OptimizedAssignment[]; score: number } {
    const sortedBookings = [...this.bookings].sort((a, b) => (b.party_size ?? 0) - (a.party_size ?? 0));
    const availableTables = [...this.tables].filter((table) => table.active !== false && table.status !== "out_of_service");
    const assignments: OptimizedAssignment[] = [];
    const usedTables = new Set<string>();

    for (const booking of sortedBookings) {
      const bestTable = this.findBestTable(booking, availableTables, usedTables);
      if (bestTable) {
        usedTables.add(bestTable.id);
        assignments.push({ bookingId: booking.id, tableIds: [bestTable.id] });
      }
    }

    const score = this.computeScore(assignments, weights);
    return { assignments, score };
  }

  private findBestTable(
    booking: Tables<"bookings">,
    tables: Table[],
    used: Set<string>,
  ): Table | null {
    const candidates = tables.filter((table) => !used.has(table.id) && (table.capacity ?? 0) >= (booking.party_size ?? 0));
    if (candidates.length === 0) {
      return null;
    }
    candidates.sort((a, b) => (a.capacity ?? 0) - (b.capacity ?? 0));
    return candidates[0] ?? null;
  }

  private computeScore(assignments: OptimizedAssignment[], weights: OptimizationWeights): number {
    let score = 0;
    score += assignments.length * weights.maximizeCapacityUtilization;
    const fragmentationPenalty = assignments.reduce((total, assignment) => total + Math.max(0, assignment.tableIds.length - 1), 0);
    score -= fragmentationPenalty * weights.minimizeTableFragmentation;
    score += assignments.length * weights.respectPreferences * 0.5;
    score += assignments.length * weights.balanceStaffWorkload * 0.5;
    return score;
  }
}
