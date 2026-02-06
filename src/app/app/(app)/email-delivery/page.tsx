import { OpsEmailDeliveryClient } from '@/components/features/email-delivery/OpsEmailDeliveryClient';
import {
  EMAIL_DELIVERY_STATUS_VALUES,
  OPS_EMAIL_DELIVERY_RANGE_VALUES,
  type EmailDeliveryStatus,
  type OpsEmailDeliveryRange,
} from '@/types/emailDelivery';

import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Email Delivery · Nab a Table Ops',
  description: 'Track sent/delivered/bounced email status for recent booking emails.',
};

type EmailDeliverySearchParams = {
  restaurantId?: string;
  range?: string;
  page?: string;
  pageSize?: string;
  status?: string;
  recipientEmail?: string;
  messageId?: string;
  bookingRef?: string;
  templateType?: string;
  emailType?: string;
};

const RANGE_VALUES = OPS_EMAIL_DELIVERY_RANGE_VALUES;
const STATUS_VALUES = EMAIL_DELIVERY_STATUS_VALUES;

function parseUuid(raw: string | undefined): string | null {
  if (!raw) return null;
  const value = raw.trim();
  if (!value) return null;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
    ? value
    : null;
}

function parseRange(raw: string | undefined): OpsEmailDeliveryRange {
  if (raw && RANGE_VALUES.includes(raw as OpsEmailDeliveryRange)) {
    return raw as OpsEmailDeliveryRange;
  }
  return '7d';
}

function parseIntParam(raw: string | undefined): number | null {
  if (!raw) return null;
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed)) return null;
  return parsed;
}

function parseStatuses(raw: string | undefined): EmailDeliveryStatus[] {
  if (!raw) return [];
  const allowed = new Set<string>(STATUS_VALUES);
  const parts = raw
    .split(',')
    .map((value) => value.trim())
    .filter((value) => value.length > 0);

  const out: EmailDeliveryStatus[] = [];
  for (const part of parts) {
    if (allowed.has(part)) {
      out.push(part as EmailDeliveryStatus);
    }
  }
  return out;
}

function parseOptionalString(raw: string | undefined): string | null {
  if (!raw) return null;
  const value = raw.trim();
  return value.length > 0 ? value : null;
}

export default async function OpsEmailDeliveryPage({
  searchParams,
}: {
  searchParams?: Promise<EmailDeliverySearchParams>;
}) {
  const resolved = (await searchParams) ?? {};

  const initialRestaurantId = parseUuid(resolved.restaurantId);
  const initialRange = parseRange(resolved.range);
  const initialPage = Math.max(1, parseIntParam(resolved.page) ?? 1);
  const initialPageSize = Math.max(1, Math.min(200, parseIntParam(resolved.pageSize) ?? 50));
  const initialStatuses = parseStatuses(resolved.status);

  return (
    <OpsEmailDeliveryClient
      initialRestaurantId={initialRestaurantId}
      initialRange={initialRange}
      initialPage={initialPage}
      initialPageSize={initialPageSize}
      initialStatuses={initialStatuses}
      initialRecipientEmail={parseOptionalString(resolved.recipientEmail)}
      initialMessageId={parseOptionalString(resolved.messageId)}
      initialBookingRef={parseOptionalString(resolved.bookingRef)}
      initialTemplateType={parseOptionalString(resolved.templateType)}
      initialEmailType={parseOptionalString(resolved.emailType)}
    />
  );
}
