export type OperationsHubStatus = 'seated' | 'arriving' | 'finishing' | 'overdue';

export type OperationsHubTable = {
  id: string;
  name: string;
  capacity: number;
  zone: string | null;
  zoneId: string | null;
};

export type OperationsHubReservation = {
  id: string;
  tableId: string;
  name: string;
  guests: number;
  start: string; // HH:mm
  end: string; // HH:mm
  status: OperationsHubStatus;
  bookingId?: string | null;
};

export type OperationsHubKpis = {
  occupancyPercentage: number;
  turnRateMinutes: number | null;
  bookingsCount: number;
  alertsCount: number;
};

export type OperationsHubFeedPriority = 'high' | 'attention' | 'log';

export type OperationsHubFeedItem = {
  id: string;
  time: string; // HH:mm:ss
  title: string;
  detail: string;
  priority: OperationsHubFeedPriority;
};

export type OperationsHubResponse = {
  date: string;
  timezone: string;
  window: {
    start: string; // HH:mm
    end: string; // HH:mm
  };
  tables: OperationsHubTable[];
  reservations: OperationsHubReservation[];
  kpis: OperationsHubKpis;
  feed: OperationsHubFeedItem[];
};
