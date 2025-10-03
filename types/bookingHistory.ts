export type BookingHistoryChange = {
  field: string;
  label: string;
  before: unknown;
  after: unknown;
};

export type BookingHistoryEvent = {
  versionId: number;
  changeType: 'created' | 'updated' | 'cancelled' | 'deleted';
  changedAt: string;
  actor: string;
  summary: string;
  changes: BookingHistoryChange[];
};

export type BookingHistoryOptions = {
  limit?: number;
  offset?: number;
};
