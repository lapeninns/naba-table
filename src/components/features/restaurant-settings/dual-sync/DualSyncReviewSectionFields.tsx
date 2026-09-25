import { DualSyncFieldRow } from './DualSyncFieldRow';

import type {
  DualSyncReviewSectionFieldRowModel,
  DualSyncReviewSectionState,
} from './dualSyncReviewSectionDomain';
import type { DualSyncDecisionAction } from '@/server/dual-sync';

interface DualSyncReviewSectionFieldsProps {
  readonly sectionState: DualSyncReviewSectionState;
  readonly rows: ReadonlyArray<DualSyncReviewSectionFieldRowModel>;
  readonly writeBlocked: boolean;
  readonly onSelectAction: (fieldKey: string, next: DualSyncDecisionAction | null) => void;
}

export function DualSyncReviewSectionFields({
  sectionState,
  rows,
  writeBlocked,
  onSelectAction,
}: DualSyncReviewSectionFieldsProps) {
  if (rows.length === 0) {
    return <p className="py-2 text-sm text-muted-foreground">{sectionState.emptyMessage}</p>;
  }

  return (
    <div className="flex flex-col divide-y divide-border/60">
      {rows.map(({ field, selectedAction }) => (
        <DualSyncFieldRow
          key={field.fieldKey}
          field={field}
          selectedAction={selectedAction}
          onChangeAction={(next) => onSelectAction(field.fieldKey, next)}
          disabled={writeBlocked}
        />
      ))}
    </div>
  );
}
