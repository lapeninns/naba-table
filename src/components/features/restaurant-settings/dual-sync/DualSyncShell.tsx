/**
 * Phase 3c of the unified dual-sync engine.
 *
 * Restaurant-settings dual-sync workspace. Renders the registry-driven
 * field summary returned by `GET /dual-sync/state`, lets the operator
 * pick a per-field action (import / export / ignore), and submits the
 * decision set to `POST /dual-sync/publish`.
 *
 * The shell is intentionally provider-agnostic: it only knows about the
 * field summary contract from `services/ops/dual-sync.ts`. Section
 * filtering lets the same component be reused inside the three settings
 * pages (profile, availability, GBP) by passing the relevant section
 * keys.
 */

'use client';

import { DualSyncShellReadyContent } from './DualSyncShellReadyContent';
import {
  DualSyncShellEmptyState,
  DualSyncShellErrorState,
  DualSyncShellLoadingState,
} from './DualSyncShellStateViews';
import { useDualSyncShellController } from './hooks/useDualSyncShellController';

import type { DualSyncSectionKey } from '@/server/dual-sync';

export interface DualSyncShellProps {
  readonly restaurantId: string;
  /**
   * Optional section filter. When provided, only fields whose
   * `sectionKey` is in this list are shown. The shell still publishes
   * decisions only for visible fields.
   */
  readonly sections?: ReadonlyArray<DualSyncSectionKey>;
  readonly className?: string;
  readonly singleOpenSections?: boolean;
}

export function DualSyncShell({
  restaurantId,
  sections,
  className,
  singleOpenSections = false,
}: DualSyncShellProps) {
  const { onToggleDriftOnly, shellActions, shellViewState, showDriftOnly, workspace } =
    useDualSyncShellController({
      restaurantId,
      sections,
      singleOpenSections,
    });

  if (workspace.stateQuery.isLoading) {
    return <DualSyncShellLoadingState className={className} />;
  }

  if (workspace.stateQuery.isError) {
    return <DualSyncShellErrorState className={className} error={workspace.stateQuery.error} />;
  }

  if (workspace.visibleFields.length === 0) {
    return <DualSyncShellEmptyState className={className} />;
  }

  return (
    <DualSyncShellReadyContent
      className={className}
      workspace={workspace}
      shellActions={shellActions}
      viewState={shellViewState}
      showDriftOnly={showDriftOnly}
      onToggleDriftOnly={onToggleDriftOnly}
      singleOpenSections={singleOpenSections}
    />
  );
}
