'use client';

import { RefreshCw } from 'lucide-react';
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { OPS_PAGE_RHYTHM_CLASS } from '@/components/features/ops-shell/patterns/opsDensityClasses';
import { OpsEmptyState } from '@/components/features/ops-shell/patterns/OpsEmptyState';
import { OpsPageHeader } from '@/components/features/ops-shell/patterns/OpsPageHeader';
import { OpsPageShell } from '@/components/features/ops-shell/patterns/OpsPageShell';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { useOpsServices } from '@/contexts/ops-services';
import { useOpsSession } from '@/contexts/ops-session';
import { useOpsRestaurantDetails } from '@/hooks/ops/useOpsRestaurantDetails';
import { opsHref } from '@/lib/url/opsHref';
import { cn } from '@/lib/utils';

import {
  OpsEmailDeliveryAnalytics,
  OpsEmailDeliveryFilters,
  OpsEmailDeliveryHeaderMeta,
  OpsEmailDeliveryLog,
  OpsEmailQueuePanel,
} from './components';
import { formatRefreshLabel, isRefreshOption } from './opsEmailDeliveryDomain';
import { useOpsEmailDeliveryDataState } from './useOpsEmailDeliveryDataState';
import { useOpsEmailDeliveryQueryState } from './useOpsEmailDeliveryQueryState';

import type { OpsEmailDeliveryClientProps, OpsEmailDeliveryRestaurantOption } from './opsEmailDeliveryTypes';

export type { OpsEmailDeliveryClientProps, EmailDeliveryTab } from './opsEmailDeliveryTypes';

