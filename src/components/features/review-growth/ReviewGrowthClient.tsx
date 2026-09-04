'use client';

import { ExternalLink, MessageCircleMore, Mail, Star } from 'lucide-react';
import { useEffect, useMemo } from 'react';

import { CommunicationsDeliveryChannelTabs } from '@/components/features/communications-delivery/components';
import { CommunicationsDeliveryHeader } from '@/components/features/communications-delivery/components/CommunicationsDeliveryHeader';
import { useCommunicationsDeliveryQueryState } from '@/components/features/communications-delivery/useCommunicationsDeliveryQueryState';
import { OPS_PAGE_RHYTHM_CLASS } from '@/components/features/ops-shell/patterns/opsDensityClasses';
import { OpsPageHeader } from '@/components/features/ops-shell/patterns/OpsPageHeader';
import { OpsPageShell } from '@/components/features/ops-shell/patterns/OpsPageShell';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Text } from '@/components/ui/typography';
import { useOpsSession } from '@/contexts/ops-session';
import { useOpsRestaurantDetails } from '@/hooks/ops/useOpsRestaurantDetails';
import { useOpsReviewGrowthSummary } from '@/hooks/ops/useOpsReviewGrowthSummary';

import type { ReviewGrowthChannelMetrics, ReviewGrowthRange } from '@/types/reviewGrowth';

function percentage(value: number, total: number): string {
  return total > 0 ? `${((value / total) * 100).toFixed(1)}%` : '—';
}

function metric(title: string, value: number, detail: string) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <Text
          as="div"
          variant="mono"
          className="text-[length:var(--pg-text-section)] font-semibold tracking-tight text-foreground"
        >
          {value.toLocaleString()}
        </Text>
        <p className="mt-1 text-xs text-muted-foreground">{detail}</p>
      </CardContent>
    </Card>
  );
}

function channelReached(channel: ReviewGrowthChannelMetrics | undefined): number {
  if (!channel) return 0;
  return Math.max(channel.delivered, channel.read, channel.opened);
}

function formatCost(channel: ReviewGrowthChannelMetrics | undefined): string {
  if (!channel?.costMicrounits || !channel.costCurrency) return '—';
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: channel.costCurrency,
  }).format(channel.costMicrounits / 1_000_000);
}

