export type OnboardingStep = 1 | 2 | 3 | 4 | 5 | 6;

export type OperatingHour = {
  dayOfWeek: number;
  opensAt: string | null;
  closesAt: string | null;
  isClosed: boolean;
  notes?: string | null;
};

export type ServicePeriod = {
  id?: string;
  name: string;
  dayOfWeek: number | null;
  startTime: string;
  endTime: string;
  bookingOption: string;
};

export type Zone = {
  id?: string;
  name: string;
  areaType?: 'indoor' | 'outdoor';
  sortOrder?: number;
  active?: boolean;
};

export type TableInventoryItem = {
  id?: string;
  tableNumber: string;
  capacity: number;
  minPartySize?: number | null;
  maxPartySize?: number | null;
  zoneId?: string | null;
  category?: 'dining' | 'bar' | 'lounge' | 'patio' | 'private';
  seatingType?: 'standard' | 'booth' | 'high_top' | 'sofa';
  mobility?: 'fixed' | 'movable' | 'adjustable';
  status?: 'available' | 'maintenance' | 'reserved';
};

export type RestaurantProfile = {
  name: string;
  slug: string;
  timezone: string;
  capacity?: number | null;
  contactEmail?: string | null;
  contactPhone?: string | null;
  address?: string | null;
  googleMapUrl?: string | null;
  bookingPolicy?: string | null;
  reservationIntervalMinutes?: number;
  reservationDefaultDurationMinutes?: number;
  reservationLastSeatingBufferMinutes?: number;
  emailSendReminder24h?: boolean;
  emailSendReminderShort?: boolean;
  emailSendReviewRequest?: boolean;
};

export type AccountDetails = {
  email: string;
  password?: string;
  mode: 'password' | 'magic_link';
};

/** Setup requirement reported by the launch readiness check (409 ONBOARDING_INCOMPLETE). */
export type OnboardingRequirement = 'operating_hours' | 'service_periods' | 'tables';

/**
 * What the server knows when the page renders. It lets the wizard resume after the
 * signup confirmation hop (the email link opens a new tab, and the draft lives in
 * per-tab sessionStorage) without keeping account details in persistent storage.
 */
export type OnboardingResume = {
  /** Null when nobody is signed in. */
  session: { email: string | null } | null;
  /** Restaurants the signed-in user belongs to. */
  memberRestaurantIds: string[];
  /** The owner's only restaurant while it is still missing setup; the wizard continues it. */
  resumeRestaurant: {
    id: string;
    name: string;
    slug: string;
    timezone: string;
    /**
     * What is already saved for the restaurant, so a resumed wizard shows (and re-saves) it
     * instead of client defaults. Null when it could not be read.
     */
    setup: OnboardingSavedSetup | null;
  } | null;
};

/** Saved hours, service periods and layout for a restaurant being resumed. */
export type OnboardingSavedSetup = {
  /** All seven days; days without a saved row are closed. */
  operatingHours: OperatingHour[];
  servicePeriods: ServicePeriod[];
  zones: Zone[];
  tables: TableInventoryItem[];
};

export type OnboardingState = {
  step: OnboardingStep;
  restaurantId: string | null;
  /** From the server on each render; never persisted. Undefined means unknown. */
  session?: { email: string | null } | null;
  /** Signed-in user already has a set-up restaurant; the wizard offers the dashboard. */
  alreadyOnboarded?: boolean;
  account?: AccountDetails;
  profile: RestaurantProfile;
  operatingHours: OperatingHour[];
  servicePeriods: ServicePeriod[];
  zones: Zone[];
  tables: TableInventoryItem[];
  loading: boolean;
  error: string | null;
};
