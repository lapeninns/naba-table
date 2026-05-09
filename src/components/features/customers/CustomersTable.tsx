'use client';

import { useWindowVirtualizer } from '@tanstack/react-virtual';
import { Loader2 } from 'lucide-react';
import { motion, useReducedMotion } from 'motion/react';
import { useEffect, useRef } from 'react';

import { OpsEmptyState } from '@/components/features/ops-shell/patterns/OpsEmptyState';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

import { OpsGuestCard } from './OpsGuestCard';

import type { OpsGuestRowViewModel } from './opsCustomersTypes';

type CustomersTableProps = {
  rows: OpsGuestRowViewModel[];
  isLoading: boolean;
  hasActiveFilters?: boolean;
  onLoadMore?: () => void;
  hasNextPage?: boolean;
  isFetchingNextPage?: boolean;
  focusCustomerId?: string | null;
};

const skeletonRows = Array.from({ length: 5 }, (_, index) => index);

function EmptyState({ hasActiveFilters }: { hasActiveFilters?: boolean }) {
  return (
    <OpsEmptyState
      title={hasActiveFilters ? 'No guests match these filters' : 'No guests yet'}
      description={
        hasActiveFilters
          ? 'Try widening the date window or clearing filters to see more guests.'
          : 'Guests who make bookings will appear here. Their booking history will be tracked automatically.'
      }
      className="min-h-[400px]"
    />
  );
}

