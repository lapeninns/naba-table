import { Accordion } from '@/components/ui/accordion';

import { DualSyncLazyPanels } from './DualSyncLazyPanels';
import { DualSyncReviewPausedAlert } from './DualSyncReviewPausedAlert';
import { DualSyncReviewSection } from './DualSyncReviewSection';

import type { useDualSyncWorkspace } from './hooks/useDualSyncWorkspace';

type DualSyncWorkspace = ReturnType<typeof useDualSyncWorkspace>;

interface DualSyncReviewAccordionProps {
  readonly workspace: DualSyncWorkspace;
  readonly showDriftOnly: boolean;
  readonly writeBlocked: boolean;
  readonly syncPaused: boolean;
  readonly pauseReason: string;
  readonly singleOpenSections: boolean;
}

export function DualSyncReviewAccordion({
  workspace,
  showDriftOnly,
  writeBlocked,
  syncPaused,
  pauseReason,
  singleOpenSections,
}: DualSyncReviewAccordionProps) {
  const reviewSections = (
    <>
      {workspace.orderedSectionKeys.map((sectionKey) => (
        <DualSyncReviewSection
          key={sectionKey}
          sectionKey={sectionKey}
          fields={workspace.fieldsBySection.get(sectionKey) ?? []}
          decisions={workspace.decisions}
          showDriftOnly={showDriftOnly}
          writeBlocked={writeBlocked}
          getSectionProgress={workspace.getSectionProgress}
          onBulkSelectSection={workspace.onBulkSelectSection}
          onClearSection={workspace.onClearSection}
          onSelectAction={workspace.onSelectAction}
        />
      ))}
      <DualSyncLazyPanels workspace={workspace} />
    </>
  );

  return (
    <>
      {syncPaused ? <DualSyncReviewPausedAlert pauseReason={pauseReason} /> : null}
      {singleOpenSections ? (
        <Accordion
          type="single"
          collapsible
          value={workspace.openSection}
          onValueChange={(value) => workspace.setOpenSection(value || undefined)}
          className="flex flex-col gap-3"
        >
          {reviewSections}
        </Accordion>
      ) : (
        <Accordion
          type="multiple"
          defaultValue={[...workspace.orderedAccordionValues]}
          className="flex flex-col gap-3"
        >
          {reviewSections}
        </Accordion>
      )}
    </>
  );
}
