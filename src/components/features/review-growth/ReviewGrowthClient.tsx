'use client';

import { ExternalLink, Mail, MessageCircleMore, Star } from 'lucide-react';
import { useEffect, useMemo } from 'react';

import {
  CommunicationsDeliveryChannelTabs,
  CommunicationsDeliveryMetricGrid,
  CommunicationsDeliveryTableRegion,
} from '@/components/features/communications-delivery/components';
import { CommunicationsDeliveryHeader } from '@/components/features/communications-delivery/components/CommunicationsDeliveryHeader';
import { CommunicationsDeliveryRangeSelect } from '@/components/features/communications-delivery/components/CommunicationsDeliveryRangeSelect';
import { useCommunicationsDeliveryQueryState } from '@/components/features/communications-delivery/useCommunicationsDeliveryQueryState';
import {
  OPS_CARD_CLASS,
  OPS_CARD_CONTENT_CLASS,
  OPS_CARD_HEADER_CLASS,
  OPS_PAGE_RHYTHM_CLASS,
} from '@/components/features/ops-shell/patterns/opsDensityClasses';
import { OpsPageHeader } from '@/components/features/ops-shell/patterns/OpsPageHeader';
import { OpsPageShell } from '@/components/features/ops-shell/patterns/OpsPageShell';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useOpsSession } from '@/contexts/ops-session';
import { useOpsRestaurantDetails } from '@/hooks/ops/useOpsRestaurantDetails';
import { useOpsReviewGrowthSummary } from '@/hooks/ops/useOpsReviewGrowthSummary';
import { cn } from '@/lib/utils';

import type { ReviewGrowthChannelMetrics, ReviewGrowthRange } from '@/types/reviewGrowth';

