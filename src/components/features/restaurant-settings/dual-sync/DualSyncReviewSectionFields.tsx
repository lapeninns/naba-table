import { DualSyncFieldRow } from './DualSyncFieldRow';

import type {
  DualSyncReviewSectionFieldRowModel,
  DualSyncReviewSectionState,
} from './dualSyncReviewAccordionDomain';
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
    return <DualSyncReviewSectionEmptyState message={sectionState.emptyMessage} />;
  }

  return rows.map(({ field, selectedAction }) => (
    <DualSyncFieldRow
      key={field.fieldKey}
      field={field}
      selectedAction={selectedAction}
      onChangeAction={(next) => onSelectAction(field.fieldKey, next)}
      disabled={writeBlocked}
    />
  ));
}

function DualSyncReviewSectionEmptyState({ message }: { readonly message: string }) {
  return (
    <div className="rounded-md border border-dashed border-border/70 bg-muted/5 py-6 text-center text-xs text-muted-foreground">
      {message}
    </div>
  );
}
