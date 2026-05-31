import {
  OpsEmailDeliveryClient,
  type EmailDeliveryTab,
} from '@/components/features/email-delivery/OpsEmailDeliveryClient';
import {
  EMAIL_DELIVERY_STATUS_VALUES,
  OPS_EMAIL_DELIVERY_RANGE_VALUES,
  type EmailDeliveryStatus,
  type OpsEmailDeliveryRange,
} from '@/types/emailDelivery';

import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Email Delivery · Nab a Table Ops',
  description: 'Deliverability dashboard for booking emails (Resend).',
};

type EmailDeliverySearchParams = {
  tab?: string | string[];
  restaurantId?: string | string[];
  range?: string | string[];
  page?: string | string[];
  pageSize?: string | string[];
  status?: string | string[];
  fixture?: string | string[];
  queueFixture?: string | string[];
  simulateEmailDeliveryError?: string | string[];
  simulateRetryMutationError?: string | string[];
  recipientEmail?: string | string[];
  messageId?: string | string[];
  bookingRef?: string | string[];
  templateType?: string | string[];
  emailType?: string | string[];
};

const RANGE_VALUES = OPS_EMAIL_DELIVERY_RANGE_VALUES;
const STATUS_VALUES = EMAIL_DELIVERY_STATUS_VALUES;

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
  if (first && RANGE_VALUES.includes(first as OpsEmailDeliveryRange)) {
    return first as OpsEmailDeliveryRange;
  }
  return '7d';
}

function parseIntParam(raw: string | string[] | undefined): number | null {
  const first = firstSearchParam(raw);
  if (!first) return null;
  const parsed = Number.parseInt(first, 10);
  if (!Number.isFinite(parsed)) return null;
  return parsed;
}

function parseStatuses(raw: string | string[] | undefined): EmailDeliveryStatus[] {
  const first = firstSearchParam(raw);
  if (!first) return [];
  const allowed = new Set<string>(STATUS_VALUES);
  const parts = first
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

function parseOptionalString(raw: string | string[] | undefined): string | null {
  const first = firstSearchParam(raw);
  if (!first) return null;
  const value = first.trim();
  return value.length > 0 ? value : null;
}

const VALID_TABS: readonly string[] = ['delivery-log', 'queue', 'analytics'];

function parseTab(raw: string | string[] | undefined): EmailDeliveryTab {
  const first = firstSearchParam(raw);
  if (first && VALID_TABS.includes(first)) {
    return first as EmailDeliveryTab;
  }
  return 'delivery-log';
}

export default async function OpsEmailDeliveryPage({
  searchParams,
}: {
  searchParams?: Promise<EmailDeliverySearchParams>;
}) {
  const resolved = (await searchParams) ?? {};

  const initialTab = parseTab(resolved.tab);
  const initialRestaurantId = parseUuid(resolved.restaurantId);
  const initialRange = parseRange(resolved.range);
  const initialPage = Math.max(1, parseIntParam(resolved.page) ?? 1);
  const initialPageSize = Math.max(1, Math.min(200, parseIntParam(resolved.pageSize) ?? 50));
  const initialStatuses = parseStatuses(resolved.status);

  return (
    <OpsEmailDeliveryClient
      initialTab={initialTab}
      initialRestaurantId={initialRestaurantId}
      initialRange={initialRange}
      initialPage={initialPage}
      initialPageSize={initialPageSize}
      initialStatuses={initialStatuses}
      initialFixture={parseOptionalString(resolved.fixture)}
      initialQueueFixture={parseOptionalString(resolved.queueFixture)}
      initialRecipientEmail={parseOptionalString(resolved.recipientEmail)}
      initialSimulateEmailDeliveryError={
        firstSearchParam(resolved.simulateEmailDeliveryError) === '1'
      }
      initialSimulateRetryMutationError={
        firstSearchParam(resolved.simulateRetryMutationError) === '1'
      }
      initialMessageId={parseOptionalString(resolved.messageId)}
      initialBookingRef={parseOptionalString(resolved.bookingRef)}
      initialTemplateType={parseOptionalString(resolved.templateType)}
      initialEmailType={parseOptionalString(resolved.emailType)}
    />
  );
}
