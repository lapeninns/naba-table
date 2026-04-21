import { AlertTriangle, CheckCircle2, CircleDashed, ShieldAlert, ShieldCheck } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

import type { GoogleBusinessProfileConnection } from '@/services/ops/restaurants';
import type { LucideIcon } from 'lucide-react';

export type StatusTone = 'verified' | 'drift' | 'error' | 'pending' | 'muted';

type ToneConfig = {
  className: string;
  icon: LucideIcon;
};

const TONES: Record<StatusTone, ToneConfig> = {
  verified: {
    className: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    icon: CheckCircle2,
  },
  drift: {
    className: 'border-amber-200 bg-amber-50 text-amber-800',
    icon: AlertTriangle,
  },
  error: {
    className: 'border-red-200 bg-red-50 text-red-700',
    icon: ShieldAlert,
  },
  pending: {
    className: 'border-sky-200 bg-sky-50 text-sky-700',
    icon: CircleDashed,
  },
  muted: {
    className: 'border-border bg-muted text-muted-foreground',
    icon: ShieldCheck,
  },
};

type StatusBadgeProps = {
  tone: StatusTone;
  label: string;
  className?: string;
  showIcon?: boolean;
};

export function StatusBadge({ tone, label, className, showIcon = true }: StatusBadgeProps) {
  const config = TONES[tone];
  const Icon = config.icon;

  return (
    <Badge
      variant="outline"
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium',
        config.className,
        className,
      )}
    >
      {showIcon ? <Icon className="size-3.5" aria-hidden /> : null}
      {label}
    </Badge>
  );
}

export function connectionStatusBadge(
  status: GoogleBusinessProfileConnection['status'],
): { tone: StatusTone; label: string } {
  switch (status) {
    case 'linked':
      return { tone: 'verified', label: 'Linked' };
    case 'sync_error':
      return { tone: 'error', label: 'Sync issue' };
    case 'reauth_required':
      return { tone: 'error', label: 'Reconnect needed' };
    case 'authorized':
      return { tone: 'pending', label: 'Choose location' };
    case 'pending_auth':
      return { tone: 'pending', label: 'Awaiting Google' };
    case 'unlinked':
    default:
      return { tone: 'muted', label: 'Not connected' };
  }
}

export function alignmentToneForMatch(
  status: 'matched' | 'partial' | 'drifted' | 'unavailable',
): { tone: StatusTone; label: string } {
  switch (status) {
    case 'matched':
      return { tone: 'verified', label: 'In sync' };
    case 'partial':
      return { tone: 'pending', label: 'Partial' };
    case 'drifted':
      return { tone: 'drift', label: 'Drifted' };
    case 'unavailable':
    default:
      return { tone: 'muted', label: 'No data' };
  }
}
