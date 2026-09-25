import { DualSyncBulkActionBar } from './DualSyncBulkActionBar';
import { buildDualSyncReviewSectionModel } from './dualSyncReviewSectionDomain';
import { DualSyncReviewSectionFields } from './DualSyncReviewSectionFields';
import { DualSyncReviewSectionHeader } from './DualSyncReviewSectionHeader';
import { type DualSyncDecisionEntry } from './dualSyncWorkspaceDecisionDomain';

import type { DualSyncDecisionAction, DualSyncSectionKey } from '@/server/dual-sync';
import type { DualSyncFieldSummary } from '@/services/ops/dual-sync';

interface DualSyncReviewSectionProps {
  readonly sectionKey: DualSyncSectionKey;
  readonly fields: ReadonlyArray<DualSyncFieldSummary>;
  readonly decisions: Readonly<Record<string, DualSyncDecisionEntry>>;
  readonly showDriftOnly: boolean;
  readonly writeBlocked: boolean;
  readonly getSectionProgress: (
    fields: ReadonlyArray<DualSyncFieldSummary>,
    decisions: Readonly<Record<string, DualSyncDecisionEntry>>,
  ) => {
    readonly needsReviewCount: number;
    readonly draftedForReviewCount: number;
    readonly draftCoveragePercent: number;
  };
  readonly onBulkSelectSection: (
    fields: ReadonlyArray<DualSyncFieldSummary>,
    action: DualSyncDecisionAction,
  ) => void;
  readonly onClearSection: (fields: ReadonlyArray<DualSyncFieldSummary>) => void;
  readonly onSelectAction: (fieldKey: string, next: DualSyncDecisionAction | null) => void;
}

/** One section of differences (Profile, Operating hours, Food menus, …) in the review step. */
export function DualSyncReviewSection({
  sectionKey,
  fields,
  decisions,
  showDriftOnly,
  writeBlocked,
  getSectionProgress,
  onBulkSelectSection,
  onClearSection,
  onSelectAction,
}: DualSyncReviewSectionProps) {
  const sectionModel = buildDualSyncReviewSectionModel({
    sectionKey,
    fields,
    decisions,
    showDriftOnly,
    sectionProgress: getSectionProgress(fields, decisions),
  });
  const headingId = `dual-sync-section-${sectionKey.replaceAll('.', '-')}`;

  return (
    <section aria-labelledby={headingId} className="flex min-w-0 flex-col">
      <div className="flex flex-col gap-2 border-y border-border/60 bg-muted/30 px-4 py-2.5 sm:px-5">
        <DualSyncReviewSectionHeader
          headingId={headingId}
          sectionState={sectionModel.sectionState}
        />
        {sectionModel.bulkSummary.importable +
          sectionModel.bulkSummary.exportable +
          sectionModel.bulkSummary.ignorable +
          sectionModel.bulkSummary.selected >
        0 ? (
          <DualSyncBulkActionBar
            fields={fields}
            writeBlocked={writeBlocked}
            bulkSummary={sectionModel.bulkSummary}
            onBulkSelectSection={onBulkSelectSection}
            onClearSection={onClearSection}
          />
        ) : null}
      </div>
      <div className="px-4 sm:px-5">
        <DualSyncReviewSectionFields
          sectionState={sectionModel.sectionState}
          rows={sectionModel.fieldRows}
          writeBlocked={writeBlocked}
          onSelectAction={onSelectAction}
        />
      </div>
    </section>
  );
}
