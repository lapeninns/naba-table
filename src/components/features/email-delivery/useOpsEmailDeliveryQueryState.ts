'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { startTransition, useCallback, useEffect, useMemo, useState } from 'react';

import {
  buildDefaultsFromProps,
  buildOpsEmailDeliveryQueryString,
  buildOpsEmailDeliverySubmittedSearch,
  getOpsEmailDeliveryTargetPath,
  parseOpsEmailDeliveryQuery,
  toggleOpsEmailDeliveryStatusFilter,
  type OpsEmailDeliveryQueryPatch,
} from './opsEmailDeliverySelectors';
import {
  DEFAULT_OPS_EMAIL_DELIVERY_FILTER_STATE,
  type EmailDeliveryTab,
  type OpsEmailDeliveryClientProps,
  type OpsEmailDeliveryFilterState,
  type OpsEmailDeliveryRefreshOption,
  type OpsEmailDeliverySearchField,
} from './opsEmailDeliveryTypes';

import type { EmailDeliveryStatus, OpsEmailDeliveryRange } from '@/types/emailDelivery';

export function useOpsEmailDeliveryQueryState(
  props: OpsEmailDeliveryClientProps,
  effectiveRestaurantId: string | null,
) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const searchKey = useMemo(() => searchParams?.toString() ?? '', [searchParams]);
  const targetPath = useMemo(() => getOpsEmailDeliveryTargetPath(pathname), [pathname]);

  const defaults = useMemo(
    () =>
      buildDefaultsFromProps({
        initialTab: props.initialTab,
        initialRestaurantId: props.initialRestaurantId,
        initialRange: props.initialRange,
        initialPage: props.initialPage,
        initialPageSize: props.initialPageSize,
        initialStatuses: props.initialStatuses,
        initialRecipientEmail: props.initialRecipientEmail,
        initialMessageId: props.initialMessageId,
        initialBookingRef: props.initialBookingRef,
        initialTemplateType: props.initialTemplateType,
        initialEmailType: props.initialEmailType,
      }),
    [
      props.initialBookingRef,
      props.initialEmailType,
      props.initialMessageId,
      props.initialPage,
      props.initialPageSize,
      props.initialRange,
      props.initialRecipientEmail,
      props.initialRestaurantId,
      props.initialStatuses,
      props.initialTab,
      props.initialTemplateType,
    ],
  );

  const parsed = useMemo(
    () => parseOpsEmailDeliveryQuery(searchKey, defaults, props.initialRestaurantId ?? null),
    [defaults, props.initialRestaurantId, searchKey],
  );

  const [state, setState] = useState<OpsEmailDeliveryFilterState>(parsed);

  useEffect(() => {
    setState(parsed);
  }, [parsed]);

  const syncQueryParams = useCallback(
    (next: OpsEmailDeliveryQueryPatch) => {
      const nextString = buildOpsEmailDeliveryQueryString({
        current: state,
        currentSearch: searchKey,
        defaults,
        effectiveRestaurantId,
        next,
      });
      if (nextString === searchKey) return;
      startTransition(() => {
        router.replace(`${targetPath}${nextString ? `?${nextString}` : ''}`, { scroll: false });
      });
    },
    [defaults, effectiveRestaurantId, router, searchKey, state, targetPath],
  );

  const patch = useCallback(
    (next: OpsEmailDeliveryQueryPatch) => {
      setState((current) => ({ ...current, ...next }));
      syncQueryParams(next);
    },
    [syncQueryParams],
  );

  const applyRange = useCallback(
    (range: OpsEmailDeliveryRange) => patch({ range, page: 1 }),
    [patch],
  );
  const applyPage = useCallback((page: number) => patch({ page }), [patch]);
  const applyPageSize = useCallback(
    (pageSize: number) => patch({ pageSize, page: 1 }),
    [patch],
  );
  const applyRefresh = useCallback(
    (refresh: OpsEmailDeliveryRefreshOption) => patch({ refresh }),
    [patch],
  );
  const applyTemplateType = useCallback(
    (templateType: string | null) => patch({ templateType, page: 1 }),
    [patch],
  );
  const applyEmailType = useCallback(
    (emailType: string | null) => patch({ emailType, page: 1 }),
    [patch],
  );
  const handleTabChange = useCallback(
    (nextTab: string) => {
      if (nextTab !== 'delivery-log' && nextTab !== 'queue' && nextTab !== 'analytics') return;
      patch({ tab: nextTab as EmailDeliveryTab });
    },
    [patch],
  );
  const toggleStatus = useCallback(
    (status: EmailDeliveryStatus, enabled: boolean) => {
      patch({
        page: 1,
        statuses: toggleOpsEmailDeliveryStatusFilter({
          enabled,
          status,
          statuses: state.statuses,
        }),
      });
    },
    [patch, state.statuses],
  );
  const setSearchField = useCallback((searchField: OpsEmailDeliverySearchField) => {
    setState((current) =>
      current.searchField === searchField ? current : { ...current, searchField },
    );
  }, []);
  const setSearchValue = useCallback((searchValue: string) => {
    setState((current) =>
      current.searchValue === searchValue ? current : { ...current, searchValue },
    );
  }, []);
  const submitSearch = useCallback(() => {
    const next = buildOpsEmailDeliverySubmittedSearch({
      searchField: state.searchField,
      searchValue: state.searchValue,
    });
    patch(next);
  }, [patch, state.searchField, state.searchValue]);
  const clearFilters = useCallback(() => {
    const next: OpsEmailDeliveryQueryPatch = {
      range: DEFAULT_OPS_EMAIL_DELIVERY_FILTER_STATE.range,
      page: 1,
      statuses: [],
      recipientEmail: null,
      messageId: null,
      bookingRef: null,
      templateType: null,
      emailType: null,
      searchField: 'recipientEmail',
      searchValue: '',
    };
    setState((current) => ({ ...current, ...next }));
    syncQueryParams(next);
  }, [syncQueryParams]);
  const resetToDefaults = useCallback(
    (restaurantId: string | null) => {
      const next: OpsEmailDeliveryQueryPatch = {
        ...defaults,
        restaurantId,
        refresh: 'off',
      };
      setState(defaults);
      syncQueryParams(next);
    },
    [defaults, syncQueryParams],
  );

  return {
    ...state,
    parsedRestaurantId: parsed.restaurantId,
    applyRange,
    applyPage,
    applyPageSize,
    applyRefresh,
    applyTemplateType,
    applyEmailType,
    handleTabChange,
    toggleStatus,
    setSearchField,
    setSearchValue,
    submitSearch,
    clearFilters,
    resetToDefaults,
    syncQueryParams,
  };
}

export type OpsEmailDeliveryQueryState = ReturnType<typeof useOpsEmailDeliveryQueryState>;
