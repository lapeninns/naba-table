/**
 * Phase 3c of the unified dual-sync engine.
 *
 * Per-field row for the dual-sync workspace. Renders the label, state
 * badge, side-by-side Core vs Google preview, and an action picker that
 * the parent shell aggregates into a `decisions[]` payload for publish.
 */

'use client';

import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

import { DualSyncFieldBlockedReasons } from './DualSyncFieldBlockedReasons';
import { DualSyncFieldRowContent } from './DualSyncFieldRowContent';
import { buildDualSyncFieldRowModel } from './dualSyncFieldRowDomain';
import { DualSyncFieldRowHeader } from './DualSyncFieldRowHeader';

import type { DualSyncDecisionAction } from '@/server/dual-sync';
import type { DualSyncFieldSummary } from '@/services/ops/dual-sync';

export interface DualSyncFieldRowProps {
  readonly field: DualSyncFieldSummary;
  readonly selectedAction: DualSyncDecisionAction | null;
  readonly onChangeAction: (next: DualSyncDecisionAction | null) => void;
  readonly disabled?: boolean;
  readonly className?: string;
}

export function DualSyncFieldRow({
  field,
  selectedAction,
  onChangeAction,
  disabled = false,
  className,
}: DualSyncFieldRowProps) {
  const model = buildDualSyncFieldRowModel(field);

  return (
    <Card className={cn('border-border/60', className)}>
      <CardContent className="flex flex-col gap-3 px-4 py-3">
        <DualSyncFieldRowHeader model={model} />
        <DualSyncFieldRowContent
          actionAvailability={model.actionAvailability}
          disabled={disabled}
          field={field}
          onChangeAction={onChangeAction}
          selectedAction={selectedAction}
        />
        <DualSyncFieldBlockedReasons reasons={model.blockedReasons} />
      </CardContent>
    </Card>
  );
}
