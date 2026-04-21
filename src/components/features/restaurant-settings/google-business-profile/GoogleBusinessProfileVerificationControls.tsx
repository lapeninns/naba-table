'use client';

import {
  ArrowDownToLine,
  ArrowUpFromLine,
  CheckCheck,
  ShieldAlert,
  ShieldCheck,
  ShieldQuestion,
} from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

import type { CoreSyncDirection } from '@/services/ops/restaurants';

type GoogleBusinessProfileVerificationControlsProps = {
  status: 'verified' | 'drifted' | 'partial' | 'unavailable';
  recommendedDirection: CoreSyncDirection | null;
  canPull: boolean;
  canPush: boolean;
  onPull?: () => void;
  onPush?: () => void;
  isPulling?: boolean;
  isPushing?: boolean;
  disabled?: boolean;
  className?: string;
};

function statusBadge(status: GoogleBusinessProfileVerificationControlsProps['status']) {
  switch (status) {
    case 'verified':
      return {
        label: 'GBP Verified',
        icon: ShieldCheck,
        className: 'border-emerald-200 bg-emerald-50 text-emerald-700',
      };
    case 'drifted':
      return {
        label: 'GBP Drifted',
        icon: ShieldAlert,
        className: 'border-amber-200 bg-amber-50 text-amber-700',
      };
    case 'partial':
      return {
        label: 'GBP Partial',
        icon: CheckCheck,
        className: 'border-sky-200 bg-sky-50 text-sky-700',
      };
    case 'unavailable':
    default:
      return {
        label: 'GBP Unavailable',
        icon: ShieldQuestion,
        className: 'border-border bg-muted text-muted-foreground',
      };
  }
}

export function GoogleBusinessProfileVerificationControls({
  status,
  recommendedDirection,
  canPull,
  canPush,
  onPull,
  onPush,
  isPulling = false,
  isPushing = false,
  disabled = false,
  className,
}: GoogleBusinessProfileVerificationControlsProps) {
  const badge = statusBadge(status);
  const BadgeIcon = badge.icon;

  return (
    <div className={cn('flex flex-wrap items-center justify-end gap-2', className)}>
      <Badge
        variant="outline"
        className={cn(
          'gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide',
          badge.className,
        )}
      >
        <BadgeIcon className="size-3.5" aria-hidden />
        <span>{badge.label}</span>
      </Badge>
      {canPull ? (
        <Button
          type="button"
          size="sm"
          variant={recommendedDirection === 'pull_from_gbp' ? 'default' : 'outline'}
          onClick={onPull}
          disabled={disabled || isPulling || isPushing}
        >
          <ArrowDownToLine className="mr-2 size-4" aria-hidden />
          {isPulling ? 'Syncing from GBP...' : 'Sync from GBP'}
        </Button>
      ) : null}
      {canPush ? (
        <Button
          type="button"
          size="sm"
          variant={recommendedDirection === 'push_to_gbp' ? 'default' : 'outline'}
          onClick={onPush}
          disabled={disabled || isPulling || isPushing}
        >
          <ArrowUpFromLine className="mr-2 size-4" aria-hidden />
          {isPushing ? 'Syncing to GBP...' : 'Push to GBP'}
        </Button>
      ) : null}
    </div>
  );
}
