'use client';

import { useCallback } from 'react';

import {
  buildOpsEmailDeliveryClearFiltersNext,
  buildOpsEmailDeliveryClearFiltersStateSnapshot,
  buildOpsEmailDeliveryDefaultsStateSnapshot,
  buildOpsEmailDeliveryResetNext,
  buildOpsEmailDeliverySubmittedSearch,
  toggleOpsEmailDeliveryStatusFilter,
  type OpsEmailDeliveryQueryDefaults,
  type OpsEmailDeliveryQueryStateSnapshot,
  type OpsEmailDeliveryQuerySyncNext,
} from './opsEmailDeliveryQueryDomain';

import type { EmailDeliveryTab } from './opsEmailDeliveryTypes';
import type { EmailDeliveryStatus, OpsEmailDeliveryRange } from '@/types/emailDelivery';

type ApplyQueryStateSnapshot = (snapshot: OpsEmailDeliveryQueryStateSnapshot) => void;
type PatchQueryStateSnapshot = (patch: Partial<OpsEmailDeliveryQueryStateSnapshot>) => void;
type SyncQueryParams = (next: OpsEmailDeliveryQuerySyncNext) => void;

export type UseOpsEmailDeliveryQueryActionsParams = {
  applyQueryStateSnapshot: ApplyQueryStateSnapshot;
  patchQueryStateSnapshot: PatchQueryStateSnapshot;
  queryDefaults: OpsEmailDeliveryQueryDefaults;
  snapshot: OpsEmailDeliveryQueryStateSnapshot;
  syncQueryParams: SyncQueryParams;
};

export function useOpsEmailDeliveryQueryActions({
  applyQueryStateSnapshot,
  patchQueryStateSnapshot,
  queryDefaults,
  snapshot,
  syncQueryParams,
}: UseOpsEmailDeliveryQueryActionsParams) {
  const resetToDefaults = useCallback(
    (restaurantId: string | null) => {
      const next = buildOpsEmailDeliveryResetNext({
        defaults: queryDefaults,
        restaurantId,
      });
      const nextSnapshot = buildOpsEmailDeliveryDefaultsStateSnapshot(queryDefaults);

      applyQueryStateSnapshot(nextSnapshot);
      syncQueryParams(next);
    },
    [applyQueryStateSnapshot, queryDefaults, syncQueryParams],
  );

  const applyRange = useCallback(
    (nextRange: OpsEmailDeliveryRange) => {
      patchQueryStateSnapshot({ page: 1, range: nextRange });
      syncQueryParams({ page: 1, range: nextRange });
    },
    [patchQueryStateSnapshot, syncQueryParams],
  );

  const applyTemplateType = useCallback(
    (nextTemplateType: string | null) => {
      patchQueryStateSnapshot({ page: 1, templateType: nextTemplateType });
      syncQueryParams({ page: 1, templateType: nextTemplateType });
    },
    [patchQueryStateSnapshot, syncQueryParams],
  );

  const applyEmailType = useCallback(
    (nextEmailType: string | null) => {
      patchQueryStateSnapshot({ emailType: nextEmailType, page: 1 });
      syncQueryParams({ emailType: nextEmailType, page: 1 });
    },
    [patchQueryStateSnapshot, syncQueryParams],
  );

  const applyRefresh = useCallback(
    (nextRefresh: OpsEmailDeliveryQueryStateSnapshot['refresh']) => {
      patchQueryStateSnapshot({ refresh: nextRefresh });
      syncQueryParams({ refresh: nextRefresh });
    },
    [patchQueryStateSnapshot, syncQueryParams],
  );

  const submitSearch = useCallback(() => {
    const next = buildOpsEmailDeliverySubmittedSearch({
      searchField: snapshot.searchField,
      searchValue: snapshot.searchValue,
    });

    patchQueryStateSnapshot({
      bookingRef: next.bookingRef ?? null,
      messageId: next.messageId ?? null,
      page: next.page ?? 1,
      recipientEmail: next.recipientEmail ?? null,
    });

    syncQueryParams(next);
  }, [patchQueryStateSnapshot, snapshot.searchField, snapshot.searchValue, syncQueryParams]);

  const toggleStatus = useCallback(
    (status: EmailDeliveryStatus, enabled: boolean) => {
      const next = toggleOpsEmailDeliveryStatusFilter({
        enabled,
        status,
        statuses: snapshot.statuses,
      });

      patchQueryStateSnapshot({ page: 1, statuses: next });
      syncQueryParams({ page: 1, statuses: next });
    },
    [patchQueryStateSnapshot, snapshot.statuses, syncQueryParams],
  );

  const clearFilters = useCallback(() => {
    const next = buildOpsEmailDeliveryClearFiltersNext();
    const nextSnapshot = buildOpsEmailDeliveryClearFiltersStateSnapshot(snapshot);

    applyQueryStateSnapshot(nextSnapshot);
    syncQueryParams(next);
  }, [applyQueryStateSnapshot, snapshot, syncQueryParams]);

  const applyPage = useCallback(
    (nextPage: number) => {
      patchQueryStateSnapshot({ page: nextPage });
      syncQueryParams({ page: nextPage });
    },
    [patchQueryStateSnapshot, syncQueryParams],
  );

  const applyPageSize = useCallback(
    (nextPageSize: number) => {
      patchQueryStateSnapshot({ page: 1, pageSize: nextPageSize });
      syncQueryParams({ page: 1, pageSize: nextPageSize });
    },
    [patchQueryStateSnapshot, syncQueryParams],
  );

  const handleTabChange = useCallback(
    (nextTab: string) => {
      if (nextTab !== 'delivery-log' && nextTab !== 'queue' && nextTab !== 'analytics') {
        return;
      }

      const typedTab = nextTab as EmailDeliveryTab;
      patchQueryStateSnapshot({ tab: typedTab });
      syncQueryParams({ tab: typedTab });
    },
    [patchQueryStateSnapshot, syncQueryParams],
  );

  return {
    applyEmailType,
    applyPage,
    applyPageSize,
    applyRange,
    applyRefresh,
    applyTemplateType,
    clearFilters,
    handleTabChange,
    resetToDefaults,
    submitSearch,
    toggleStatus,
  };
}
