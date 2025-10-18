import type { RestaurantRole } from '@/lib/owner/auth/roles';
import type { HttpError } from '@/lib/http/errors';
import type { MergeType } from '@/utils/ops/table-merges';

export type OpsUser = {
  id: string;
  email: string | null;
};

export type OpsMembership = {
  restaurantId: string;
  restaurantName: string;
  restaurantSlug: string | null;
  role: RestaurantRole;
  createdAt: string | null;
};

export type OpsAccountSnapshot = {
  restaurantName: string | null;
  userEmail: string | null;
  role: RestaurantRole | null;
};

export type OpsPermissionSet = {
  isAdminAnywhere: boolean;
  canManageTeam: boolean;
  canManageSettings: boolean;
};

export type OpsBookingStatus =
  | 'pending'
  | 'pending_allocation'
  | 'confirmed'
  | 'checked_in'
  | 'cancelled'
  | 'completed'
  | 'no_show';

export type OpsTodayBooking = {
  id: string;
  status: OpsBookingStatus;
  startTime: string | null;
  endTime: string | null;
  partySize: number;
  customerName: string;
  customerEmail: string | null;
  customerPhone: string | null;
  notes: string | null;
  reference: string | null;
  details: Record<string, unknown> | null;
  source: string | null;
  loyaltyTier?: 'bronze' | 'silver' | 'gold' | 'platinum' | null;
  loyaltyPoints?: number | null;
  profileNotes?: string | null;
  allergies?: string[] | null;
  dietaryRestrictions?: string[] | null;
  seatingPreference?: string | null;
  marketingOptIn?: boolean | null;
  tableAssignments: {
    tableId: string;
    tableNumber: string;
    capacity: number | null;
    section: string | null;
    mergeGroupId?: string | null;
    mergeType?: MergeType | null;
    mergeDisplayName?: string | null;
    mergePatternLabel?: string | null;
    mergeTotalCapacity?: number | null;
  }[];
  requiresTableAssignment: boolean;
  checkedInAt: string | null;
  checkedOutAt: string | null;
};

export type OpsTodayTotals = {
  total: number;
  confirmed: number;
  completed: number;
  pending: number;
  cancelled: number;
  noShow: number;
  upcoming: number;
  covers: number;
};

export type OpsTodayBookingsSummary = {
  date: string;
  timezone: string;
  restaurantId: string;
  totals: OpsTodayTotals;
  bookings: OpsTodayBooking[];
};

export type OpsBookingHeatmap = Record<
  string,
  {
    covers: number;
    bookings: number;
  }
>;

export type OpsBookingsFilters = {
  restaurantId: string;
  page?: number;
  pageSize?: number;
  status?: OpsBookingStatus | 'all';
  sort?: 'asc' | 'desc';
  from?: Date | string | null;
  to?: Date | string | null;
  query?: string | null;
  statuses?: OpsBookingStatus[] | null;
};

export type OpsWalkInBookingPayload = {
  restaurantId: string;
  date: string;
  time: string;
  party: number;
  bookingType: 'breakfast' | 'lunch' | 'dinner' | 'drinks';
  seating: string;
  notes?: string | null;
  name: string;
  email?: string | null;
  phone?: string | null;
  marketingOptIn?: boolean;
};

export type OpsBookingListItem = {
  id: string;
  restaurantId: string | null;
  restaurantName: string;
  partySize: number;
  startIso: string;
  endIso: string;
  status: OpsBookingStatus;
  notes?: string | null;
  customerName?: string | null;
  customerEmail?: string | null;
  customerPhone: string | null;
};

export type OpsBookingsPage = {
  items: OpsBookingListItem[];
  pageInfo: {
    page: number;
    pageSize: number;
    total: number;
    hasNext: boolean;
  };
};

export type OpsRestaurantOption = {
  id: string;
  name: string;
  slug?: string | null;
  timezone?: string | null;
  address?: string | null;
};

export type OpsServiceError = HttpError | Error;

export type OpsCustomer = {
  id: string;
  restaurantId: string;
  name: string;
  email: string;
  phone: string;
  marketingOptIn: boolean;
  createdAt: string;
  firstBookingAt: string | null;
  lastBookingAt: string | null;
  totalBookings: number;
  totalCovers: number;
  totalCancellations: number;
};

export type OpsCustomersPage = {
  items: OpsCustomer[];
  pageInfo: {
    page: number;
    pageSize: number;
    total: number;
    hasNext: boolean;
  };
};
