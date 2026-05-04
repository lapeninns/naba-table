'use client';

import {
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  MailWarning,
  RefreshCw,
  RotateCcw,
} from 'lucide-react';
import Link from 'next/link';

import { OpsEmailDeliveryAnalytics } from '@/components/features/email-delivery/components/OpsEmailDeliveryAnalytics';
import { OpsEmailDeliveryFilterBar } from '@/components/features/email-delivery/components/OpsEmailDeliveryFilterBar';
import { OpsEmailDeliveryTable } from '@/components/features/email-delivery/components/OpsEmailDeliveryTable';
import { OpsEmailQueuePanel } from '@/components/features/email-delivery/components/OpsEmailQueuePanel';
import { OPS_EMAIL_DELIVERY_PAGE_SIZE_OPTIONS } from '@/components/features/email-delivery/opsEmailDeliveryTypes';
import { useOpsEmailDeliveryState } from '@/components/features/email-delivery/useOpsEmailDeliveryState';
import { OpsEmptyState } from '@/components/features/ops-shell/patterns/OpsEmptyState';
import { OpsPageHeader } from '@/components/features/ops-shell/patterns/OpsPageHeader';
import { OpsPageShell } from '@/components/features/ops-shell/patterns/OpsPageShell';
import { OpsPageToolbar } from '@/components/features/ops-shell/patterns/OpsPageToolbar';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { opsHref } from '@/lib/url/opsHref';
import { cn } from '@/lib/utils';

import type { OpsEmailDeliveryClientProps } from '@/components/features/email-delivery/useOpsEmailDeliveryState';

export type { OpsEmailDeliveryClientProps } from '@/components/features/email-delivery/useOpsEmailDeliveryState';
export type { EmailDeliveryTab } from '@/components/features/email-delivery/opsEmailDeliveryTypes';

