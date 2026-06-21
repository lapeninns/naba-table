import { AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';

import { DualSyncBulkActionBar } from './DualSyncBulkActionBar';
import { buildDualSyncReviewSectionModel } from './dualSyncReviewAccordionDomain';
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

  return (
    <AccordionItem value={sectionKey} className="border-b">
      <AccordionTrigger className="text-sm font-semibold">
        <DualSyncReviewSectionHeader sectionState={sectionModel.sectionState} />
      </AccordionTrigger>
      <AccordionContent className="pt-2">
        <div className="flex flex-col gap-2">
          <DualSyncBulkActionBar
            fields={fields}
            writeBlocked={writeBlocked}
            bulkSummary={sectionModel.bulkSummary}
            onBulkSelectSection={onBulkSelectSection}
            onClearSection={onClearSection}
          />
          <DualSyncReviewSectionFields
            sectionState={sectionModel.sectionState}
            rows={sectionModel.fieldRows}
            writeBlocked={writeBlocked}
            onSelectAction={onSelectAction}
          />
        </div>
      </AccordionContent>
    </AccordionItem>
  );
}
