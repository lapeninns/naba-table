import { ChevronDown, RotateCcw } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { TableCell, TableRow } from '@/components/ui/table';
import { cn } from '@/lib/utils';

import { OpsEmailDeliveryStatusBadge } from './OpsEmailDeliveryStatusBadge';
import { OpsEmailDeliveryTableDetail } from './OpsEmailDeliveryTableDetail';

import type { OpsEmailDeliveryTableRowViewModel } from '@/components/features/email-delivery/opsEmailDeliveryTypes';
import type { ReactNode } from 'react';

export function renderOpsEmailDeliveryTableRows({
  expandedKey,
  onRetryAttempt,
  onRowClick,
  restaurantId,
  rows,
  timezone,
}: {
  expandedKey: string | null;
  onRetryAttempt?: (attemptKey: string) => void;
  onRowClick: (key: string) => void;
  restaurantId: string;
  rows: OpsEmailDeliveryTableRowViewModel[];
  timezone: string;
}): ReactNode[] {
  return rows.flatMap((row) => {
    const key = row.attemptKey;
    const attempt = row.attempt;
    const isExpanded = expandedKey === key;

    const renderedRows: ReactNode[] = [
      <TableRow
        key={key}
        className={cn('cursor-pointer', isExpanded && 'bg-muted/30')}
        onClick={() => onRowClick(key)}
        data-state={isExpanded ? 'expanded' : undefined}
      >
        <TableCell>
          <OpsEmailDeliveryStatusBadge status={attempt.currentStatus} />
        </TableCell>
        <TableCell>
          <span className="truncate text-sm font-medium" title={row.subject}>
            {row.subject}
          </span>
        </TableCell>
        <TableCell>
          <span className="truncate text-xs" title={row.recipientEmail}>
            {row.recipientEmail}
          </span>
        </TableCell>
        <TableCell>
          <span className="text-xs text-muted-foreground">{row.emailType ?? '—'}</span>
        </TableCell>
        <TableCell>
          <span className="font-mono text-xs">{row.bookingReference ?? '—'}</span>
        </TableCell>
        <TableCell>
          <span className="text-xs">{row.customerName ?? '—'}</span>
        </TableCell>
        <TableCell>
          <div className="flex items-center justify-between gap-2">
            <span className="whitespace-nowrap text-xs text-muted-foreground">
              {row.sentAtLabel ?? '—'}
            </span>
            <div className="flex items-center gap-1">
              {row.canRetry ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-7 px-2 text-xs"
                  aria-label={`Retry email for ${attempt.recipientEmail}`}
                  onClick={(event) => {
                    event.stopPropagation();
                    onRetryAttempt?.(key);
                  }}
                >
                  <RotateCcw data-icon="inline-start" aria-hidden />
                  Retry
                </Button>
              ) : null}
              <ChevronDown
                className={cn(
                  'size-3 text-muted-foreground transition-transform',
                  isExpanded && 'rotate-180',
                )}
                aria-hidden
              />
            </div>
          </div>
        </TableCell>
      </TableRow>,
    ];

    if (isExpanded) {
      renderedRows.push(
        <TableRow key={`${key}__detail`} className="hover:bg-transparent">
          <TableCell colSpan={7} className="p-0">
            <OpsEmailDeliveryTableDetail
              attempt={attempt}
              timezone={timezone}
              restaurantId={restaurantId}
            />
          </TableCell>
        </TableRow>,
      );
    }

    return renderedRows;
  });
}
