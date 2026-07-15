'use client';

import { AlertCircle, ChevronLeft, ChevronRight, MailWarning, RotateCcw } from 'lucide-react';

import { OpsEmailDeliveryFilterBar } from '@/components/features/email-delivery/components/OpsEmailDeliveryFilterBar';
import { OpsEmailDeliveryTable } from '@/components/features/email-delivery/components/OpsEmailDeliveryTable';
import { OPS_EMAIL_DELIVERY_PAGE_SIZE_OPTIONS } from '@/components/features/email-delivery/opsEmailDeliveryTypes';
import { OpsPageToolbar } from '@/components/features/ops-shell/patterns/OpsPageToolbar';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { StaleBoundary } from '@/components/ui/stale-boundary';
import { getSwrUiState } from '@/lib/query/swrUiState';

import type { OpsEmailDeliveryState } from '@/components/features/email-delivery/useOpsEmailDeliveryState';

export function OpsEmailDeliveryLogTab({ state }: { state: OpsEmailDeliveryState }) {
  // Param-change stale state (filters/range/page) per docs/technical/react-query-swr-ux.md.
  const swr = getSwrUiState(state.dataState.feedQuery);
  return (
    <>
      <OpsPageToolbar className="space-y-4">
        {state.canInjectDeliveryLogError ? (
          <Alert className="border-dashed border-border bg-muted/40">
            <AlertCircle className="size-4" aria-hidden />
            <AlertTitle>Dev/test validation control</AlertTitle>
            <AlertDescription className="space-y-3">
              <p>
                To surface the Delivery Log error alert for validation, append{' '}
                <code>messageId={state.DELIVERY_LOG_FAULT_INJECTION_MESSAGE_ID}</code> to this dev
                harness URL or choose Message ID in the search field and submit that exact value.
              </p>
              <p className="text-xs text-muted-foreground">
                This fault injection path is only enabled for dev/test contexts and is ignored on
                production surfaces.
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
            <MailWarning className="size-4" aria-hidden />
            <AlertTitle>Delivery tracking unavailable</AlertTitle>
            <AlertDescription>
              This environment is not currently recording or exposing delivery events. Email sending
              can still work normally.
            </AlertDescription>
          </Alert>
        ) : state.effectiveDeliveryLogErrorMessage ? (
          <Alert variant="destructive">
            <AlertCircle className="size-4" aria-hidden />
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
                <RotateCcw data-icon="inline-start" aria-hidden />
                Retry
              </Button>
            </AlertDescription>
          </Alert>
        ) : (
          /* Filter bar and pagination stay outside; only the table body dims. */
          <StaleBoundary isStale={swr.isPlaceholderStale}>
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
          </StaleBoundary>
        )}

        {state.shouldShowEmptyGuidance ? <OpsEmailDeliveryEmptyGuidance /> : null}
        {state.shouldShowPagination ? <OpsEmailDeliveryPagination state={state} /> : null}
      </section>
    </>
  );
}

function OpsEmailDeliveryEmptyGuidance() {
  return (
    <div className="rounded-lg border border-border bg-background p-8 text-center">
      <p className="text-base font-semibold text-foreground">No email deliveries found</p>
      <p className="mt-2 text-sm text-muted-foreground">
        Adjust the filters or try a wider date range to see more results.
      </p>
    </div>
  );
}

function OpsEmailDeliveryPagination({ state }: { state: OpsEmailDeliveryState }) {
  return (
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
              if (!Number.isFinite(nextPageSize) || nextPageSize === state.queryState.pageSize) {
                return;
              }
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
            <ChevronLeft data-icon="inline-start" aria-hidden />
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
            <ChevronRight data-icon="inline-end" aria-hidden />
          </Button>
        </div>
      </div>
    </div>
  );
}
