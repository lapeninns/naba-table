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

export type OnboardingState = {
  step: OnboardingStep;
  restaurantId: string | null;
  account?: AccountDetails;
  profile: RestaurantProfile;
  operatingHours: OperatingHour[];
  servicePeriods: ServicePeriod[];
  zones: Zone[];
  tables: TableInventoryItem[];
  loading: boolean;
  error: string | null;
};
