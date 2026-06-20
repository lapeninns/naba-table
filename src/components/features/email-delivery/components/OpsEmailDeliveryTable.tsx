'use client';

import { useCallback, useMemo, useState } from 'react';

import {
  DEFAULT_OPS_EMAIL_DELIVERY_SORT_STATE,
  getNextOpsEmailDeliverySortState,
  sortOpsEmailDeliveryTableRows,
  type OpsEmailDeliverySortColumn,
  type OpsEmailDeliverySortState,
} from '@/components/features/email-delivery/opsEmailDeliveryTableDomain';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useIsMobile } from '@/hooks/use-mobile';

import { OpsEmailDeliveryAttemptCard } from './OpsEmailDeliveryAttemptCard';
import { OpsEmailDeliveryRetryDialog } from './OpsEmailDeliveryRetryDialog';
import { renderOpsEmailDeliveryTableRows } from './OpsEmailDeliveryTableRows';
import { OpsEmailDeliveryTableSkeleton } from './OpsEmailDeliveryTableSkeleton';
import { OpsEmailDeliveryTableSortIndicator } from './OpsEmailDeliveryTableSortIndicator';

import type { OpsEmailDeliveryTableRowViewModel } from '@/components/features/email-delivery/opsEmailDeliveryTypes';

export type OpsEmailDeliveryTableProps = {
  rows: OpsEmailDeliveryTableRowViewModel[];
  timezone: string;
  restaurantId: string;
  isLoading: boolean;
  retryingAttemptKey?: string | null;
  pendingRetryRow?: OpsEmailDeliveryTableRowViewModel | null;
  isRetryDialogOpen?: boolean;
  onRetryAttempt?: (attemptKey: string) => void;
  onRetryDialogOpenChange?: (open: boolean) => void;
  onConfirmRetry?: () => void;
};

export function OpsEmailDeliveryTable({
  rows,
  timezone,
  restaurantId: _restaurantId,
  isLoading,
  retryingAttemptKey = null,
  pendingRetryRow = null,
  isRetryDialogOpen = false,
  onRetryAttempt,
  onRetryDialogOpenChange,
  onConfirmRetry,
}: OpsEmailDeliveryTableProps) {
  // ≥6 columns do not fit beside the sidebar below lg; render the attempt-card
  // list there instead (layout-system §8). JS gate keeps a single variant in the
  // DOM so accessible names stay unambiguous.
  const isBelowLg = useIsMobile(1024);
  const [sortState, setSortState] = useState<OpsEmailDeliverySortState>(
    DEFAULT_OPS_EMAIL_DELIVERY_SORT_STATE,
  );
  const [expandedKey, setExpandedKey] = useState<string | null>(null);

  const handleSort = useCallback((column: OpsEmailDeliverySortColumn) => {
    setSortState((prev) => getNextOpsEmailDeliverySortState(prev, column));
  }, []);

  const handleRowClick = useCallback((key: string) => {
    setExpandedKey((prev) => (prev === key ? null : key));
  }, []);

  const sortedRows = useMemo(
    () => sortOpsEmailDeliveryTableRows({ rows, sortState }),
    [rows, sortState],
  );

  if (isLoading && rows.length === 0) {
    if (isBelowLg) {
      return <OpsEmailDeliveryCardListSkeleton />;
    }
    return <OpsEmailDeliveryTableSkeleton />;
  }

  if (isBelowLg) {
    return (
      <>
        <div className="grid grid-cols-1 gap-3">
          {sortedRows.map((row) => (
            <OpsEmailDeliveryAttemptCard
              key={row.attemptKey}
              attempt={row.attempt}
              timezone={timezone}
              restaurantId={_restaurantId}
              canRetry={row.canRetry}
              isRetrying={retryingAttemptKey === row.attemptKey}
              onRetry={() => onRetryAttempt?.(row.attemptKey)}
            />
          ))}
        </div>

        <OpsEmailDeliveryRetryDialog
          isOpen={isRetryDialogOpen}
          onConfirmRetry={onConfirmRetry}
          onOpenChange={onRetryDialogOpenChange}
          pendingRetryRow={pendingRetryRow}
          retryingAttemptKey={retryingAttemptKey}
        />
      </>
    );
  }

  return (
    <div className="rounded-lg border border-border bg-background">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead
              className="cursor-pointer select-none"
              onClick={() => handleSort('status')}
              aria-sort={
                sortState.column === 'status'
                  ? sortState.direction === 'asc'
                    ? 'ascending'
                    : 'descending'
                  : 'none'
              }
            >
              Status
              <OpsEmailDeliveryTableSortIndicator column="status" sortState={sortState} />
            </TableHead>
            <TableHead>Subject</TableHead>
            <TableHead>Recipient</TableHead>
            <TableHead>Email Type</TableHead>
            <TableHead>Booking Ref</TableHead>
            <TableHead>Customer</TableHead>
            <TableHead
              className="cursor-pointer select-none"
              onClick={() => handleSort('sentAt')}
              aria-sort={
                sortState.column === 'sentAt'
                  ? sortState.direction === 'asc'
                    ? 'ascending'
                    : 'descending'
                  : 'none'
              }
            >
              Sent At
              <OpsEmailDeliveryTableSortIndicator column="sentAt" sortState={sortState} />
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {renderOpsEmailDeliveryTableRows({
            expandedKey,
            onRetryAttempt,
            onRowClick: handleRowClick,
            restaurantId: _restaurantId,
            rows: sortedRows,
            timezone,
          })}
        </TableBody>
      </Table>

      <OpsEmailDeliveryRetryDialog
        isOpen={isRetryDialogOpen}
        onConfirmRetry={onConfirmRetry}
        onOpenChange={onRetryDialogOpenChange}
        pendingRetryRow={pendingRetryRow}
        retryingAttemptKey={retryingAttemptKey}
      />
    </div>
  );
}

function OpsEmailDeliveryCardListSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-3">
      {Array.from({ length: 4 }).map((_, index) => (
        <Card key={`email-card-skeleton-${index}`} className="border-border/60 bg-background">
          <CardContent className="space-y-2 p-4">
            <div className="flex items-center gap-3">
              <Skeleton className="h-5 w-20 rounded-full" />
              <Skeleton className="h-4 w-44" />
            </div>
            <Skeleton className="h-3 w-56" />
            <Skeleton className="h-3 w-36" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
