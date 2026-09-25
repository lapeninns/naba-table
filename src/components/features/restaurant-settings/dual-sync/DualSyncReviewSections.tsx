import { DualSyncReviewSection } from './DualSyncReviewSection';

import type { DualSyncWorkspace } from './hooks/useDualSyncWorkspace';

interface DualSyncReviewSectionsProps {
  readonly workspace: Pick<
    DualSyncWorkspace,
    | 'orderedSectionKeys'
    | 'fieldsBySection'
    | 'decisions'
    | 'getSectionProgress'
    | 'onBulkSelectSection'
    | 'onClearSection'
    | 'onSelectAction'
  >;
  readonly showDriftOnly: boolean;
  readonly writeBlocked: boolean;
}

/**
 * Differences grouped by section. In the Differences only view, sections where Nabatable and
 * Google match are left out.
 */
export function DualSyncReviewSections({
  workspace,
  showDriftOnly,
  writeBlocked,
}: DualSyncReviewSectionsProps) {
  const sectionKeys = workspace.orderedSectionKeys.filter(
    (sectionKey) =>
      !showDriftOnly ||
      (workspace.fieldsBySection.get(sectionKey) ?? []).some((field) => field.state !== 'in_sync'),
  );

  if (sectionKeys.length === 0) {
    return (
      <p className="border-t border-border/60 px-4 py-4 text-sm text-muted-foreground sm:px-5">
        Nabatable and Google match. There is nothing to review.
      </p>
    );
  }

  return (
    <div className="flex min-w-0 flex-col">
      {sectionKeys.map((sectionKey) => (
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
    </div>
  );
}
