export { OpsSmsDeliveryClient as MessageDeliveryClient } from '@/components/features/sms-delivery/OpsSmsDeliveryClient';

export type MessageDeliveryClientProps = {
  initialRestaurantId?: string | null;
  initialRange?: '24h' | '7d' | '30d';
  initialPage?: number;
  initialPageSize?: number;
  initialStatuses?: Array<'queued' | 'sent' | 'delivered' | 'undelivered' | 'failed'>;
  initialChannel?: 'all' | 'whatsapp' | 'sms';
};
