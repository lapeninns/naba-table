'use client';

import { useMemo } from 'react';

import {
  buildOpsEmailDeliveryQueryDefaults,
  type OpsEmailDeliveryQueryStateParams,
} from '@/components/features/email-delivery/opsEmailDeliveryQueryDefaults';
import {
  buildOpsEmailDeliveryQueryStateSnapshot,
  parseOpsEmailDeliveryQuery,
} from '@/components/features/email-delivery/opsEmailDeliveryQueryDomain';
import { useOpsEmailDeliveryQueryActions } from '@/components/features/email-delivery/useOpsEmailDeliveryQueryActions';
import { useOpsEmailDeliveryQuerySnapshot } from '@/components/features/email-delivery/useOpsEmailDeliveryQuerySnapshot';
import { useOpsEmailDeliveryQuerySync } from '@/components/features/email-delivery/useOpsEmailDeliveryQuerySync';

export function useOpsEmailDeliveryQueryState(params: OpsEmailDeliveryQueryStateParams) {
  const searchKey = useMemo(() => params.searchParams?.toString() ?? '', [params.searchParams]);

  const queryDefaults = useMemo(
    () =>
      buildOpsEmailDeliveryQueryDefaults({
        initialBookingRef: params.initialBookingRef,
        initialEmailType: params.initialEmailType,
        initialFixture: params.initialFixture,
        initialMessageId: params.initialMessageId,
        initialPage: params.initialPage,
        initialPageSize: params.initialPageSize,
        initialQueueFixture: params.initialQueueFixture,
        initialRange: params.initialRange,
        initialRecipientEmail: params.initialRecipientEmail,
        initialRestaurantId: params.initialRestaurantId,
        initialSimulateEmailDeliveryError: params.initialSimulateEmailDeliveryError,
        initialSimulateRetryMutationError: params.initialSimulateRetryMutationError,
        initialStatuses: params.initialStatuses,
        initialTab: params.initialTab,
        initialTemplateType: params.initialTemplateType,
      }),
    [
      params.initialBookingRef,
      params.initialEmailType,
      params.initialFixture,
      params.initialMessageId,
      params.initialPage,
      params.initialPageSize,
      params.initialQueueFixture,
      params.initialRange,
      params.initialRecipientEmail,
      params.initialRestaurantId,
      params.initialSimulateEmailDeliveryError,
      params.initialSimulateRetryMutationError,
      params.initialStatuses,
      params.initialTab,
      params.initialTemplateType,
    ],
  );

  const parsedFromQuery = useMemo(
    () => parseOpsEmailDeliveryQuery(searchKey, queryDefaults),
    [queryDefaults, searchKey],
  );
  const parsedSnapshot = useMemo(
    () => buildOpsEmailDeliveryQueryStateSnapshot(parsedFromQuery),
    [parsedFromQuery],
  );
  const {
    snapshot,
    applyQueryStateSnapshot,
    patchQueryStateSnapshot,
    setSearchField,
    setSearchValue,
  } = useOpsEmailDeliveryQuerySnapshot(parsedSnapshot);

  const syncQueryParams = useOpsEmailDeliveryQuerySync({
    currentSearch: searchKey,
    effectiveRestaurantId: params.effectiveRestaurantId,
    pathname: params.pathname,
    queryDefaults,
    snapshot,
  });
  const queryActions = useOpsEmailDeliveryQueryActions({
    applyQueryStateSnapshot,
    patchQueryStateSnapshot,
    queryDefaults,
    snapshot,
    syncQueryParams,
  });

  return {
    parsedRestaurantId: parsedFromQuery.restaurantId,
    tab: snapshot.tab,
    range: snapshot.range,
    statuses: snapshot.statuses,
    page: snapshot.page,
    pageSize: snapshot.pageSize,
    refresh: snapshot.refresh,
    simulateEmailDeliveryError: snapshot.simulateEmailDeliveryError,
    simulateRetryMutationError: snapshot.simulateRetryMutationError,
    fixture: snapshot.fixture,
    queueFixture: snapshot.queueFixture,
    recipientEmail: snapshot.recipientEmail,
    messageId: snapshot.messageId,
    bookingRef: snapshot.bookingRef,
    templateType: snapshot.templateType,
    emailType: snapshot.emailType,
    searchField: snapshot.searchField,
    searchValue: snapshot.searchValue,
    setSearchField,
    setSearchValue,
    syncQueryParams,
    ...queryActions,
  };
}
