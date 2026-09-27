'use client';

import { CommunicationsDeliveryHeader } from '@/components/features/communications-delivery/components/CommunicationsDeliveryHeader';

import type { CommunicationsDeliveryHeaderProps } from '@/components/features/communications-delivery/components/CommunicationsDeliveryHeader';

export type OpsEmailDeliveryHeaderMetaProps = CommunicationsDeliveryHeaderProps;

/** Email uses the shared Communications Delivery restaurant + timezone meta. */
export function OpsEmailDeliveryHeaderMeta(props: OpsEmailDeliveryHeaderMetaProps) {
  return <CommunicationsDeliveryHeader {...props} />;
}