function percentage(value: number, total: number): string {
  return total > 0 ? `${((value / total) * 100).toFixed(1)}%` : '—';
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
  const queryState = useCommunicationsDeliveryQueryState(
    props.initialRestaurantId,
    props.initialRange,
  );
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
  const range: ReviewGrowthRange = queryState.range === '30d' ? '30d' : '7d';

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
        secondaryActions={
          <>
            <CommunicationsDeliveryRangeSelect
              value={range}
              onChange={queryState.setRange}
              includeDay={false}
            />
            <Button
              variant="outline"
              className="h-11 sm:h-9"
              disabled={summaryQuery.isFetching}
              onClick={() => void summaryQuery.refetch()}
            >
              {summaryQuery.isFetching ? 'Refreshing' : 'Refresh'}
            </Button>
          </>
        }
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
      {queryState.range === '24h' ? (
        <p className="text-sm text-muted-foreground">
          Review growth uses a minimum 7-day window. Showing the last 7 days.
        </p>
      ) : null}
      {summaryQuery.isError && summary ? (
        <Alert variant="warning">
          <AlertTitle>Review figures could not be refreshed</AlertTitle>
          <AlertDescription>
            Showing the last successful result. Refresh to try again.
          </AlertDescription>
        </Alert>
      ) : null}

      {summaryQuery.isLoading || summary ? (
        <CommunicationsDeliveryMetricGrid
          label="Review funnel metrics"
          isLoading={summaryQuery.isLoading}
          metrics={
            summary
              ? [
                  {
                    label: 'Completed visits',
                    value: summary.completedVisits.toLocaleString(),
                    hint: `${range} source population`,
                  },
                  {
                    label: 'Guests reached',
                    value: summary.reached.toLocaleString(),
                    hint: `${percentage(summary.reached, summary.eligible)} of eligible journeys`,
                  },
                  {
                    label: 'Review-link clicks',
                    value: summary.clicked.toLocaleString(),
                    hint: `${percentage(summary.clicked, summary.reached)} of reached guests`,
                  },
                  {
                    label: 'New Google reviews observed',
                    value: summary.newGoogleReviews.toLocaleString(),
                    hint: `${(summary.completedVisits ? (summary.newGoogleReviews / summary.completedVisits) * 100 : 0).toFixed(1)} per 100 completed visits`,
                  },
                ]
              : []
          }
        />
      ) : null}

      {summaryQuery.isLoading ? null : summary ? (
        <>
          <Card className={OPS_CARD_CLASS}>
            <CardHeader className={OPS_CARD_HEADER_CLASS}>
              <CardTitle className="text-base font-semibold">End-to-end funnel</CardTitle>
            </CardHeader>
            <CardContent
              className={cn(OPS_CARD_CONTENT_CLASS, 'space-y-4 pb-[var(--pg-density-card-py)]')}
            >
              <ol className="space-y-4 md:space-y-3">
                {(
                  [
                    ['Eligible', summary.eligible],
                    ['Sent', summary.sent],
                    ['Reached', summary.reached],
                    ['Clicked', summary.clicked],
                    ['Reviews observed*', summary.newGoogleReviews],
                  ] as const
                ).map(([label, value]) => (
                  <li
                    key={label}
                    className="grid gap-1.5 md:grid-cols-[9rem_minmax(0,1fr)_9rem] md:items-center md:gap-4"
                  >
                    <span className="text-sm font-medium">{label}</span>
                    <Progress
                      value={summary.eligible ? (value / summary.eligible) * 100 : 0}
                      aria-label={`${label.replace('*', '')}: ${percentage(value, summary.eligible)} of eligible`}
                    />
                    <span className="text-sm tabular-nums text-muted-foreground md:text-right">
                      <span className="font-semibold text-foreground">
                        {value.toLocaleString()}
                      </span>{' '}
                      · {percentage(value, summary.eligible)}
                    </span>
                  </li>
                ))}
              </ol>
              {summary.suppressed > 0 ? (
                <p className="text-xs text-muted-foreground">
                  {summary.suppressed} journeys were suppressed by cooldown or channel eligibility
                  rules.
                </p>
              ) : null}
              <p className="max-w-[75ch] text-xs text-muted-foreground">
                * Google review notifications are counted for the venue and date range. They are not
                identity-matched to individual guests, so this is directional outcome tracking, not
                person-level attribution.
              </p>
            </CardContent>
          </Card>

          <Card className={OPS_CARD_CLASS}>
            <CardHeader className={OPS_CARD_HEADER_CLASS}>
              <CardTitle className="text-base font-semibold">WhatsApp vs email</CardTitle>
            </CardHeader>
            <CardContent
              className={cn(OPS_CARD_CONTENT_CLASS, 'space-y-4 pb-[var(--pg-density-card-py)]')}
            >
              <CommunicationsDeliveryTableRegion
                label="WhatsApp and email comparison"
                hintBelow="lg"
              >
                <Table className="min-w-[640px]">
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
              </CommunicationsDeliveryTableRegion>
              <ul className="flex flex-wrap gap-2" aria-label="Review ask policy">
                <li>
                  <Badge variant="outline" className="gap-1">
                    <Star className="size-3" aria-hidden />
                    WhatsApp first
                  </Badge>
                </li>
                <li>
                  <Badge variant="outline">Email after 48h without a click</Badge>
                </li>
                <li>
                  <Badge variant="outline">90-day guest cooldown</Badge>
                </li>
                <li>
                  <Badge variant="outline">Maximum 2 asks</Badge>
                </li>
              </ul>
            </CardContent>
          </Card>

          {!summary.newGoogleReviews && summary.clicked > 0 ? (
            <Alert variant="warning">
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
            The journey dashboard could not be loaded. This does not confirm whether delivery is
            healthy.
            <Button
              variant="outline"
              className="mt-3"
              disabled={summaryQuery.isFetching}
              onClick={() => void summaryQuery.refetch()}
            >
              Retry review tracking
            </Button>
          </AlertDescription>
        </Alert>
      )}
    </OpsPageShell>
  );
}
