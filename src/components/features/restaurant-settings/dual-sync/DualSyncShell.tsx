/**
 * Step 3 of the Google Business Profile page ("Review differences"), plus the publish results
 * and the evidence that belongs to the review workspace.
 *
 * Renders the registry-driven field summary returned by `GET /dual-sync/state`, lets the
 * operator choose Send to Google / Use Google's / Ignore per field, and hands those choices to
 * the existing publish paths unchanged. Section filtering picks which fields are in scope.
 */

'use client';

import { Accordion } from '@/components/ui/accordion';

import { DualSyncLazyPanels } from './DualSyncLazyPanels';
import { DualSyncShellReadyContent } from './DualSyncShellReadyContent';
import {
  DualSyncShellEmptyState,
  DualSyncShellErrorState,
  DualSyncShellLoadingState,
} from './DualSyncShellStateViews';
import { DualSyncSyncControls } from './DualSyncSyncControls';
import { useDualSyncShellController } from './hooks/useDualSyncShellController';

import type { DualSyncSectionKey } from '@/server/dual-sync';
import type { ReactNode } from 'react';

export interface DualSyncShellEvidence {
  /** Pause/resume and queued-publish controls. */
  readonly syncControls: ReactNode;
  /** Lazy operational panels: health, pending changes, queue recovery, publishes, operations. */
  readonly operationalPanels: ReactNode;
  /** Starts a fresh Google refresh (the same action as "Get latest from Google"). */
  readonly onRequestRefresh: () => void;
  readonly refreshPending: boolean;
}

export interface DualSyncShellProps {
  readonly restaurantId: string;
  /**
   * Optional section filter. When provided, only fields whose
   * `sectionKey` is in this list are shown. The shell still publishes
   * decisions only for visible fields.
   */
  readonly sections?: ReadonlyArray<DualSyncSectionKey>;
  /** Places the workspace evidence (for example inside "Write controls and evidence"). */
  readonly renderEvidence?: (evidence: DualSyncShellEvidence) => ReactNode;
}

export function DualSyncShell({ restaurantId, sections, renderEvidence }: DualSyncShellProps) {
  const { setShowDriftOnly, shellActions, shellViewState, showDriftOnly, workspace } =
    useDualSyncShellController({ restaurantId, sections });

  let review: ReactNode;
  if (workspace.stateQuery.isLoading) {
    review = <DualSyncShellLoadingState />;
  } else if (workspace.stateQuery.isError) {
    review = (
      <DualSyncShellErrorState
        error={workspace.stateQuery.error}
        onRetry={() => void workspace.stateQuery.refetch()}
      />
    );
  } else if (workspace.visibleFields.length === 0) {
    review = <DualSyncShellEmptyState />;
  } else {
    review = (
      <DualSyncShellReadyContent
        workspace={workspace}
        shellActions={shellActions}
        viewState={shellViewState}
        showDriftOnly={showDriftOnly}
        onShowDriftOnlyChange={setShowDriftOnly}
      />
    );
  }

  return (
    <>
      {review}
      {renderEvidence?.({
        syncControls: (
          <DualSyncSyncControls
            workspace={workspace}
            shellActions={shellActions}
            viewState={shellViewState}
          />
        ),
        operationalPanels: (
          <Accordion type="multiple" className="flex flex-col">
            <DualSyncLazyPanels workspace={workspace} />
          </Accordion>
        ),
        onRequestRefresh: shellActions.onClickRefresh,
        refreshPending: workspace.refreshMutation.isPending,
      })}
    </>
  );
}
