import { Text } from '@/components/ui/typography';

import { DualSyncFieldActionToggle } from './DualSyncFieldActionToggle';
import { DualSyncFieldValuePreview } from './DualSyncFieldValuePreview';

import type { DualSyncFieldActionAvailability } from './dualSyncFieldRowDomain';
import type { DualSyncDecisionAction } from '@/server/dual-sync';
import type { DualSyncFieldSummary } from '@/services/ops/dual-sync';

export function DualSyncFieldRowContent({
  actionAvailability,
  disabled,
  field,
  onChangeAction,
  selectedAction,
}: {
  readonly actionAvailability: DualSyncFieldActionAvailability;
  readonly disabled: boolean;
  readonly field: DualSyncFieldSummary;
  readonly onChangeAction: (next: DualSyncDecisionAction | null) => void;
  readonly selectedAction: DualSyncDecisionAction | null;
}) {
  return (
    <>
      <div className="grid gap-3 text-sm md:grid-cols-2">
        <DualSyncFieldValuePreview label="Nabatable" value={field.coreValue} />
        <DualSyncFieldValuePreview label="Google" value={field.gbpValue} />
      </div>

      {actionAvailability.isUnsupported ? (
        <Text variant="caption">
          This field is Nabatable-only. Google has no counterpart.
        </Text>
      ) : (
        <DualSyncFieldActionToggle
          availability={actionAvailability}
          selectedAction={selectedAction}
          disabled={disabled}
          onChangeAction={onChangeAction}
        />
      )}
    </>
  );
}
