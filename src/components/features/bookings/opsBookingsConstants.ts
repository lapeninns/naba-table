import type { StatusOption } from '@/components/dashboard/StatusFilterGroup';
import type { OpsBookingStatus } from '@/types/ops';

export const OPS_STATUS_TABS: StatusOption[] = [
  { value: 'recent', label: 'Recent' },
  { value: 'upcoming', label: 'Upcoming' },
  { value: 'all', label: 'All' },
  { value: 'past', label: 'Past' },
  { value: 'cancelled', label: 'Cancelled' },
];

export const OPS_LISTABLE_STATUSES: OpsBookingStatus[] = [
  'pending',
  'pending_allocation',
  'confirmed',
  'checked_in',
  'completed',
  'PRIORITY_WAITLIST',
  'no_show',
  'cancelled',
];

