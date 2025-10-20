export type WeeklyRow = {
  dayOfWeek: number;
  opensAt: string;
  closesAt: string;
  isClosed: boolean;
  notes: string;
};

export type OverrideRow = {
  id?: string;
  effectiveDate: string;
  opensAt: string;
  closesAt: string;
  isClosed: boolean;
  notes: string;
};

export type ServicePeriodRow = {
  id?: string;
  name: string;
  dayOfWeek: number | null;
  startTime: string;
  endTime: string;
  bookingOption: OccasionKey;
};

export type WeeklyErrors = Record<number, { opensAt?: string; closesAt?: string }>;
export type OverrideErrors = Array<{ effectiveDate?: string; opensAt?: string; closesAt?: string }>;
export type ServicePeriodErrors = Array<{
  name?: string;
  startTime?: string;
  endTime?: string;
  bookingOption?: string;
}>;

export const DAYS_OF_WEEK = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export const DAY_OPTIONS: Array<{ value: number | null; label: string }> = [
  { value: null, label: 'All days' },
  { value: 0, label: 'Sunday' },
  { value: 1, label: 'Monday' },
  { value: 2, label: 'Tuesday' },
  { value: 3, label: 'Wednesday' },
  { value: 4, label: 'Thursday' },
  { value: 5, label: 'Friday' },
  { value: 6, label: 'Saturday' },
];

import type { OccasionKey } from '@reserve/shared/occasions';
