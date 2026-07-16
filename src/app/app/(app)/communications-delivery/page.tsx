import { CommunicationsDeliveryClient } from '@/components/features/communications-delivery';
import {
  OPS_EMAIL_DELIVERY_RANGE_VALUES,
  type OpsEmailDeliveryRange,
} from '@/types/emailDelivery';

import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Communications Delivery · Nab a Table Ops',
  description: 'Unified communications delivery overview for email, SMS, and WhatsApp.',
};

type CommunicationsDeliverySearchParams = {
  restaurantId?: string | string[];
  range?: string | string[];
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

function parseRange(raw: string | string[] | undefined): OpsEmailDeliveryRange {
  const first = firstSearchParam(raw);
  if (first && OPS_EMAIL_DELIVERY_RANGE_VALUES.includes(first as OpsEmailDeliveryRange)) {
    return first as OpsEmailDeliveryRange;
  }
  return '7d';
}

export default async function CommunicationsDeliveryPage({
  searchParams,
}: {
  searchParams?: Promise<CommunicationsDeliverySearchParams>;
}) {
  const resolved = (await searchParams) ?? {};

  return (
    <CommunicationsDeliveryClient
      initialRestaurantId={parseUuid(resolved.restaurantId)}
      initialRange={parseRange(resolved.range)}
    />
  );
}
