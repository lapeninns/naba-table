import {
  AlertTriangle,
  Ban,
  CheckCircle2,
  Circle,
  Clock,
  LogIn,
  Square,
  type LucideIcon,
} from 'lucide-react';

import type { OpsBookingStatus } from '@/types/ops';

export type OpsBookingStatusUi = {
  label: string;
  description: string;
  icon: LucideIcon;
  badgeClass: string;
  railClass: string;
  pulse?: boolean;
};

// Canonical status UI config. Single source of truth for labels, descriptions, icons and tones.
export const OPS_BOOKING_STATUS_UI: Record<OpsBookingStatus, OpsBookingStatusUi> = {
  pending: {
    label: 'Pending',
    description: 'Awaiting confirmation or allocation.',
    icon: Clock,
    badgeClass: 'border-warning/40 bg-warning/10 text-warning',
    railClass: 'border-l-warning/60',
  },
  pending_allocation: {
    label: 'Pending allocation',
    description: 'Needs table allocation.',
    icon: Square,
    badgeClass: 'border-warning/40 bg-warning/10 text-warning',
    railClass: 'border-l-warning/60',
  },
  confirmed: {
    label: 'Confirmed',
    description: 'Guest is confirmed to arrive.',
    icon: CheckCircle2,
    badgeClass: 'border-success/30 bg-success/10 text-success',
    railClass: 'border-l-success/70',
  },
  checked_in: {
    label: 'Checked in',
    description: 'Guest has arrived and is seated.',
    icon: LogIn,
    badgeClass: 'border-info/30 bg-info/10 text-info',
    railClass: 'border-l-info',
    pulse: true,
  },
  completed: {
    label: 'Completed',
    description: 'Visit is finished and closed out.',
    icon: Circle,
    badgeClass: 'border-border bg-muted text-muted-foreground',
    railClass: 'border-l-border',
  },
  cancelled: {
    label: 'Cancelled',
    description: 'Booking was cancelled.',
    icon: Ban,
    badgeClass: 'border-border bg-muted text-muted-foreground',
    railClass: 'border-l-border',
  },
  no_show: {
    label: 'No show',
    description: 'Guest did not arrive for the booking.',
    icon: AlertTriangle,
    badgeClass: 'border-destructive/20 bg-destructive/10 text-destructive',
    railClass: 'border-l-destructive',
  },
  PRIORITY_WAITLIST: {
    label: 'Priority waitlist',
    description: 'Guest is late. Seat at the next available table.',
    icon: AlertTriangle,
    badgeClass: 'border-destructive/20 bg-destructive/10 text-destructive',
    railClass: 'border-l-destructive/70',
  },
};

export const OPS_BOOKING_STATUS_ORDER: OpsBookingStatus[] = [
  'confirmed',
  'checked_in',
  'completed',
  'pending',
  'pending_allocation',
  'PRIORITY_WAITLIST',
  'no_show',
  'cancelled',
];

export function getOpsBookingStatusUi(status: OpsBookingStatus): OpsBookingStatusUi {
  return OPS_BOOKING_STATUS_UI[status] ?? OPS_BOOKING_STATUS_UI.confirmed;
}
