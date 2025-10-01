'use client';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export type PaginationProps = {
  page: number;
  pageSize: number;
  total: number;
  isLoading?: boolean;
  onPageChange: (page: number) => void;
};

export function Pagination({ page, pageSize, total, isLoading = false, onPageChange }: PaginationProps) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const hasPrev = page > 1;
  const hasNext = page < totalPages;

  const start = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const end = total === 0 ? 0 : Math.min(page * pageSize, total);

  return (
    <nav
      className="flex items-center justify-between gap-4 border-t border-border pt-4"
      aria-label="Bookings pagination"
    >
      <p className="text-sm text-muted-foreground" aria-live="polite" aria-atomic="true">
        {total === 0 ? (
          <>
            Showing <span className="font-medium text-foreground">0</span> of{' '}
            <span className="font-medium text-foreground">0</span> bookings
          </>
        ) : (
          <>
            Showing{' '}
            <span className="font-medium text-foreground">{start}</span>
            {' - '}
            <span className="font-medium text-foreground">{end}</span> of{' '}
            <span className="font-medium text-foreground">{total}</span> bookings
          </>
        )}
        {isLoading ? ' (updating...)' : ''}
      </p>
      <div className="flex items-center gap-2">
        <Button
          type="button"
          size="sm"
          variant="outline"
          className={cn('min-w-[96px]')}
          onClick={() => onPageChange(page - 1)}
          disabled={!hasPrev || isLoading}
        >
          Previous
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className={cn('min-w-[96px]')}
          onClick={() => onPageChange(page + 1)}
          disabled={!hasNext || isLoading}
        >
          Next
        </Button>
      </div>
    </nav>
  );
}