export function OpsEmailDeliveryClient(props: OpsEmailDeliveryClientProps) {
  const state = useOpsEmailDeliveryState(props);

  if (state.memberships.length === 0) {
    return (
      <section className="mx-auto flex min-h-[60vh] max-w-2xl items-center justify-center p-8">
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
    );
  }

  return (
    <OpsPageShell variant="standard" className="space-y-4">
      <OpsPageHeader
        title="Email Delivery"
        subtitle="Deliverability dashboard for booking emails (Resend)."
        meta={
          <div className="flex flex-wrap items-center gap-2">
            {state.availableRestaurants.length > 1 ? (
              <Select
                value={state.effectiveRestaurantId ?? ''}
                onValueChange={state.handleRestaurantChange}
              >
                <SelectTrigger className="h-8 w-full sm:w-[240px]" aria-label="Restaurant switcher">
                  <SelectValue placeholder="Select restaurant" />
                </SelectTrigger>
                <SelectContent>
                  {state.availableRestaurants.map((restaurant) => (
                    <SelectItem key={restaurant.id} value={restaurant.id}>
                      {restaurant.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : state.restaurantDetails.data ? (
              <Badge variant="outline" className="text-xs">
                {state.restaurantDetails.data.name}
              </Badge>
            ) : null}
            <Badge variant="outline" className="font-mono text-xs text-muted-foreground">
              {state.timezone}
            </Badge>
          </div>
        }
        secondaryActions={
          <Button asChild variant="outline" size="sm">
            <Link href="/app/bookings" prefetch={false}>
              Go to bookings
            </Link>
          </Button>
        }
      />

      <Tabs
        value={state.queryState.tab}
        onValueChange={state.queryState.handleTabChange}
        className="mt-6"
      >
        <div className="mb-4 rounded-xl border border-border bg-muted/40 p-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="space-y-2">
              <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                Auto-refresh
              </div>
              <ToggleGroup
                type="single"
                value={state.queryState.refresh}
                onValueChange={(value) => {
                  if (value !== 'off' && value !== '30s' && value !== '1m' && value !== '5m')
                    return;
                  state.queryState.applyRefresh(value);
                }}
                className="justify-start rounded-full border border-border bg-background p-1"
                aria-label="Auto-refresh interval"
              >
                {['off', '30s', '1m', '5m'].map((option) => (
                  <ToggleGroupItem
                    key={option}
                    value={option}
                    className="rounded-full px-4 text-xs font-semibold data-[state=on]:bg-primary data-[state=on]:text-primary-foreground"
                    aria-label={`Refresh every ${state.formatRefreshLabel(option as 'off' | '30s' | '1m' | '5m')}`}
                  >
                    {option === 'off'
                      ? 'Off'
                      : state.formatRefreshLabel(option as 'off' | '30s' | '1m' | '5m')}
                  </ToggleGroupItem>
                ))}
              </ToggleGroup>
            </div>

            <div className="flex flex-col items-start gap-2 sm:flex-row sm:items-center">
              {state.autoRefreshActive ? (
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline" className="border-primary/30 bg-primary/10 text-primary">
                    Auto-refresh {state.formatRefreshLabel(state.queryState.refresh)}
                  </Badge>
                  <span className="text-sm text-muted-foreground">
                    {state.refreshIndicatorText}
                  </span>
                </div>
              ) : (
                <span className="text-sm text-muted-foreground">Auto-refresh is off.</span>
              )}
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="border-border bg-background text-foreground hover:bg-muted"
                onClick={state.handleManualRefresh}
                disabled={state.manualRefreshBusy}
                aria-label="Refresh current tab"
              >
                <RefreshCw
                  className={cn('mr-2 h-4 w-4', state.manualRefreshBusy && 'animate-spin')}
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

        <TabsContent value="delivery-log">
          <OpsPageToolbar className="space-y-4">
            {state.canInjectDeliveryLogError ? (
              <Alert className="border-dashed border-border bg-muted/40">
                <AlertCircle className="h-4 w-4" aria-hidden />
                <AlertTitle>Dev/test validation control</AlertTitle>
                <AlertDescription className="space-y-3">
                  <p>
                    To surface the Delivery Log error alert for validation, append{' '}
                    <code>messageId={state.DELIVERY_LOG_FAULT_INJECTION_MESSAGE_ID}</code> to this
                    dev harness URL or choose Message ID in the search field and submit that exact
                    value.
                  </p>
                  <p className="text-xs text-muted-foreground">
                    This fault injection path is only enabled for dev/test contexts and is ignored
                    on production surfaces.
                  </p>
                </AlertDescription>
              </Alert>
            ) : null}

            <OpsEmailDeliveryFilterBar
              searchField={state.queryState.searchField}
              searchValue={state.queryState.searchValue}
              onSearchFieldChange={state.queryState.setSearchField}
              onSearchValueChange={state.queryState.setSearchValue}
              onSubmitSearch={state.queryState.submitSearch}
              range={state.queryState.range}
              onRangeChange={state.queryState.applyRange}
              templateType={state.queryState.templateType}
              onTemplateTypeChange={state.queryState.applyTemplateType}
              emailType={state.queryState.emailType}
              onEmailTypeChange={state.queryState.applyEmailType}
              statuses={state.queryState.statuses}
              statusCounts={state.dataState.statusCounts}
              onToggleStatus={state.queryState.toggleStatus}
              onClear={state.queryState.clearFilters}
            />
          </OpsPageToolbar>

          <section className="mt-4 space-y-4">
            {state.dataState.feedQuery.unavailable ? (
              <Alert className="border-border bg-muted/40">
                <MailWarning className="h-4 w-4" aria-hidden />
                <AlertTitle>Delivery tracking unavailable</AlertTitle>
                <AlertDescription>
                  This environment is not currently recording or exposing delivery events. Email
                  sending can still work normally.
                </AlertDescription>
              </Alert>
            ) : state.effectiveDeliveryLogErrorMessage ? (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" aria-hidden />
                <AlertTitle>Unable to load email delivery attempts</AlertTitle>
                <AlertDescription className="space-y-3">
                  <p>{state.effectiveDeliveryLogErrorMessage}</p>
                  <Button
                    type="button"
                    variant="link"
                    className="h-auto px-0 text-destructive underline-offset-4 hover:underline"
                    onClick={() => {
                      void state.dataState.feedQuery.refetch();
                    }}
                  >
                    <RotateCcw className="mr-1 h-4 w-4" aria-hidden />
                    Retry
                  </Button>
                </AlertDescription>
              </Alert>
            ) : (
              <OpsEmailDeliveryTable
                rows={state.dataState.rows}
                timezone={state.timezone}
                restaurantId={state.effectiveRestaurantId ?? ''}
                isLoading={state.dataState.feedQuery.isLoading}
                retryingAttemptKey={state.retryState.retryingAttemptKey}
                pendingRetryRow={state.retryState.pendingRetryRow}
                isRetryDialogOpen={state.retryState.pendingRetryAttemptKey !== null}
                onRetryAttempt={state.retryState.handleRetryAttempt}
                onRetryDialogOpenChange={state.retryState.handleRetryDialogOpenChange}
                onConfirmRetry={state.retryState.handleConfirmRetry}
              />
            )}

            {state.shouldShowEmptyGuidance ? (
              <div className="rounded-lg border border-border bg-background p-8 text-center">
                <p className="text-base font-semibold text-foreground">No email deliveries found</p>
                <p className="mt-2 text-sm text-muted-foreground">
                  Adjust the filters or try a wider date range to see more results.
                </p>
              </div>
            ) : null}

            {state.shouldShowPagination ? (
              <div className="flex flex-col gap-3 rounded-lg border border-border bg-background px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex flex-col gap-1">
                  <p className="text-sm font-medium text-foreground">
                    Showing {state.startResult}-{state.endResult} of {state.totalResults} results
                  </p>
                  <p className="text-xs text-muted-foreground">Page {state.currentPage}</p>
                </div>

                <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">Rows per page</span>
                    <Select
                      value={String(state.currentPageSize)}
                      onValueChange={(value) => {
                        const nextPageSize = Number.parseInt(value, 10);
                        if (
                          !Number.isFinite(nextPageSize) ||
                          nextPageSize === state.queryState.pageSize
                        )
                          return;
                        state.queryState.applyPageSize(nextPageSize);
                      }}
                    >
                      <SelectTrigger className="h-9 w-full sm:w-[88px]" aria-label="Rows per page">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {OPS_EMAIL_DELIVERY_PAGE_SIZE_OPTIONS.map((option) => (
                          <SelectItem key={option} value={String(option)}>
                            {option}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={state.handlePrev}
                      disabled={!state.hasPrevPage}
                    >
                      <ChevronLeft className="h-4 w-4" aria-hidden />
                      Prev
                    </Button>
                    <span className="min-w-16 text-center text-xs text-muted-foreground">
                      Page {state.currentPage}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={state.handleNext}
                      disabled={!state.hasNextPage}
                    >
                      Next
                      <ChevronRight className="h-4 w-4" aria-hidden />
                    </Button>
                  </div>
                </div>
              </div>
            ) : null}
          </section>
        </TabsContent>

        <TabsContent value="queue">
          <OpsEmailQueuePanel
            restaurantId={state.effectiveRestaurantId}
            timezone={state.timezone}
            enabled={state.queryState.tab === 'queue'}
            refetchIntervalMs={
              state.queryState.tab === 'queue' ? state.dataState.refreshIntervalMs : false
            }
            refreshKey={state.queryState.tab === 'queue' ? state.manualRefreshNonce : 0}
            fixture={state.queryState.queueFixture}
            onRefreshStateChange={state.setQueueRefreshState}
          />
        </TabsContent>

        <TabsContent value="analytics">
          <OpsEmailDeliveryAnalytics
            summary={state.dataState.analyticsSummary}
            isLoading={state.dataState.analyticsQuery.isLoading}
            isUpdating={
              state.dataState.analyticsQuery.isFetching && !state.dataState.analyticsQuery.isLoading
            }
            range={state.queryState.range}
            onRangeChange={state.queryState.applyRange}
            errorMessage={state.analyticsErrorMessage}
            lastUpdatedAt={
              state.dataState.analyticsQuery.dataUpdatedAt > 0
                ? state.dataState.analyticsQuery.dataUpdatedAt
                : null
            }
          />
        </TabsContent>
      </Tabs>
    </OpsPageShell>
  );
}
