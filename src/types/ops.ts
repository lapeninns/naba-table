import type { HttpError } from '@/lib/http/errors';
import type { RestaurantRole } from '@/lib/owner/auth/roles';
import type { OccasionKey } from '@reserve/shared/occasions';

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

export type OpsFeatureFlags = {
  opsMetrics: boolean;
  selectorScoring: boolean;
  rejectionAnalytics: boolean;
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
    groupId: string | null;
    capacitySum: number | null;
    members: {
      tableId: string;
      tableNumber: string;
      capacity: number | null;
      section: string | null;
    }[];
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
  sortBy?: 'start_at' | 'created_at';
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
  bookingType: OccasionKey;
  seating: string;
  notes?: string | null;
  name: string;
  email?: string | null;
  phone?: string | null;
  marketingOptIn?: boolean;
  override?: {
    apply: boolean;
    reason?: string | null;
  } | null;
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

export type OpsRejectionBucket = 'day' | 'hour';

export type OpsStrategicPenaltyKey = 'slack' | 'scarcity' | 'future_conflict' | 'structural' | 'unknown';

export type OpsRejectionSeriesPoint = {
  bucket: string;
  hard: number;
  strategic: number;
};

export type OpsRejectionTopReason = {
  label: string;
  count: number;
};

export type OpsRejectionTopPenalty = {
  penalty: OpsStrategicPenaltyKey;
  count: number;
};

export type OpsStrategicSample = {
  bookingId: string | null;
  createdAt: string;
  skipReason: string | null;
  dominantPenalty: OpsStrategicPenaltyKey;
  penalties: {
    slack: number;
    scarcity: number;
    futureConflict: number;
  };
  plannerConfig: Record<string, unknown> | null;
};

export type OpsRejectionAnalytics = {
  restaurantId: string;
  range: {
    from: string;
    to: string;
    bucket: OpsRejectionBucket;
  };
  summary: {
    total: number;
    hard: {
      count: number;
      percent: number;
      topReasons: OpsRejectionTopReason[];
    };
    strategic: {
      count: number;
      percent: number;
      topPenalties: OpsRejectionTopPenalty[];
    };
  };
  series: OpsRejectionSeriesPoint[];
  strategicSamples: OpsStrategicSample[];
};

export type OpsStrategicSettingsSource = 'env' | 'db';

export type OpsStrategicSettings = {
  restaurantId: string;
  source: OpsStrategicSettingsSource;
  weights: {
    scarcity: number;
    demandMultiplier: number | null;
    futureConflictPenalty: number | null;
  };
  updatedAt: string | null;
};
