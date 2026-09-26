/**
 * Phase 3k of the unified dual-sync engine.
 *
 * Recent-operations dashboard panel. Renders a compact table of the
 * latest `dual_sync_publish_operations` rows so operators can audit
 * the publish history without leaving the settings shell.
 *
 * Uses the lazy `operationsQuery` exposed by `useOpsDualSync`. Render
 * this component only when the parent shell wants the panel — keeping
 * the main shell render path cheap.
 */

'use client';

import { useMemo } from 'react';

import { DualSyncOperationsContent } from './DualSyncOperationsContent';
import { buildDualSyncOperationsPanelModel } from './dualSyncOperationsDomain';
import {
  DualSyncOperationsEmptyState,
  DualSyncOperationsErrorState,
  DualSyncOperationsLoadingState,
} from './DualSyncOperationsStates';
import { getDualSyncErrorMessage } from '../../dualSyncShellActionDomain';

import type { ListDualSyncOperationsResponse } from '@/services/ops/dual-sync';
import type { UseQueryResult } from '@tanstack/react-query';

export interface DualSyncOperationsPanelProps {
  readonly operationsQuery: UseQueryResult<ListDualSyncOperationsResponse, Error>;
  readonly className?: string;
}

export function DualSyncOperationsPanel({
  operationsQuery,
  className,
}: DualSyncOperationsPanelProps) {
  const model = useMemo(
    () => buildDualSyncOperationsPanelModel(operationsQuery.data),
    [operationsQuery.data],
  );

  if (operationsQuery.isLoading) {
    return <DualSyncOperationsLoadingState className={className} />;
  }

  if (operationsQuery.isError) {
    return (
      <DualSyncOperationsErrorState
        className={className}
        message={getDualSyncErrorMessage(
          operationsQuery.error,
          'Publish operations could not be loaded.',
        )}
        onRetry={() => operationsQuery.refetch()}
      />
    );
  }

  if (model.operations.length === 0) {
    return <DualSyncOperationsEmptyState className={className} />;
  }

  return <DualSyncOperationsContent className={className} operations={model.operations} />;
}
