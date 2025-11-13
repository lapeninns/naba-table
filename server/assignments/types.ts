import type { AvailabilitySnapshot } from "./availability-tracker";
import type { Table } from "@/server/capacity/table-assignment/types";
import type { Tables } from "@/types/supabase";


export type BookingWithAssignmentState = Tables<"bookings"> & {
  restaurants?: { timezone: string | null; slug: string | null } | Array<{ timezone: string | null; slug: string | null }>;
};

export type TimeSlot = {
  start: string;
  end: string;
};

export type AssignmentPlan = {
  id: string;
  tableIds: string[];
  tables: Table[];
  totalCapacity: number;
  slack: number;
  adjacencySatisfied: boolean;
  zoneId: string | null;
  metadata?: Record<string, unknown>;
};

export type AssignmentContext = {
  booking: BookingWithAssignmentState;
  timeSlot: TimeSlot;
  availability: AvailabilitySnapshot;
  adjacency: Map<string, Set<string>>;
  includePendingHolds: boolean;
};

export type AssignmentStrategy = {
  name: string;
  priority: number;
  evaluate(context: AssignmentContext): Promise<AssignmentPlan[]>;
};

export type AssignmentAttempt = {
  plan: AssignmentPlan;
  strategy: string;
  score: number;
};

export type AssignmentHold = {
  holdId: string;
  expiresAt: string | null;
  tableIds: string[];
};

export type AssignmentSuccess = {
  success: true;
  assignment: AssignmentHold;
  strategy: string;
  plan: AssignmentPlan;
  score: number;
  attempts: AssignmentAttempt[];
};

export type AssignmentFailure = {
  success: false;
  reason: string;
  attempts: AssignmentAttempt[];
};

export type AssignmentResult = AssignmentSuccess | AssignmentFailure;
