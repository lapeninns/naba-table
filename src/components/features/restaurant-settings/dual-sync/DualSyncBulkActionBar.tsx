import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/typography';

import {
  buildDualSyncBulkActionIntent,
  buildDualSyncBulkActionButtons,
  type DualSyncBulkActionButtonModel,
} from './dualSyncBulkActionBarDomain';

import type { DualSyncSectionBulkSummary } from './dualSyncWorkspaceDecisionDomain';
import type { DualSyncDecisionAction } from '@/server/dual-sync';
import type { DualSyncFieldSummary } from '@/services/ops/dual-sync';

interface DualSyncBulkActionBarProps {
  readonly fields: ReadonlyArray<DualSyncFieldSummary>;
  readonly writeBlocked: boolean;
  readonly bulkSummary: DualSyncSectionBulkSummary;
  readonly onBulkSelectSection: (
    fields: ReadonlyArray<DualSyncFieldSummary>,
    action: DualSyncDecisionAction,
  ) => void;
  readonly onClearSection: (fields: ReadonlyArray<DualSyncFieldSummary>) => void;
}

export function DualSyncBulkActionBar({
  fields,
  writeBlocked,
  bulkSummary,
  onBulkSelectSection,
  onClearSection,
}: DualSyncBulkActionBarProps) {
  if (fields.length === 0) {
    return null;
  }

  const actionButtons = buildDualSyncBulkActionButtons({ bulkSummary, writeBlocked });

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border/60 bg-muted/30 px-3 py-2">
      <div className="flex flex-col gap-0.5">
        <Text variant="eyebrow" className="text-foreground">
          Bulk select
        </Text>
        <Text variant="caption">
          Apply one draft action to fields in this section that need an operator choice. In-sync
          rows are left unchanged.
        </Text>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {actionButtons.map((button) => (
          <Button
            key={button.id}
            type="button"
            variant={button.variant}
            size="sm"
            onClick={() =>
              handleDualSyncBulkActionButtonClick({
                button,
                fields,
                onBulkSelectSection,
                onClearSection,
              })
            }
            disabled={button.disabled}
            aria-disabled={button.disabled}
          >
            {button.label} ({button.count})
          </Button>
        ))}
      </div>
    </div>
  );
}

function handleDualSyncBulkActionButtonClick({
  button,
  fields,
  onBulkSelectSection,
  onClearSection,
}: {
  readonly button: DualSyncBulkActionButtonModel;
  readonly fields: ReadonlyArray<DualSyncFieldSummary>;
  readonly onBulkSelectSection: (
    fields: ReadonlyArray<DualSyncFieldSummary>,
    action: DualSyncDecisionAction,
  ) => void;
  readonly onClearSection: (fields: ReadonlyArray<DualSyncFieldSummary>) => void;
}) {
  const intent = buildDualSyncBulkActionIntent(button.id);

  if (intent.kind === 'select') {
    onBulkSelectSection(fields, intent.action);
    return;
  }

  onClearSection(fields);
}
