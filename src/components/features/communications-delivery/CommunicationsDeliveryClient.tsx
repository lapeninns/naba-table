'use client';

import { MailCheck, MessageSquareMore, RefreshCw } from 'lucide-react';
import Link from 'next/link';

import {
  OPS_CARD_CLASS,
  OPS_CARD_CONTENT_CLASS,
  OPS_CARD_HEADER_CLASS,
  OPS_PAGE_RHYTHM_CLASS,
} from '@/components/features/ops-shell/patterns/opsDensityClasses';
import { OpsEmptyState } from '@/components/features/ops-shell/patterns/OpsEmptyState';
import { OpsPageHeader } from '@/components/features/ops-shell/patterns/OpsPageHeader';
import { OpsPageShell } from '@/components/features/ops-shell/patterns/OpsPageShell';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { opsHref } from '@/lib/url/opsHref';
import { cn } from '@/lib/utils';

import { buildCommunicationsOverviewMetrics } from './communicationsDeliverySelectors';
import {
  COMMS_CONTROL_HEIGHT_CLASS,
  CommunicationsDeliveryChannelTabs,
  CommunicationsDeliveryHeader,
  CommunicationsDeliveryMetricGrid,
} from './components';
import {
  CommunicationsDeliveryBreakdown,
  type DeliveryBreakdownSegment,
} from './components/CommunicationsDeliveryBreakdown';
import { CommunicationsDeliveryRangeSelect } from './components/CommunicationsDeliveryRangeSelect';
import { useCommunicationsDeliveryOverviewState } from './useCommunicationsDeliveryOverviewState';
import { useCommunicationsDeliveryQueryState } from './useCommunicationsDeliveryQueryState';

import type { ReactNode } from 'react';

export type CommunicationsDeliveryClientProps = {
  initialRestaurantId?: string | null;
  initialRange?: '24h' | '7d' | '30d';
};

