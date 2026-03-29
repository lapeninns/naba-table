import type { OpsStatusFilter } from '@/hooks/ops/useOpsBookingsTableState';
import type { OpsBookingStatus } from '@/types/ops';

export type OpsBookingsWindowMode = 'day' | 'window';

export type OpsBookingsClientStateParams = {
  initialFilter?: OpsStatusFilter | null;
  initialRestaurantId?: string | null;
  initialQuery?: string | null;
  initialStatuses?: OpsBookingStatus[] | null;
  initialDate?: string | null;
  initialTableId?: string | null;
  initialTableLabel?: string | null;
  initialTime?: string | null;
  initialWindowMode?: OpsBookingsWindowMode | null;
  initialWindowMinutes?: number | null;
};
