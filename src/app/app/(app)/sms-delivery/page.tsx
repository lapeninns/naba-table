import { OpsSmsDeliveryClient } from '@/components/features/sms-delivery/OpsSmsDeliveryClient';
import {
  OPS_SMS_DELIVERY_RANGE_VALUES,
  SMS_DELIVERY_STATUS_VALUES,
  type OpsSmsDeliveryRange,
  type SmsDeliveryStatus,
} from '@/types/smsDelivery';

import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'SMS Delivery · Nab a Table Ops',
  description: 'Deliverability dashboard for booking SMS (Twilio).',
};

type SmsDeliverySearchParams = {
  restaurantId?: string;
  range?: string;
  page?: string;
  pageSize?: string;
  status?: string;
};

function parseUuid(raw: string | undefined): string | null {
  if (!raw) return null;
  const value = raw.trim();
  if (!value) return null;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
    ? value
    : null;
}

function parseRange(raw: string | undefined): OpsSmsDeliveryRange {
  if (raw && OPS_SMS_DELIVERY_RANGE_VALUES.includes(raw as OpsSmsDeliveryRange)) {
    return raw as OpsSmsDeliveryRange;
  }
  return '7d';
}

function parseIntParam(raw: string | undefined, fallback: number): number {
  if (!raw) return fallback;
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed)) return fallback;
  return parsed;
}

function parseStatuses(raw: string | undefined): SmsDeliveryStatus[] {
  if (!raw) return [];
  const allowed = new Set<string>(SMS_DELIVERY_STATUS_VALUES);
  const values = raw
    .split(',')
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
  return values.filter((value) => allowed.has(value)) as SmsDeliveryStatus[];
}

export default async function OpsSmsDeliveryPage({
  searchParams,
}: {
  searchParams?: Promise<SmsDeliverySearchParams>;
}) {
  const resolved = (await searchParams) ?? {};
  return (
    <OpsSmsDeliveryClient
      initialRestaurantId={parseUuid(resolved.restaurantId)}
      initialRange={parseRange(resolved.range)}
      initialPage={Math.max(1, parseIntParam(resolved.page, 1))}
      initialPageSize={Math.max(1, Math.min(200, parseIntParam(resolved.pageSize, 50)))}
      initialStatuses={parseStatuses(resolved.status)}
    />
  );
}
