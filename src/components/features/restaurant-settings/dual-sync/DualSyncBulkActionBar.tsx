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
    <div
      role="group"
      aria-label="Choose for every field in this section that differs"
      className="flex flex-wrap items-center gap-2"
    >
      <Text variant="caption" as="span">
        Whole section:
      </Text>
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
          className="[@media(pointer:coarse)]:min-h-11"
        >
          {button.label} ({button.count})
        </Button>
      ))}
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
