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
  | 'no_show'
  | 'PRIORITY_WAITLIST';

export type OpsDashboardBookingItem = {
  id: string;
  customerId?: string | null;
  status: OpsBookingStatus;
  bookingType?: string | null;
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
  startIso?: string;
  endIso?: string;
  searchText?: string;
  sortTimeMs?: number;
  sortTimelineTimeMs?: number;
  displayTimeRangeLabel?: string;
  displayCustomerLabel?: string;
  displayInitials?: string;
  tableLabel?: string | null;
};

export type OpsDashboardTotals = {
  total: number;
  confirmed: number;
  completed: number;
  pending: number;
  cancelled: number;
  noShow: number;
  upcoming: number;
  covers: number;
};

export type OpsDashboardMeta = {
  date: string;
  timezone: string;
  restaurantId: string;
};

export type OpsServiceBreakdownPeriod = {
  key: string;
  bookings: number;
  covers: number;
};

export type OpsServiceBreakdown = {
  activeBookings: number;
  activeCovers: number;
  periods: OpsServiceBreakdownPeriod[];
};

export type OpsDashboardData = {
  meta: OpsDashboardMeta;
  date: string;
  timezone: string;
  restaurantId: string;
  totals: OpsDashboardTotals;
  serviceBreakdown?: OpsServiceBreakdown;
  bookings: OpsDashboardBookingItem[];
  heatmap?: OpsBookingHeatmap;
};

export type OpsTodayBooking = OpsDashboardBookingItem;
export type OpsTodayTotals = OpsDashboardTotals;
export type OpsTodayBookingsSummary = OpsDashboardData;

export type OpsBookingHeatmap = Record<
  string,
  {
    covers: number;
    bookings: number;
  }
>;

export type OpsBookingsFilters = {
  restaurantId: string;
  tableId?: string | null;
  page?: number;
  pageSize?: number;
  status?: OpsBookingStatus | 'all';
  sort?: 'asc' | 'desc';
  sortBy?: 'start_at' | 'created_at';
  countStrategy?: 'exact' | 'window';
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
  restaurantSlug: string | null;
  restaurantTimezone?: string | null;
  reservationIntervalMinutes?: number | null;
  partySize: number;
  startIso: string;
  endIso: string;
  status: OpsBookingStatus;
  notes?: string | null;
  customerName?: string | null;
  customerEmail?: string | null;
  customerPhone: string | null;
  // Extended fields for detail view
  startTime?: string | null;
  endTime?: string | null;
  reference?: string | null;
  details?: Record<string, unknown> | null;
  source?: string | null;
  profileNotes?: string | null;
  allergies?: string[] | null;
  dietaryRestrictions?: string[] | null;
  seatingPreference?: string | null;
  marketingOptIn?: boolean | null;
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
  isActive?: boolean;
  timezone?: string | null;
  address?: string | null;
  managerDailySummaryEnabled?: boolean;
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

export type OpsCustomersSummary = {
  total: number;
  optedIn: number;
  optedOut: number;
  returning: number;
  vip: number;
  neverVisited: number;
};

export type OpsCustomersPage = {
  items: OpsCustomer[];
  pageInfo: {
    page: number;
    pageSize: number;
    total: number;
    hasNext: boolean;
  };
  summary?: OpsCustomersSummary;
};

export type OpsRejectionBucket = 'day' | 'hour';

export type OpsStrategicPenaltyKey =
  | 'slack'
  | 'scarcity'
  | 'future_conflict'
  | 'structural'
  | 'unknown';

export type TableTimelineServiceKey = 'lunch' | 'dinner' | 'other';

export type TableTimelineSlot = {
  start: string;
  end: string;
  label: string;
  serviceKey: TableTimelineServiceKey;
  disabled: boolean;
};

export type TableTimelineService = {
  key: TableTimelineServiceKey;
  label: string;
  start: string;
  end: string;
  slotCount: number;
};

export type TableTimelineBookingRef = {
  id: string;
  customerName: string | null;
  partySize: number;
  status: OpsBookingStatus;
  startAt: string;
  endAt: string;
  customerEmail?: string | null;
  customerPhone?: string | null;
  notes?: string | null;
  tableIds?: string[];
};

export type TableTimelineHoldRef = {
  id: string;
  bookingId: string | null;
  startAt: string;
  endAt: string;
};

export type TableTimelineSegmentState = 'available' | 'reserved' | 'hold' | 'out_of_service';

export type TableTimelineSegment = {
  start: string;
  end: string;
  state: TableTimelineSegmentState;
  serviceKey: TableTimelineServiceKey;
  booking?: TableTimelineBookingRef | null;
  hold?: TableTimelineHoldRef | null;
};

export type TableTimelineRow = {
  table: {
    id: string;
    tableNumber: string;
    capacity: number;
    zoneId: string | null;
    zoneName: string | null;
    status: 'available' | 'reserved' | 'occupied' | 'out_of_service';
    active: boolean;
  };
  stats: {
    occupancyMinutes: number;
    totalMinutes: number;
    occupancyPercentage: number;
    nextStateAt: string | null;
  };
  segments: TableTimelineSegment[];
};

export type TableTimelineResponse = {
  date: string;
  timezone: string;
  window: {
    start: string;
    end: string;
    isClosed: boolean;
  };
  slots: TableTimelineSlot[];
  services: TableTimelineService[];
  summary: {
    totalTables: number;
    totalCapacity: number;
    availableTables: number;
    zones: { id: string; name: string; active: boolean }[];
    serviceCapacities: Array<{
      key: 'lunch' | 'dinner';
      label: string;
      capacity: number;
      tablesConsidered: number;
      turnsPerTable: number;
      seatsPerTurn: number;
      assumptions: {
        windowMinutes: number;
        turnMinutes: number;
        bufferMinutes: number;
        intervalMinutes: number | null;
      };
    }>;
  } | null;
  tables: TableTimelineRow[];
};

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
