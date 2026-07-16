import {
  EmailDeliveryClient,
  type EmailDeliveryClientProps,
} from '@/components/features/communications-delivery-email/EmailDeliveryClient';
import {
  EMAIL_DELIVERY_STATUS_VALUES,
  OPS_EMAIL_DELIVERY_RANGE_VALUES,
  type EmailDeliveryStatus,
  type OpsEmailDeliveryRange,
} from '@/types/emailDelivery';

import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Communications Delivery · Email · Nab a Table Ops',
  description: 'Email delivery operations for booking emails (Resend).',
};

type EmailDeliverySearchParams = {
  tab?: string | string[];
  restaurantId?: string | string[];
  range?: string | string[];
  page?: string | string[];
  pageSize?: string | string[];
  status?: string | string[];
  recipientEmail?: string | string[];
  messageId?: string | string[];
  bookingRef?: string | string[];
  templateType?: string | string[];
  emailType?: string | string[];
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

function parseIntParam(raw: string | string[] | undefined): number | null {
  const first = firstSearchParam(raw);
  if (!first) return null;
  const parsed = Number.parseInt(first, 10);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseStatuses(raw: string | string[] | undefined): EmailDeliveryStatus[] {
  const first = firstSearchParam(raw);
  if (!first) return [];
  const allowed = new Set<string>(EMAIL_DELIVERY_STATUS_VALUES);
  return first
    .split(',')
    .map((value) => value.trim())
    .filter((value): value is EmailDeliveryStatus => allowed.has(value));
}

function parseOptionalString(raw: string | string[] | undefined): string | null {
  const first = firstSearchParam(raw);
  if (!first) return null;
  const value = first.trim();
  return value.length > 0 ? value : null;
}

function parseTab(raw: string | string[] | undefined): NonNullable<EmailDeliveryClientProps['initialTab']> {
  const first = firstSearchParam(raw);
  return first === 'queue' || first === 'analytics' ? first : 'delivery-log';
}

export default async function CommunicationsEmailDeliveryPage({
  searchParams,
}: {
  searchParams?: Promise<EmailDeliverySearchParams>;
}) {
  const resolved = (await searchParams) ?? {};

  return (
    <EmailDeliveryClient
      initialTab={parseTab(resolved.tab)}
      initialRestaurantId={parseUuid(resolved.restaurantId)}
      initialRange={parseRange(resolved.range)}
      initialPage={Math.max(1, parseIntParam(resolved.page) ?? 1)}
      initialPageSize={Math.max(1, Math.min(200, parseIntParam(resolved.pageSize) ?? 50))}
      initialStatuses={parseStatuses(resolved.status)}
      initialRecipientEmail={parseOptionalString(resolved.recipientEmail)}
      initialMessageId={parseOptionalString(resolved.messageId)}
      initialBookingRef={parseOptionalString(resolved.bookingRef)}
      initialTemplateType={parseOptionalString(resolved.templateType)}
      initialEmailType={parseOptionalString(resolved.emailType)}
    />
  );
}
