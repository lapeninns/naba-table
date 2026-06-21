import type { OpsEmailDeliveryQueryDefaults } from './opsEmailDeliveryQueryDomain';
import type { EmailDeliveryTab } from './opsEmailDeliveryTypes';
import type { EmailDeliveryStatus, OpsEmailDeliveryRange } from '@/types/emailDelivery';
import type { ReadonlyURLSearchParams } from 'next/navigation';

export type OpsEmailDeliveryQueryStateParams = {
  effectiveRestaurantId: string | null;
  pathname: string | null;
  searchParams: URLSearchParams | ReadonlyURLSearchParams | null;
  initialTab: EmailDeliveryTab;
  initialRestaurantId: string | null;
  initialRange: OpsEmailDeliveryRange;
  initialPage: number;
  initialPageSize: number;
  initialStatuses: EmailDeliveryStatus[];
  initialSimulateEmailDeliveryError: boolean;
  initialFixture: string | null;
  initialQueueFixture: string | null;
  initialSimulateRetryMutationError: boolean;
  initialRecipientEmail: string | null;
  initialMessageId: string | null;
  initialBookingRef: string | null;
  initialTemplateType: string | null;
  initialEmailType: string | null;
};

export function buildOpsEmailDeliveryQueryDefaults(
  params: OpsEmailDeliveryQueryDefaults,
): OpsEmailDeliveryQueryDefaults {
  return {
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
  };
}