export function OpsEmailDeliveryClient(props: OpsEmailDeliveryClientProps) {
  const { memberships, activeRestaurantId, setActiveRestaurantId } = useOpsSession();
  const { restaurantService } = useOpsServices();
  const membershipIds = useMemo(
    () => new Set(memberships.map((membership) => membership.restaurantId)),
    [memberships],
  );

  const [availableRestaurants, setAvailableRestaurants] = useState<OpsEmailDeliveryRestaurantOption[]>(
    [],
  );

  const effectiveRestaurantId = useMemo(() => {
    const fromUrl = props.initialRestaurantId;
    if (fromUrl && membershipIds.has(fromUrl)) return fromUrl;
    if (activeRestaurantId && membershipIds.has(activeRestaurantId)) return activeRestaurantId;
    return memberships[0]?.restaurantId ?? null;
  }, [activeRestaurantId, membershipIds, memberships, props.initialRestaurantId]);

  const queryState = useOpsEmailDeliveryQueryState(props, effectiveRestaurantId);

  // Prefer URL restaurant when valid; otherwise fall back to session.
  const restaurantId = useMemo(() => {
    if (queryState.parsedRestaurantId && membershipIds.has(queryState.parsedRestaurantId)) {
      return queryState.parsedRestaurantId;
    }
    return effectiveRestaurantId;
  }, [effectiveRestaurantId, membershipIds, queryState.parsedRestaurantId]);

  useEffect(() => {
    if (!restaurantId) return;
    if (restaurantId !== activeRestaurantId) setActiveRestaurantId(restaurantId);
  }, [activeRestaurantId, restaurantId, setActiveRestaurantId]);

  useEffect(() => {
    let cancelled = false;
    void restaurantService
      .listRestaurants()
      .then((restaurants) => {
        if (cancelled) return;
        setAvailableRestaurants(
          restaurants
            .filter((restaurant) => membershipIds.has(restaurant.id))
            .map((restaurant) => ({
              id: restaurant.id,
              name: restaurant.name,
              timezone: restaurant.timezone,
            })),
        );
      })
      .catch(() => {
        if (cancelled) return;
        setAvailableRestaurants(
          memberships.map((membership) => ({
            id: membership.restaurantId,
            name: membership.restaurantName,
            timezone: null,
          })),
        );
      });
    return () => {
      cancelled = true;
    };
  }, [membershipIds, memberships, restaurantService]);

  const restaurantDetails = useOpsRestaurantDetails(restaurantId);
  const timezone = restaurantDetails.data?.timezone ?? 'UTC';

  const dataState = useOpsEmailDeliveryDataState({
    restaurantId,
    activeTab: queryState.tab,
    range: queryState.range,
    page: queryState.page,
    pageSize: queryState.pageSize,
    refresh: queryState.refresh,
    statuses: queryState.statuses,
    recipientEmail: queryState.recipientEmail,
    messageId: queryState.messageId,
    bookingRef: queryState.bookingRef,
    templateType: queryState.templateType,
    emailType: queryState.emailType,
    timezone,
  });

  const handleRestaurantChange = useCallback(
    (nextRestaurantId: string) => {
      if (!membershipIds.has(nextRestaurantId)) return;
      setActiveRestaurantId(nextRestaurantId);
      queryState.resetToDefaults(nextRestaurantId);
    },
    [membershipIds, queryState, setActiveRestaurantId],
  );

  if (memberships.length === 0) {
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

  return (
    <OpsPageShell variant="standard" className={OPS_PAGE_RHYTHM_CLASS}>
      <OpsPageHeader
        title="Email Delivery"
        subtitle="Deliverability dashboard for booking emails (Resend)."
        meta={
          <OpsEmailDeliveryHeaderMeta
            availableRestaurants={availableRestaurants}
            restaurantId={restaurantId}
            currentRestaurantName={restaurantDetails.data?.name ?? null}
            timezone={timezone}
            onRestaurantChange={handleRestaurantChange}
          />
        }
        secondaryActions={
          <Button asChild variant="outline" size="sm">
            <Link href="/app/communications-delivery/messages" prefetch={false}>
              Message Delivery
            </Link>
          </Button>
        }
      />

      <Tabs value={queryState.tab} onValueChange={queryState.handleTabChange} className="mt-6">
        <div className="mb-4 rounded-xl border border-border bg-muted/40 p-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-col gap-2">
              <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                Auto-refresh
              </div>
              <ToggleGroup
                type="single"
                value={queryState.refresh}
                onValueChange={(value) => {
                  if (!isRefreshOption(value)) return;
                  queryState.applyRefresh(value);
                }}
                className="justify-start rounded-full border border-border bg-background p-1"
                aria-label="Auto-refresh interval"
              >
                {(['off', '30s', '1m', '5m'] as const).map((option) => (
                  <ToggleGroupItem
                    key={option}
                    value={option}
                    className="rounded-full px-4 text-xs font-semibold data-[state=on]:bg-primary data-[state=on]:text-primary-foreground"
                    aria-label={`Refresh every ${formatRefreshLabel(option)}`}
                  >
                    {formatRefreshLabel(option)}
                  </ToggleGroupItem>
                ))}
              </ToggleGroup>
            </div>
            <div className="flex flex-col items-start gap-2 sm:flex-row sm:items-center">
              {queryState.refresh !== 'off' ? (
                <Badge variant="outline" className="border-primary/30 bg-primary/10 text-primary">
                  Auto-refresh {formatRefreshLabel(queryState.refresh)}
                </Badge>
              ) : (
                <span className="text-sm text-muted-foreground">Auto-refresh is off.</span>
              )}
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={dataState.handleManualRefresh}
                disabled={dataState.isRefreshing}
                aria-label="Refresh current tab"
              >
                <RefreshCw
                  data-icon="inline-start"
                  className={cn(dataState.isRefreshing && 'animate-spin')}
                  aria-hidden
                />
                Refresh
              </Button>
            </div>
          </div>
        </div>

        <TabsList>
          <TabsTrigger value="delivery-log">Delivery Log</TabsTrigger>
          <TabsTrigger value="queue">Queue</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
        </TabsList>

        <TabsContent value="delivery-log" className="space-y-4">
          <OpsEmailDeliveryFilters
            searchField={queryState.searchField}
            searchValue={queryState.searchValue}
            onSearchFieldChange={queryState.setSearchField}
            onSearchValueChange={queryState.setSearchValue}
            onSubmitSearch={queryState.submitSearch}
            range={queryState.range}
            onRangeChange={queryState.applyRange}
            templateType={queryState.templateType}
            onTemplateTypeChange={queryState.applyTemplateType}
            emailType={queryState.emailType}
            onEmailTypeChange={queryState.applyEmailType}
            statuses={queryState.statuses}
            statusCounts={dataState.statusCounts}
            onToggleStatus={queryState.toggleStatus}
            onClear={queryState.clearFilters}
          />
          <OpsEmailDeliveryLog
            unavailable={dataState.feedQuery.unavailable}
            errorMessage={dataState.deliveryLogErrorMessage}
            isLoading={dataState.feedQuery.isLoading}
            rows={dataState.rows}
            timezone={timezone}
            restaurantId={restaurantId ?? ''}
            retryingAttemptKey={dataState.retryingAttemptKey}
            pendingRetryRow={dataState.pendingRetryRow}
            isRetryDialogOpen={dataState.pendingRetryAttemptKey !== null}
            onRetryAttempt={dataState.handleRetryAttempt}
            onRetryDialogOpenChange={dataState.handleRetryDialogOpenChange}
            onConfirmRetry={dataState.handleConfirmRetry}
            onRefetch={() => void dataState.feedQuery.refetch()}
            shouldShowPagination={dataState.shouldShowPagination}
            currentPage={dataState.currentPage}
            currentPageSize={dataState.currentPageSize}
            totalResults={dataState.totalResults}
            startResult={dataState.startResult}
            endResult={dataState.endResult}
            hasPrevPage={dataState.hasPrevPage}
            hasNextPage={dataState.hasNextPage}
            onPrev={() => queryState.applyPage(Math.max(1, queryState.page - 1))}
            onNext={() => {
              if (dataState.hasNextPage) queryState.applyPage(queryState.page + 1);
            }}
            onPageSizeChange={queryState.applyPageSize}
          />
        </TabsContent>

        <TabsContent value="queue">
          <OpsEmailQueuePanel
            jobs={dataState.queueQuery.jobs ?? []}
            summary={dataState.queueQuery.summary}
            isLoading={dataState.queueQuery.isLoading || dataState.queueQuery.isFetching}
            errorMessage={
              dataState.queueQuery.apiError?.error ?? dataState.queueQuery.error?.message ?? null
            }
            timezone={timezone}
            restaurantId={restaurantId}
            status={dataState.queueStatus}
            onStatusChange={dataState.setQueueStatus}
            page={dataState.queuePage}
            hasNext={Boolean(
              dataState.queueQuery.response?.ok && dataState.queueQuery.response.pageInfo.hasNext,
            )}
            total={
              dataState.queueQuery.response?.ok
                ? dataState.queueQuery.response.pageInfo.total
                : 0
            }
            timestamp={
              dataState.queueQuery.response?.ok ? dataState.queueQuery.response.timestamp : null
            }
            onPrevPage={() => dataState.setQueuePage(Math.max(1, dataState.queuePage - 1))}
            onNextPage={() => dataState.setQueuePage(dataState.queuePage + 1)}
            actionJobId={dataState.queueActionJobId}
            onCancelJob={dataState.handleCancelQueueJob}
            onRequeueJob={dataState.handleRequeueQueueJob}
          />
        </TabsContent>

        <TabsContent value="analytics">
          <OpsEmailDeliveryAnalytics
            summary={dataState.analyticsSummary}
            isLoading={dataState.analyticsQuery.isLoading}
            isUpdating={
              dataState.analyticsQuery.isFetching && !dataState.analyticsQuery.isLoading
            }
            range={queryState.range}
            onRangeChange={queryState.applyRange}
            errorMessage={dataState.analyticsErrorMessage}
            lastUpdatedAt={
              dataState.analyticsQuery.dataUpdatedAt > 0
                ? dataState.analyticsQuery.dataUpdatedAt
                : null
            }
          />
        </TabsContent>
      </Tabs>
    </OpsPageShell>
  );
}
