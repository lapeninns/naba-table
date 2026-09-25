/**
 * One difference row in the Google review step: the field, Nabatable's value, Google's value
 * and the Send to Google / Use Google's / Ignore choice that the shell aggregates into the
 * existing `decisions[]` payload.
 */

'use client';

import { Text } from '@/components/ui/typography';
import { cn } from '@/lib/utils';

import { DualSyncFieldBlockedReasons } from './DualSyncFieldBlockedReasons';
import { DualSyncFieldChoiceGroup } from './DualSyncFieldChoiceGroup';
import { buildDualSyncFieldRowModel } from './dualSyncFieldRowDomain';
import { DualSyncFieldRowHeader } from './DualSyncFieldRowHeader';
import { DualSyncFieldValuePreview } from './DualSyncFieldValuePreview';

import type { DualSyncDecisionAction } from '@/server/dual-sync';
import type { DualSyncFieldSummary } from '@/services/ops/dual-sync';

export interface DualSyncFieldRowProps {
  readonly field: DualSyncFieldSummary;
  readonly selectedAction: DualSyncDecisionAction | null;
  readonly onChangeAction: (next: DualSyncDecisionAction) => void;
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
  const reasonsId =
    model.blockedReasons.length > 0 ? `dual-sync-reasons-${field.fieldKey}` : undefined;

  return (
    <div
      data-dual-sync-field={field.fieldKey}
      className={cn(
        'grid min-w-0 gap-x-4 gap-y-3 py-3 lg:grid-cols-[minmax(0,12rem)_minmax(0,1fr)_minmax(0,1fr)_auto] lg:items-start',
        className,
      )}
    >
      <div className="flex min-w-0 flex-col gap-1">
        <DualSyncFieldRowHeader model={model} />
        <DualSyncFieldBlockedReasons id={reasonsId} reasons={model.blockedReasons} />
      </div>
      <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2 lg:contents">
        <DualSyncFieldValuePreview label="Nabatable" value={field.coreValue} />
        <DualSyncFieldValuePreview label="Google" value={field.gbpValue} />
      </div>
      {model.actionAvailability.isUnsupported ? (
        <Text variant="caption" className="lg:max-w-48">
          This field is Nabatable-only. Google has no counterpart.
        </Text>
      ) : (
        <DualSyncFieldChoiceGroup
          fieldKey={field.fieldKey}
          fieldLabel={field.label}
          availability={model.actionAvailability}
          selectedAction={selectedAction}
          disabled={disabled}
          onChangeAction={onChangeAction}
          describedBy={reasonsId}
        />
      )}
    </div>
  );
}
