import type { OpsBookingStatus } from '@/types/ops';
import type { Database } from '@/types/supabase';

export type FloorServiceKey = 'lunch' | 'dinner' | 'other';
export type FloorServiceFilter = 'all' | FloorServiceKey;

/** Stored table position: centre point relative to its zone's top-left corner. */
export type FloorPosition = { x: number; y: number; rotation: number };

export type FloorZone = {
  id: string;
  name: string;
  sortOrder: number;
  active: boolean;
};

export type FloorTableShape = 'round' | 'rect';

export type FloorTable = {
  id: string;
  number: string;
  zoneId: string;
  capacity: number;
  minParty: number;
  category: Database['public']['Enums']['table_category'];
  seatingType: Database['public']['Enums']['table_seating_type'];
  mobility: Database['public']['Enums']['table_mobility'];
  /** False when the table or its zone is switched off in Tables settings. */
  bookable: boolean;
  outOfService: boolean;
  notes: string | null;
  shape: FloorTableShape;
  savedPosition: FloorPosition | null;
};

export type FloorBookingTagKind = 'allergy' | 'access' | 'note';

export type FloorBookingTag = { kind: FloorBookingTagKind; label: string };

export type FloorBooking = {
  id: string;
  name: string;
  partySize: number;
  status: OpsBookingStatus;
  /** Guest-facing dining window. */
  startMs: number;
  endMs: number;
  /** Allocator block window (dining plus buffers); used for conflict checks. */
  blockStartMs: number;
  blockEndMs: number;
  checkedInAtMs: number | null;
  checkedOutAtMs: number | null;
  tableIds: string[];
  tags: FloorBookingTag[];
  reference: string | null;
};

export type FloorHold = {
  id: string;
  tableId: string;
  bookingId: string | null;
  startMs: number;
  endMs: number;
};

export type FloorService = {
  key: FloorServiceKey;
  label: string;
  startMs: number;
  endMs: number;
};

export type FloorPlanSnapshot = {
  restaurantId: string;
  date: string;
  timezone: string;
  isClosed: boolean;
  window: { startMs: number; endMs: number } | null;
  services: FloorService[];
  zones: FloorZone[];
  tables: FloorTable[];
  bookings: FloorBooking[];
  holds: FloorHold[];
};
