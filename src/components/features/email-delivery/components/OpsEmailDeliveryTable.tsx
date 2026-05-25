'use client';

import { useCallback, useMemo, useState } from 'react';

import {
  DEFAULT_OPS_EMAIL_DELIVERY_SORT_STATE,
  getNextOpsEmailDeliverySortState,
  sortOpsEmailDeliveryTableRows,
  type OpsEmailDeliverySortColumn,
  type OpsEmailDeliverySortState,
} from '@/components/features/email-delivery/opsEmailDeliveryTableDomain';
import { Table, TableBody, TableHead, TableHeader, TableRow } from '@/components/ui/table';

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
    return <OpsEmailDeliveryTableSkeleton />;
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
