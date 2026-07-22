import { AlertTriangle, CheckCircle2, CircleDashed, ShieldAlert, ShieldCheck } from 'lucide-react';

import { OpsStatusBadge } from '@/components/features/ops-shell/patterns/OpsStatusBadge';
import { cn } from '@/lib/utils';

import type { OpsStatusTone } from '@/lib/ops/status-tones';
import type { GoogleBusinessProfileConnection } from '@/services/ops/restaurants';
import type { LucideIcon } from 'lucide-react';

export type StatusTone = 'verified' | 'drift' | 'error' | 'pending' | 'muted';

/**
 * Domain mapper: a Google-Business connection tone → the canonical ops semantic
 * tone + status icon. The badge renders through {@link OpsStatusBadge} so the
 * full semantic palette (verified = green, drift = amber, error = red) and the
 * shared pill treatment stay consistent with every other ops status, instead of
 * this surface carrying its own hand-rolled tone map.
 */
const TONE_MAP: Record<StatusTone, { tone: OpsStatusTone; icon: LucideIcon }> = {
  verified: { tone: 'success', icon: CheckCircle2 },
  drift: { tone: 'warning', icon: AlertTriangle },
  error: { tone: 'danger', icon: ShieldAlert },
  pending: { tone: 'info', icon: CircleDashed },
  muted: { tone: 'muted', icon: ShieldCheck },
};

type StatusBadgeProps = {
  tone: StatusTone;
  label: string;
  className?: string;
  showIcon?: boolean;
};

export function StatusBadge({ tone, label, className, showIcon = true }: StatusBadgeProps) {
  const { tone: opsTone, icon } = TONE_MAP[tone];

  return (
    <OpsStatusBadge
      tone={opsTone}
      label={label}
      icon={showIcon ? icon : undefined}
      className={cn('gap-1.5 rounded-full px-2.5 py-0.5', className)}
    />
  );
}

export function connectionStatusBadge(status: GoogleBusinessProfileConnection['status']): {
  tone: StatusTone;
  label: string;
} {
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
