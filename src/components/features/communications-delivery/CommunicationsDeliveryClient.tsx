'use client';

import { MessageSquareMore } from 'lucide-react';
import Link from 'next/link';

import { OPS_PAGE_RHYTHM_CLASS } from '@/components/features/ops-shell/patterns/opsDensityClasses';
import { OpsEmptyState } from '@/components/features/ops-shell/patterns/OpsEmptyState';
import { OpsPageHeader } from '@/components/features/ops-shell/patterns/OpsPageHeader';
import { OpsPageShell } from '@/components/features/ops-shell/patterns/OpsPageShell';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { opsHref } from '@/lib/url/opsHref';

import { buildCommunicationsOverviewMetrics } from './communicationsDeliverySelectors';
import {
  CommunicationsDeliveryChannelTabs,
  CommunicationsDeliveryHeader,
  CommunicationsDeliveryOverviewCards,
} from './components';
import { useCommunicationsDeliveryOverviewState } from './useCommunicationsDeliveryOverviewState';
import { useCommunicationsDeliveryQueryState } from './useCommunicationsDeliveryQueryState';

export type CommunicationsDeliveryClientProps = {
  initialRestaurantId?: string | null;
  initialRange?: '24h' | '7d' | '30d';
};

export function CommunicationsDeliveryClient({
  initialRestaurantId = null,
  initialRange = '7d',
}: CommunicationsDeliveryClientProps) {
  const queryState = useCommunicationsDeliveryQueryState(initialRestaurantId);
  const state = useCommunicationsDeliveryOverviewState({
    restaurantId: queryState.restaurantId,
    range: queryState.range ?? initialRange,
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

  return (
    <OpsPageShell variant="standard" className={OPS_PAGE_RHYTHM_CLASS}>
      <OpsPageHeader
        title="Communications Delivery"
        subtitle="One place to monitor email, SMS, and WhatsApp health while keeping channel-specific workflows separate."
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

      <CommunicationsDeliveryOverviewCards isLoading={isLoading} metrics={metrics} />

      <section className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Email operations</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <p>
              Email keeps queue control, manual retry, and analytics because those workflows are
              channel-specific.
            </p>
            <Button asChild variant="outline" size="sm">
              <Link href="/app/communications-delivery/email" prefetch={false}>
                Open Email Delivery
              </Link>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Message operations</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <p>
              Messages combines SMS and WhatsApp with shared filters, honest provider status, and
              fallback visibility.
            </p>
            <Button asChild variant="outline" size="sm">
              <Link href="/app/communications-delivery/messages" prefetch={false}>
                <MessageSquareMore data-icon="inline-start" aria-hidden />
                Open Message Delivery
              </Link>
            </Button>
          </CardContent>
        </Card>
      </section>
    </OpsPageShell>
  );
}