export function ReviewGrowthClient(props: {
  initialRestaurantId?: string | null;
  initialRange?: ReviewGrowthRange;
}) {
  const queryState = useCommunicationsDeliveryQueryState(props.initialRestaurantId);
  const { memberships, activeRestaurantId, setActiveRestaurantId } = useOpsSession();
  const membershipIds = useMemo(
    () => new Set(memberships.map((membership) => membership.restaurantId)),
    [memberships],
  );
  const restaurantId =
    (queryState.restaurantId && membershipIds.has(queryState.restaurantId)
      ? queryState.restaurantId
      : null) ??
    (activeRestaurantId && membershipIds.has(activeRestaurantId) ? activeRestaurantId : null) ??
    memberships[0]?.restaurantId ??
    null;
  const range: ReviewGrowthRange =
    queryState.range === '30d' ? '30d' : (props.initialRange ?? '7d');

  useEffect(() => {
    if (!restaurantId) return;
    if (activeRestaurantId !== restaurantId) setActiveRestaurantId(restaurantId);
    if (queryState.restaurantId !== restaurantId) queryState.setRestaurantId(restaurantId);
  }, [activeRestaurantId, queryState, restaurantId, setActiveRestaurantId]);

  const details = useOpsRestaurantDetails(restaurantId);
  const summaryQuery = useOpsReviewGrowthSummary({ restaurantId, range });
  const response = summaryQuery.data;
  const summary = response?.ok ? response.summary : null;
  const whatsapp = summary?.channels.whatsapp;
  const email = summary?.channels.email;

  return (
    <OpsPageShell variant="standard" className={OPS_PAGE_RHYTHM_CLASS}>
      <OpsPageHeader
        title="Review Growth"
        subtitle="Track the full post-visit funnel, compare WhatsApp with email, and reduce repeat asks."
        meta={
          <CommunicationsDeliveryHeader
            availableRestaurants={memberships.map((membership) => ({
              id: membership.restaurantId,
              name: membership.restaurantName,
              timezone: null,
            }))}
            restaurantId={restaurantId}
            currentRestaurantName={details.data?.name ?? null}
            timezone={details.data?.timezone ?? 'UTC'}
            onRestaurantChange={queryState.setRestaurantId}
          />
        }
      />

      <CommunicationsDeliveryChannelTabs active="reviews" />

      {summaryQuery.isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }, (_, index) => (
            <Skeleton key={index} className="h-32 rounded-xl" />
          ))}
        </div>
      ) : summary ? (
        <>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {metric('Completed visits', summary.completedVisits, `${range} source population`)}
            {metric(
              'Guests reached',
              summary.reached,
              percentage(summary.reached, summary.eligible) + ' of eligible journeys',
            )}
            {metric(
              'Review-link clicks',
              summary.clicked,
              percentage(summary.clicked, summary.reached) + ' of reached guests',
            )}
            {metric(
              'New Google reviews observed',
              summary.newGoogleReviews,
              `${(summary.completedVisits ? (summary.newGoogleReviews / summary.completedVisits) * 100 : 0).toFixed(1)} per 100 completed visits`,
            )}
          </div>

          <Card>
            <CardHeader>
              <CardTitle>End-to-end funnel</CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              {[
                ['Eligible', summary.eligible],
                ['Sent', summary.sent],
                ['Reached', summary.reached],
                ['Clicked', summary.clicked],
                ['Reviews observed*', summary.newGoogleReviews],
              ].map(([label, value]) => (
                <div
                  key={String(label)}
                  className="grid gap-2 sm:grid-cols-[120px_1fr_90px] sm:items-center"
                >
                  <span className="text-sm font-medium">{label}</span>
                  <Progress
                    value={summary.eligible ? (Number(value) / summary.eligible) * 100 : 0}
                  />
                  <span className="text-right text-sm tabular-nums">
                    {Number(value).toLocaleString()} · {percentage(Number(value), summary.eligible)}
                  </span>
                </div>
              ))}
              {summary.suppressed > 0 ? (
                <p className="text-xs text-muted-foreground">
                  {summary.suppressed} journeys were suppressed by cooldown or channel eligibility
                  rules.
                </p>
              ) : null}
              <p className="text-xs text-muted-foreground">
                * Google review notifications are counted for the venue and date range. They are not
                identity-matched to individual guests, so this is directional outcome tracking, not
                person-level attribution.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>WhatsApp vs email</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Channel</TableHead>
                    <TableHead className="text-right">Sent</TableHead>
                    <TableHead className="text-right">Reached</TableHead>
                    <TableHead className="text-right">Engaged</TableHead>
                    <TableHead className="text-right">Clicked</TableHead>
                    <TableHead className="text-right">Failed</TableHead>
                    <TableHead className="text-right">Tracked cost</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(
                    [
                      [
                        'WhatsApp',
                        whatsapp,
                        <MessageCircleMore key="wa" className="size-4" aria-hidden />,
                      ],
                      ['Email', email, <Mail key="email" className="size-4" aria-hidden />],
                    ] as const
                  ).map(([label, channel, icon]) => (
                    <TableRow key={label}>
                      <TableCell>
                        <span className="flex items-center gap-2 font-medium">
                          {icon}
                          {label}
                        </span>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {channel?.sent ?? 0}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {channelReached(channel)}{' '}
                        <span className="text-muted-foreground">
                          ({percentage(channelReached(channel), channel?.sent ?? 0)})
                        </span>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {label === 'WhatsApp' ? (channel?.read ?? 0) : (channel?.opened ?? 0)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {channel?.clicked ?? 0}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {channel?.failed ?? 0}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatCost(channel)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <div className="mt-4 flex flex-wrap gap-2">
                <Badge variant="secondary">
                  <Star className="mr-1 size-3" aria-hidden />
                  WhatsApp first
                </Badge>
                <Badge variant="outline">Email after 48h without a click</Badge>
                <Badge variant="outline">90-day guest cooldown</Badge>
                <Badge variant="outline">Maximum 2 asks</Badge>
              </div>
            </CardContent>
          </Card>

          {!summary.newGoogleReviews && summary.clicked > 0 ? (
            <Alert>
              <ExternalLink className="size-4" aria-hidden />
              <AlertTitle>Verify Google review ingestion</AlertTitle>
              <AlertDescription>
                Clicks are arriving, but no new Google review notifications were observed in this
                range. Confirm the Business Profile notification subscription is linked.
              </AlertDescription>
            </Alert>
          ) : null}
        </>
      ) : (
        <Alert variant="destructive">
          <AlertTitle>Review tracking unavailable</AlertTitle>
          <AlertDescription>
            The journey dashboard could not be loaded. Existing booking communication is unaffected.
          </AlertDescription>
        </Alert>
      )}
    </OpsPageShell>
  );
}
