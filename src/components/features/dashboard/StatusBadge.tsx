
import { Circle, Clock, CheckCircle2, LogIn, LogOut, XCircle, AlertTriangle } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import type { BadgeProps } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

import type { OpsBookingStatus } from '@/types/ops';
import type { ComponentType } from 'react';

type StatusConfig = {
  label: string;
  className: string;
  variant: BadgeProps['variant'];
  icon: ComponentType<{ className?: string }>;
};

const STATUS_CONFIG: Record<OpsBookingStatus, StatusConfig> = {
  pending: {
    label: 'Pending',
    variant: 'outline',
    className: 'border-amber-200 bg-amber-50 text-amber-800',
    icon: Clock,
  },
  pending_allocation: {
    label: 'Pending allocation',
    variant: 'outline',
    className: 'border-indigo-200 bg-indigo-50 text-indigo-700',
    icon: Circle,
  },
  confirmed: {
    label: 'Confirmed',
    variant: 'secondary',
    className: 'border-sky-200 bg-sky-50 text-sky-700',
    icon: CheckCircle2,
  },
  checked_in: {
    label: 'Checked in',
    variant: 'secondary',
    className: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    icon: LogIn,
  },
  completed: {
    label: 'Completed',
    variant: 'outline',
    className: 'border-slate-200 bg-slate-100 text-slate-700',
    icon: LogOut,
  },
  cancelled: {
    label: 'Cancelled',
    variant: 'outline',
    className: 'border-slate-300 bg-slate-100 text-slate-700',
    icon: XCircle,
  },
  no_show: {
    label: 'No show',
    variant: 'destructive',
    className: 'border-rose-200 bg-rose-50 text-rose-700',
    icon: AlertTriangle,
  },
  PRIORITY_WAITLIST: {
    label: 'Priority Waitlist',
    variant: 'secondary',
    className: 'border-purple-200 bg-purple-50 text-purple-800',
    icon: Clock,
  },
};

type StatusBadgeProps = {
  status: OpsBookingStatus;
  className?: string;
};

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const config = STATUS_CONFIG[status] ?? STATUS_CONFIG.confirmed;
  const Icon = config.icon;

  return (
    <Badge
      variant={config.variant}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold uppercase tracking-wide',
        config.className,
        className,
      )}
      role="status"
      aria-live="polite"
    >
      <Icon className="h-3.5 w-3.5" aria-hidden />
      <span>{config.label}</span>
    </Badge>
  );
}
