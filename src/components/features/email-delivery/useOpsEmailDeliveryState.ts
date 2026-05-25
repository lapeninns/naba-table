'use client';

import { usePathname, useSearchParams } from 'next/navigation';

import { useOpsEmailDeliveryDataState } from '@/components/features/email-delivery/useOpsEmailDeliveryDataState';
import { useOpsEmailDeliveryPresentationState } from '@/components/features/email-delivery/useOpsEmailDeliveryPresentationState';
import { useOpsEmailDeliveryQueryState } from '@/components/features/email-delivery/useOpsEmailDeliveryQueryState';
import { useOpsEmailDeliveryRestaurantSelection } from '@/components/features/email-delivery/useOpsEmailDeliveryRestaurantSelection';
import { useOpsEmailDeliveryRetryState } from '@/components/features/email-delivery/useOpsEmailDeliveryRetryState';
import { useOpsServices } from '@/contexts/ops-services';
import { useOpsSession } from '@/contexts/ops-session';
import { useOpsRestaurantDetails } from '@/hooks/ops/useOpsRestaurantDetails';

import type { EmailDeliveryTab } from '@/components/features/email-delivery/opsEmailDeliveryTypes';
import type { OpsEmailDeliveryRange, EmailDeliveryStatus } from '@/types/emailDelivery';

const EMPTY_STATUSES: EmailDeliveryStatus[] = [];

export type OpsEmailDeliveryClientProps = {
  initialTab?: EmailDeliveryTab;
  initialRestaurantId?: string | null;
  initialRange?: OpsEmailDeliveryRange;
  initialPage?: number;
  initialPageSize?: number;
  initialStatuses?: EmailDeliveryStatus[];
  initialSimulateEmailDeliveryError?: boolean;
  initialFixture?: string | null;
  initialQueueFixture?: string | null;
  initialSimulateRetryMutationError?: boolean;
  initialRecipientEmail?: string | null;
  initialMessageId?: string | null;
  initialBookingRef?: string | null;
  initialTemplateType?: string | null;
  initialEmailType?: string | null;
};

export function useOpsEmailDeliveryState({
  initialTab = 'delivery-log',
  initialRestaurantId = null,
  initialRange = '7d',
  initialPage = 1,
  initialPageSize = 50,
  initialStatuses = EMPTY_STATUSES,
  initialSimulateEmailDeliveryError = false,
  initialFixture = null,
  initialQueueFixture = null,
  initialSimulateRetryMutationError = false,
  initialRecipientEmail = null,
  initialMessageId = null,
  initialBookingRef = null,
  initialTemplateType = null,
  initialEmailType = null,
}: OpsEmailDeliveryClientProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { activeRestaurantId } = useOpsSession();
  const { bookingService } = useOpsServices();

  const queryState = useOpsEmailDeliveryQueryState({
    pathname,
    searchParams,
    effectiveRestaurantId: activeRestaurantId,
    initialTab,
    initialRestaurantId,
    initialRange,
    initialPage,
    initialPageSize,
    initialStatuses,
    initialSimulateEmailDeliveryError,
    initialFixture,
    initialQueueFixture,
    initialSimulateRetryMutationError,
    initialRecipientEmail,
    initialMessageId,
    initialBookingRef,
    initialTemplateType,
    initialEmailType,
  });
  const parsedRestaurantId = queryState.parsedRestaurantId;
  const resetToDefaults = queryState.resetToDefaults;
  const { availableRestaurants, effectiveRestaurantId, handleRestaurantChange, memberships } =
    useOpsEmailDeliveryRestaurantSelection({
      parsedRestaurantId,
      resetToDefaults,
    });

  const restaurantDetails = useOpsRestaurantDetails(effectiveRestaurantId);
  const timezone = restaurantDetails.data?.timezone ?? 'UTC';

  const dataState = useOpsEmailDeliveryDataState({
    restaurantId: effectiveRestaurantId,
    activeTab: queryState.tab,
    range: queryState.range,
    page: queryState.page,
    pageSize: queryState.pageSize,
    refresh: queryState.refresh,
    statuses: queryState.statuses,
    simulateEmailDeliveryError: queryState.simulateEmailDeliveryError,
    fixture: queryState.fixture,
    recipientEmail: queryState.recipientEmail,
    messageId: queryState.messageId,
    bookingRef: queryState.bookingRef,
    templateType: queryState.templateType,
    emailType: queryState.emailType,
    timezone,
  });

  const retryState = useOpsEmailDeliveryRetryState({
    bookingService,
    rowByKey: dataState.rowByKey,
    refetch: dataState.feedQuery.refetch,
    simulateRetryMutationError: queryState.simulateRetryMutationError,
  });

  const presentationState = useOpsEmailDeliveryPresentationState({
    dataState,
    initialPageSize,
    pathname,
    queryState,
  });

  return {
    pathname,
    memberships,
    availableRestaurants,
    effectiveRestaurantId,
    timezone,
    restaurantDetails,
    queryState,
    dataState,
    retryState,
    queueRefreshState: presentationState.queueRefreshState,
    setQueueRefreshState: presentationState.setQueueRefreshState,
    manualRefreshNonce: presentationState.manualRefreshNonce,
    manualRefreshBusy: presentationState.manualRefreshBusy,
    autoRefreshActive: presentationState.autoRefreshActive,
    activeLastUpdatedAt: presentationState.activeLastUpdatedAt,
    refreshIndicatorText: presentationState.refreshIndicatorText,
    formatRefreshLabel: presentationState.formatRefreshLabel,
    handleRestaurantChange,
    handlePrev: presentationState.handlePrev,
    handleNext: presentationState.handleNext,
    pageInfo: presentationState.pageInfo,
    currentPage: presentationState.currentPage,
    currentPageSize: presentationState.currentPageSize,
    totalResults: presentationState.totalResults,
    shouldShowPagination: presentationState.shouldShowPagination,
    hasPrevPage: presentationState.hasPrevPage,
    hasNextPage: presentationState.hasNextPage,
    startResult: presentationState.startResult,
    endResult: presentationState.endResult,
    effectiveDeliveryLogErrorMessage: presentationState.effectiveDeliveryLogErrorMessage,
    shouldShowEmptyGuidance: presentationState.shouldShowEmptyGuidance,
    canInjectDeliveryLogError: presentationState.canInjectDeliveryLogError,
    handleManualRefresh: presentationState.handleManualRefresh,
    analyticsErrorMessage: presentationState.analyticsErrorMessage,
    DELIVERY_LOG_FAULT_INJECTION_MESSAGE_ID:
      presentationState.DELIVERY_LOG_FAULT_INJECTION_MESSAGE_ID,
  };
}

export type OpsEmailDeliveryState = ReturnType<typeof useOpsEmailDeliveryState>;
