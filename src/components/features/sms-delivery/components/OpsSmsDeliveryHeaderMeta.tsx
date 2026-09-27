'use client';

import { CommunicationsDeliveryHeader } from '@/components/features/communications-delivery/components/CommunicationsDeliveryHeader';

import type { CommunicationsDeliveryHeaderProps } from '@/components/features/communications-delivery/components/CommunicationsDeliveryHeader';

export type SmsDeliveryRestaurantOption =
  CommunicationsDeliveryHeaderProps['availableRestaurants'][number];

export type OpsSmsDeliveryHeaderMetaProps = CommunicationsDeliveryHeaderProps;

/** Messages uses the shared Communications Delivery restaurant + timezone meta. */
export function OpsSmsDeliveryHeaderMeta(props: OpsSmsDeliveryHeaderMetaProps) {
  return <CommunicationsDeliveryHeader {...props} />;
}

export default OpsSmsDeliveryHeaderMeta;
