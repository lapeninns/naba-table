import type { ProfileResponse } from "@/lib/profile/schema";
import type { User } from "@supabase/supabase-js";


export type BookingStatus =
  | "pending"
  | "pending_allocation"
  | "confirmed"
  | "checked_in"
  | "cancelled"
  | "completed"
  | "no_show"
  | "PRIORITY_WAITLIST";

export type BookingDTO = {
  id: string;
  restaurantId?: string | null;
  restaurantName: string;
  restaurantSlug?: string | null;
  restaurantTimezone?: string | null;
  partySize: number;
  startIso: string;
  endIso: string;
  status: BookingStatus;
  notes?: string | null;
  customerName?: string | null;
  customerEmail?: string | null;
  customerPhone?: string | null;
  reservationIntervalMinutes?: number | null;
  reference?: string | null;
  source?: string | null;
  allergies?: string[] | null;
  dietaryRestrictions?: string[] | null;
  tableAssignments?: {
    groupId: string | null;
    capacitySum: number | null;
    members: {
      tableId: string;
      tableNumber: string;
      capacity: number | null;
      section: string | null;
    }[];
  }[];
  requiresTableAssignment?: boolean;
  checkedInAt?: string | null;
  checkedOutAt?: string | null;
};

export type PageInfo = {
  page: number;
  pageSize: number;
  total: number;
  hasNext: boolean;
};

export type BookingsPage = {
  items: BookingDTO[];
  pageInfo: PageInfo;
};

export type BookingsFilters = {
  page?: number;
  pageSize?: number;
  status?: BookingStatus | "all";
  sort?: "asc" | "desc";
  from?: Date | string | null;
  to?: Date | string | null;
  restaurantId?: string;
};

export type RedirectSpec = {
  redirectTo?: string;
  redirectedFrom?: string;
};

export interface AuthPort {
  getUser(): Promise<User | null>;
  requireUser(spec: RedirectSpec): Promise<User>;
}

export interface BookingsPort {
  list(filters?: BookingsFilters): Promise<BookingsPage>;
}

export interface ProfilePort {
  getSelf(): Promise<ProfileResponse>;
  ensureForUser(user: User): Promise<ProfileResponse>;
}

export type GuestServices = {
  auth: AuthPort;
  bookings: BookingsPort;
  profile: ProfilePort;
};
