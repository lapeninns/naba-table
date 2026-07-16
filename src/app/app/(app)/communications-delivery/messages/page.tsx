import { MessageDeliveryClient } from '@/components/features/communications-delivery-messages/MessageDeliveryClient';
import {
  OPS_SMS_DELIVERY_CHANNEL_VALUES,
  OPS_SMS_DELIVERY_RANGE_VALUES,
  SMS_DELIVERY_STATUS_VALUES,
  type OpsSmsDeliveryRange,
  type SmsDeliveryChannelFilter,
  type SmsDeliveryStatus,
} from '@/types/smsDelivery';

import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Communications Delivery · Messages · Nab a Table Ops',
  description: 'SMS and WhatsApp delivery operations for booking communications.',
};

type MessageDeliverySearchParams = {
  restaurantId?: string | string[];
  range?: string | string[];
  page?: string | string[];
  pageSize?: string | string[];
  status?: string | string[];
  channel?: string | string[];
};

function firstSearchParam(raw: string | string[] | undefined): string | undefined {
  return Array.isArray(raw) ? raw[0] : raw;
}

function parseUuid(raw: string | string[] | undefined): string | null {
  const first = firstSearchParam(raw);
  if (!first) return null;
  const value = first.trim();
  if (!value) return null;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
    ? value
    : null;
}

function parseRange(raw: string | string[] | undefined): OpsSmsDeliveryRange {
  const first = firstSearchParam(raw);
  if (first && OPS_SMS_DELIVERY_RANGE_VALUES.includes(first as OpsSmsDeliveryRange)) {
    return first as OpsSmsDeliveryRange;
  }
  return '7d';
}

function parseChannel(raw: string | string[] | undefined): SmsDeliveryChannelFilter {
  const first = firstSearchParam(raw);
  if (first && OPS_SMS_DELIVERY_CHANNEL_VALUES.includes(first as SmsDeliveryChannelFilter)) {
    return first as SmsDeliveryChannelFilter;
  }
  return 'all';
}

function parseIntParam(raw: string | string[] | undefined, fallback: number): number {
  const first = firstSearchParam(raw);
  if (!first) return fallback;
  const parsed = Number.parseInt(first, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function parseStatuses(raw: string | string[] | undefined): SmsDeliveryStatus[] {
  const first = firstSearchParam(raw);
  if (!first) return [];
  const allowed = new Set<string>(SMS_DELIVERY_STATUS_VALUES);
  return first
    .split(',')
    .map((part) => part.trim())
    .filter((part): part is SmsDeliveryStatus => allowed.has(part));
}

export default async function CommunicationsMessageDeliveryPage({
  searchParams,
}: {
  searchParams?: Promise<MessageDeliverySearchParams>;
}) {
  const resolved = (await searchParams) ?? {};

  return (
    <MessageDeliveryClient
      initialRestaurantId={parseUuid(resolved.restaurantId)}
      initialRange={parseRange(resolved.range)}
      initialPage={Math.max(1, parseIntParam(resolved.page, 1))}
      initialPageSize={Math.max(1, Math.min(200, parseIntParam(resolved.pageSize, 50)))}
      initialStatuses={parseStatuses(resolved.status)}
      initialChannel={parseChannel(resolved.channel)}
    />
  );
}
