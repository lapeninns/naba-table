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
    badgeClass: 'border-amber-200 bg-amber-50 text-amber-800',
    railClass: 'border-l-amber-400/70',
  },
  pending_allocation: {
    label: 'Pending allocation',
    description: 'Needs table allocation.',
    icon: Square,
    badgeClass: 'border-indigo-200 bg-indigo-50 text-indigo-700',
    railClass: 'border-l-indigo-400/70',
  },
  confirmed: {
    label: 'Confirmed',
    description: 'Guest is confirmed to arrive.',
    icon: CheckCircle2,
    badgeClass: 'border-sky-200 bg-sky-50 text-sky-700',
    railClass: 'border-l-sky-400/70',
  },
  checked_in: {
    label: 'Checked in',
    description: 'Guest has arrived and is seated.',
    icon: LogIn,
    badgeClass: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    railClass: 'border-l-emerald-400/70',
    pulse: true,
  },
  completed: {
    label: 'Completed',
    description: 'Visit is finished and closed out.',
    icon: Circle,
    badgeClass: 'border-slate-200 bg-slate-100 text-slate-700',
    railClass: 'border-l-slate-300',
  },
  cancelled: {
    label: 'Cancelled',
    description: 'Booking was cancelled.',
    icon: Ban,
    badgeClass: 'border-slate-300 bg-slate-100 text-slate-700',
    railClass: 'border-l-slate-300',
  },
  no_show: {
    label: 'No show',
    description: 'Guest did not arrive for the booking.',
    icon: AlertTriangle,
    badgeClass: 'border-rose-200 bg-rose-50 text-rose-700',
    railClass: 'border-l-rose-400',
  },
  PRIORITY_WAITLIST: {
    label: 'Priority waitlist',
    description: 'Guest is late. Seat at the next available table.',
    icon: AlertTriangle,
    badgeClass: 'border-orange-200 bg-orange-50 text-orange-700',
    railClass: 'border-l-orange-400/70',
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

