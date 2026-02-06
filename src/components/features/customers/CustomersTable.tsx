'use client';

import { useWindowVirtualizer } from '@tanstack/react-virtual';
import { Loader2 } from 'lucide-react';
import { motion, useReducedMotion } from 'motion/react';
import { useEffect, useRef } from 'react';

import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

import { OpsGuestCard } from './OpsGuestCard';

import type { OpsCustomer } from '@/types/ops';

type CustomersTableProps = {
  customers: OpsCustomer[];
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
    <div className="flex min-h-[400px] items-center justify-center rounded-lg border border-dashed border-border/60 bg-muted/20 p-8 text-center">
      <div className="max-w-md">
        <h3 className="text-lg font-semibold text-foreground">
          {hasActiveFilters ? 'No guests match these filters' : 'No guests yet'}
        </h3>
        <p className="mt-2 text-sm text-muted-foreground">
          {hasActiveFilters
            ? 'Try widening the date window or clearing filters to see more guests.'
            : 'Guests who make bookings will appear here. Their booking history will be tracked automatically.'}
        </p>
      </div>
    </div>
  );
}

export function CustomersTable({
  customers,
  isLoading,
  hasActiveFilters,
  onLoadMore,
  hasNextPage = false,
  isFetchingNextPage = false,
  focusCustomerId,
}: CustomersTableProps) {
  const VIRTUALIZE_MIN_ITEMS = 24;
  const showSkeleton = isLoading && customers.length === 0;
  const showEmpty = !isLoading && customers.length === 0;
  const prefersReducedMotion = useReducedMotion();
  const hasAnimatedRef = useRef(false);

  const rowMeasureCacheRef = useRef(new Map<string, number>());
  const totalItems = hasNextPage ? customers.length + 1 : customers.length;
  const shouldVirtualize = customers.length >= VIRTUALIZE_MIN_ITEMS || hasNextPage;

  const rowVirtualizer = useWindowVirtualizer({
    count: shouldVirtualize ? totalItems : 0,
    estimateSize: (index) => {
      if (index >= customers.length) return 72;
      const id = customers[index]?.id;
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

  const shouldAnimate = !prefersReducedMotion && !hasAnimatedRef.current && customers.length > 0;

  useEffect(() => {
    if (customers.length > 0) {
      hasAnimatedRef.current = true;
    }
  }, [customers.length]);

  useEffect(() => {
    if (!shouldVirtualize) return;
    if (!onLoadMore || !hasNextPage || isFetchingNextPage) {
      return;
    }
    if (customers.length === 0) return;
    const lastItem = virtualRows[virtualRows.length - 1];
    if (!lastItem) return;
    if (lastItem.index >= customers.length - 1) {
      onLoadMore();
    }
  }, [
    customers.length,
    hasNextPage,
    isFetchingNextPage,
    onLoadMore,
    shouldVirtualize,
    virtualRows,
  ]);

  useEffect(() => {
    if (!focusCustomerId || customers.length === 0) return;
    const focusLower = focusCustomerId.toLowerCase();
    const targetIndex = customers.findIndex(
      (customer) =>
        customer.id === focusCustomerId ||
        (customer.email ?? '').toLowerCase() === focusLower,
    );
    if (targetIndex < 0) return;
    const targetId = customers[targetIndex]?.id;
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

      // Ensure the target is visible in the viewport for context (non-virtualized fallback).
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

    // `scrollToIndex` in window virtualization is async; retry focus across a few frames.
    if (focusRafRef.current) {
      cancelAnimationFrame(focusRafRef.current);
    }
    let attempts = 0;
    const maxAttempts = 30; // ~500ms on 60fps displays
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
  }, [customers, focusCustomerId, rowVirtualizer, shouldVirtualize]);

  return (
    <div className="space-y-4">
      {showSkeleton ? (
        <div className="grid grid-cols-1 gap-3">
          {skeletonRows.map((row) => (
            <Card key={`guest-skeleton-${row}`} className="rounded-xl border-border/60 bg-card/40 p-4">
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
                  <Skeleton className="h-9 w-9 rounded-md" />
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
              if (virtualRow.index >= customers.length) {
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
                        <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                      ) : null}
                      <span>
                        {isFetchingNextPage ? 'Loading more guests...' : 'Scroll to load more'}
                      </span>
                    </div>
                  </div>
                );
              }

              const customer = customers[virtualRow.index];
              if (!customer) return null;

              return (
                <div
                  key={virtualRow.key}
                  data-index={virtualRow.index}
                  ref={(node) => {
                    rowVirtualizer.measureElement(node);
                    if (node) {
                      const height = node.getBoundingClientRect().height;
                      const cached = rowMeasureCacheRef.current.get(customer.id);
                      if (!cached || Math.abs(cached - height) > 1) {
                        rowMeasureCacheRef.current.set(customer.id, height);
                      }

                      // If we're waiting to focus this guest, focus as soon as the row mounts.
                      if (pendingFocusIdRef.current === customer.id) {
                        const target = node.querySelector<HTMLElement>(`[data-customer-id="${customer.id}"]`);
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
                  <OpsGuestCard customer={customer} />
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
          {customers.map((customer) => (
            <div key={customer.id} className="pb-3">
              <OpsGuestCard customer={customer} />
            </div>
          ))}
        </motion.div>
      )}
    </div>
  );
}