export function CommunicationsDeliveryClient({
  initialRestaurantId = null,
  initialRange = '7d',
}: CommunicationsDeliveryClientProps) {
  const queryState = useCommunicationsDeliveryQueryState(initialRestaurantId, initialRange);
  const state = useCommunicationsDeliveryOverviewState({
    restaurantId: queryState.restaurantId,
    range: queryState.range,
    onRestaurantIdChange: queryState.setRestaurantId,
  });

  if (state.memberships.length === 0) {
    return (
      <OpsPageShell variant="standard" className={OPS_PAGE_RHYTHM_CLASS}>
        <section className="mx-auto flex min-h-[60vh] max-w-2xl items-center justify-center">
          <OpsEmptyState
            title="No restaurant access yet"
            description="Ask an owner or manager to send you an invitation so you can manage bookings."
            action={
              <Button asChild variant="secondary">
                <Link href={opsHref('/dashboard')} prefetch={false}>
                  Return to ops home
                </Link>
              </Button>
            }
          />
        </section>
      </OpsPageShell>
    );
  }

  const metrics = buildCommunicationsOverviewMetrics({
    emailSummary: state.emailSummaryQuery.summary,
    messageSummary: state.messageFeedQuery.feed?.summary ?? null,
  });

  const isLoading =
    state.emailSummaryQuery.isLoading || state.messageFeedQuery.isLoading || !state.restaurantId;
  const email = state.emailSummaryQuery.summary;
  const messages = state.messageFeedQuery.feed?.summary;
  const failedChannels = [
    state.emailSummaryQuery.isError ||
    state.emailSummaryQuery.unavailable ||
    state.emailSummaryQuery.apiError
      ? 'Email'
      : null,
    state.messageFeedQuery.isError ||
    state.messageFeedQuery.unavailable ||
    state.messageFeedQuery.apiError
      ? 'Messages'
      : null,
  ].filter(Boolean);
  const isRefreshing = state.emailSummaryQuery.isFetching || state.messageFeedQuery.isFetching;
  const refresh = () =>
    Promise.all([state.emailSummaryQuery.refetch(), state.messageFeedQuery.refetch()]);
  const context = new URLSearchParams({
    restaurantId: state.restaurantId ?? '',
    range: queryState.range,
  });

  return (
    <OpsPageShell variant="standard" className={OPS_PAGE_RHYTHM_CLASS}>
      <OpsPageHeader
        title="Communications Delivery"
        subtitle="One place to monitor email, SMS, and WhatsApp health while keeping channel-specific workflows separate."
        secondaryActions={
          <>
            <CommunicationsDeliveryRangeSelect
              value={queryState.range}
              onChange={queryState.setRange}
            />
            <Button
              variant="outline"
              className={COMMS_CONTROL_HEIGHT_CLASS}
              disabled={isRefreshing}
              onClick={() => void refresh()}
            >
              <RefreshCw aria-hidden className="size-4" />
              {isRefreshing ? 'Refreshing' : 'Refresh'}
            </Button>
          </>
        }
        meta={
          <CommunicationsDeliveryHeader
            availableRestaurants={state.availableRestaurants}
            restaurantId={state.restaurantId}
            currentRestaurantName={state.restaurantDetails.data?.name ?? null}
            timezone={state.timezone}
            onRestaurantChange={queryState.setRestaurantId}
          />
        }
      />

      <CommunicationsDeliveryChannelTabs active="overview" />

      {failedChannels.length ? (
        <Alert variant="warning">
          <AlertTitle>{failedChannels.join(' and ')} tracking could not be refreshed</AlertTitle>
          <AlertDescription>
            Unavailable values are shown as a dash. Any retained figures are from the last
            successful refresh.
            <Button
              variant="outline"
              className="mt-3"
              disabled={isRefreshing}
              onClick={() => void refresh()}
            >
              Retry summaries
            </Button>
          </AlertDescription>
        </Alert>
      ) : null}

      <CommunicationsDeliveryMetricGrid
        label="Delivery health"
        isLoading={isLoading}
        metrics={metrics}
      />

      <section aria-label="Channel operations" className="grid gap-4 md:grid-cols-2">
        <OperationCard
          title="Email operations"
          description="Email keeps queue control, manual retry, and analytics because those workflows are channel-specific."
          href={`/app/communications-delivery/email?${context}`}
          provider="Resend"
          isLoading={state.emailSummaryQuery.isLoading}
          segments={
            email
              ? [
                  { label: 'Delivered', count: email.delivered, tone: 'success' },
                  { label: 'Sent', count: email.sent, tone: 'info' },
                  { label: 'Delayed', count: email.deliveryDelayed, tone: 'warning' },
                  {
                    label: 'Bounced, complained or failed',
                    count: email.bounced + email.complained + email.failed,
                    tone: 'danger',
                  },
                ]
              : null
          }
          icon={<MailCheck data-icon="inline-start" aria-hidden />}
          actionLabel="Open Email Delivery"
        />
        <OperationCard
          title="Message operations"
          description="Messages combines SMS and WhatsApp with shared filters, honest provider status, and fallback visibility."
          href={`/app/communications-delivery/messages?${context}`}
          provider="Twilio"
          isLoading={state.messageFeedQuery.isLoading}
          segments={
            messages
              ? [
                  { label: 'Delivered', count: messages.delivered, tone: 'success' },
                  { label: 'Queued / sent', count: messages.queued + messages.sent, tone: 'info' },
                  { label: 'Undelivered', count: messages.undelivered, tone: 'warning' },
                  { label: 'Failed', count: messages.failed, tone: 'danger' },
                ]
              : null
          }
          icon={<MessageSquareMore data-icon="inline-start" aria-hidden />}
          actionLabel="Open Message Delivery"
        />
      </section>
    </OpsPageShell>
  );
}

function OperationCard({
  title,
  description,
  href,
  icon,
  actionLabel,
  provider,
  segments,
  isLoading,
}: {
  title: string;
  description: string;
  href: string;
  icon: ReactNode;
  actionLabel: string;
  provider: string;
  segments: DeliveryBreakdownSegment[] | null;
  isLoading: boolean;
}) {
  return (
    <Card className={cn(OPS_CARD_CLASS, 'flex flex-col')}>
      <CardHeader className={cn(OPS_CARD_HEADER_CLASS, 'space-y-1')}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="text-base font-semibold">{title}</CardTitle>
          <Badge variant="outline">{provider}</Badge>
        </div>
        <CardDescription className="max-w-[60ch]">{description}</CardDescription>
      </CardHeader>
      <CardContent
        className={cn(OPS_CARD_CONTENT_CLASS, 'mt-auto space-y-4 pb-[var(--pg-density-card-py)]')}
      >
        <CommunicationsDeliveryBreakdown segments={segments} isLoading={isLoading} />
        <Button
          asChild
          variant="outline"
          className={cn(COMMS_CONTROL_HEIGHT_CLASS, 'w-full sm:w-auto')}
        >
          <Link href={href} prefetch={false}>
            {icon}
            {actionLabel}
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}
