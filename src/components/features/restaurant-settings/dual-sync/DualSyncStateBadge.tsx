/**
 * Phase 3c of the unified dual-sync engine.
 *
 * Single-purpose state badge mapping `DualSyncFieldState` to the
 * shadcn `<Badge>` variants used by the dual-sync shell.
 */

'use client';

import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

import type { DualSyncFieldState } from '@/server/dual-sync';

export interface DualSyncStateBadgeProps {
  readonly state: DualSyncFieldState | null;
  readonly className?: string;
}

const STATE_LABELS: Record<DualSyncFieldState, string> = {
  in_sync: 'In sync',
  core_dirty: 'Core changed',
  gbp_dirty: 'Google changed',
  drifted: 'Drifted',
  conflict: 'Conflict',
  pending_import: 'Pending import',
  pending_export: 'Pending export',
  import_failed: 'Import failed',
  export_failed: 'Export failed',
  ignored: 'Ignored',
  unsupported: 'Core only',
};

const STATE_VARIANT: Record<
  DualSyncFieldState,
  'default' | 'secondary' | 'destructive' | 'outline'
> = {
  in_sync: 'secondary',
  core_dirty: 'default',
  gbp_dirty: 'default',
  drifted: 'default',
  conflict: 'destructive',
  pending_import: 'default',
  pending_export: 'default',
  import_failed: 'destructive',
  export_failed: 'destructive',
  ignored: 'outline',
  unsupported: 'outline',
};

export function DualSyncStateBadge({ state, className }: DualSyncStateBadgeProps) {
  if (!state) {
    return (
      <Badge variant="outline" className={cn('text-muted-foreground', className)}>
        Unknown
      </Badge>
    );
  }
  return (
    <Badge variant={STATE_VARIANT[state]} className={className}>
      {STATE_LABELS[state]}
    </Badge>
  );
}