export function CustomersTable({
  rows,
  isLoading,
  hasActiveFilters,
  onLoadMore,
  hasNextPage = false,
  isFetchingNextPage = false,
  focusCustomerId,
}: CustomersTableProps) {
  const VIRTUALIZE_MIN_ITEMS = 24;
  const showSkeleton = isLoading && rows.length === 0;
  const showEmpty = !isLoading && rows.length === 0;
  const prefersReducedMotion = useReducedMotion();
  const hasAnimatedRef = useRef(false);

  const rowMeasureCacheRef = useRef(new Map<string, number>());
  const totalItems = hasNextPage ? rows.length + 1 : rows.length;
  const shouldVirtualize = rows.length >= VIRTUALIZE_MIN_ITEMS || hasNextPage;

  const rowVirtualizer = useWindowVirtualizer({
    count: shouldVirtualize ? totalItems : 0,
    estimateSize: (index) => {
      if (index >= rows.length) return 72;
      const id = rows[index]?.id;
      if (!id) return 220;
      return rowMeasureCacheRef.current.get(id) ?? 220;
    },
    overscan: 6,
  });

  const virtualRows = rowVirtualizer.getVirtualItems();
  const pendingFocusIdRef = useRef<string | null>(null);
  const focusRafRef = useRef<number | null>(null);

  useEffect(() => {
    if (!shouldVirtualize) return;
    rowVirtualizer.measure();
  }, [rowVirtualizer, shouldVirtualize]);

  const shouldAnimate = !prefersReducedMotion && !hasAnimatedRef.current && rows.length > 0;

  useEffect(() => {
    if (rows.length > 0) {
      hasAnimatedRef.current = true;
    }
  }, [rows.length]);

  useEffect(() => {
    if (!shouldVirtualize) return;
    if (!onLoadMore || !hasNextPage || isFetchingNextPage) {
      return;
    }
    if (rows.length === 0) return;

    const lastItem = virtualRows[virtualRows.length - 1];
    if (!lastItem) return;
    if (lastItem.index >= rows.length - 1) {
      onLoadMore();
    }
  }, [rows.length, hasNextPage, isFetchingNextPage, onLoadMore, shouldVirtualize, virtualRows]);

  useEffect(() => {
    if (!focusCustomerId || rows.length === 0) return;
    const focusLower = focusCustomerId.toLowerCase();
    const targetIndex = rows.findIndex(
      (row) => row.id === focusCustomerId || row.emailSearchValue === focusLower,
    );
    if (targetIndex < 0) return;

    const targetId = rows[targetIndex]?.id;
    if (!targetId) return;
    pendingFocusIdRef.current = targetId;

    if (shouldVirtualize) {
      rowVirtualizer.scrollToIndex(targetIndex, { align: 'center' });
    }

    const tryFocus = () => {
      if (!pendingFocusIdRef.current) return true;
      const selector = `[data-customer-id="${pendingFocusIdRef.current}"]`;
      const target = document.querySelector<HTMLElement>(selector);
      if (!target) return false;

      if (!shouldVirtualize) {
        target.scrollIntoView({ block: 'center' });
      }

      target.focus({ preventScroll: shouldVirtualize });
      if (document.activeElement === target) {
        pendingFocusIdRef.current = null;
        return true;
      }
      return false;
    };

    if (focusRafRef.current) {
      cancelAnimationFrame(focusRafRef.current);
    }

    let attempts = 0;
    const maxAttempts = 30;
    const tick = () => {
      attempts += 1;
      if (tryFocus() || attempts >= maxAttempts) {
        focusRafRef.current = null;
        return;
      }
      focusRafRef.current = requestAnimationFrame(tick);
    };
    focusRafRef.current = requestAnimationFrame(tick);

    return () => {
      if (focusRafRef.current) {
        cancelAnimationFrame(focusRafRef.current);
        focusRafRef.current = null;
      }
    };
  }, [rows, focusCustomerId, rowVirtualizer, shouldVirtualize]);

  return (
    <div className="space-y-4">
      {showSkeleton ? (
        <div className="grid grid-cols-1 gap-3">
          {skeletonRows.map((row) => (
            <Card
              key={`guest-skeleton-${row}`}
              className="rounded-xl border-border/60 bg-card/40 p-4"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1 space-y-2">
                  <Skeleton className="h-4 w-48" />
                  <Skeleton className="h-3 w-40" />
                  <div className="grid grid-cols-2 gap-2">
                    <Skeleton className="h-10 w-full" />
                    <Skeleton className="h-10 w-full" />
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Skeleton className="size-9 rounded-md" />
                  <Skeleton className="h-9 w-20" />
                </div>
              </div>
            </Card>
          ))}
        </div>
      ) : showEmpty ? (
        <EmptyState hasActiveFilters={hasActiveFilters} />
      ) : shouldVirtualize ? (
        <motion.div
          className="relative"
          initial={shouldAnimate ? { opacity: 0 } : false}
          animate={{ opacity: 1 }}
          transition={shouldAnimate ? { duration: 0.2, ease: 'easeOut' } : undefined}
        >
          <div className="relative" style={{ height: `${rowVirtualizer.getTotalSize()}px` }}>
            {virtualRows.map((virtualRow) => {
              if (virtualRow.index >= rows.length) {
                return (
                  <div
                    key={virtualRow.key}
                    data-index={virtualRow.index}
                    ref={rowVirtualizer.measureElement}
                    className="absolute left-0 top-0 w-full"
                    style={{ transform: `translateY(${virtualRow.start}px)` }}
                  >
                    <div className="flex items-center justify-center gap-2 py-3 text-xs font-medium text-muted-foreground">
                      {isFetchingNextPage ? (
                        <Loader2 className="size-3.5 animate-spin" aria-hidden />
                      ) : null}
                      <span>
                        {isFetchingNextPage ? 'Loading more guests...' : 'Scroll to load more'}
                      </span>
                    </div>
                  </div>
                );
              }

              const row = rows[virtualRow.index];
              if (!row) return null;

              return (
                <div
                  key={virtualRow.key}
                  data-index={virtualRow.index}
                  ref={(node) => {
                    rowVirtualizer.measureElement(node);
                    if (node) {
                      const height = node.getBoundingClientRect().height;
                      const cached = rowMeasureCacheRef.current.get(row.id);
                      if (!cached || Math.abs(cached - height) > 1) {
                        rowMeasureCacheRef.current.set(row.id, height);
                      }

                      if (pendingFocusIdRef.current === row.id) {
                        const target = node.querySelector<HTMLElement>(
                          `[data-customer-id="${row.id}"]`,
                        );
                        if (target) {
                          target.focus({ preventScroll: true });
                          if (document.activeElement === target) {
                            pendingFocusIdRef.current = null;
                          }
                        }
                      }
                    }
                  }}
                  className="absolute left-0 top-0 w-full pb-3 will-change-transform"
                  style={{ transform: `translate3d(0, ${virtualRow.start}px, 0)` }}
                >
                  <OpsGuestCard guest={row} />
                </div>
              );
            })}
          </div>
        </motion.div>
      ) : (
        <motion.div
          className="space-y-3"
          initial={shouldAnimate ? { opacity: 0 } : false}
          animate={{ opacity: 1 }}
          transition={shouldAnimate ? { duration: 0.2, ease: 'easeOut' } : undefined}
        >
          {rows.map((row) => (
            <div key={row.id} className="pb-3">
              <OpsGuestCard guest={row} />
            </div>
          ))}
        </motion.div>
      )}
    </div>
  );
}
