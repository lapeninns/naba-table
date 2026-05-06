'use client';

import { useQueryClient, type QueryClient } from '@tanstack/react-query';
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { Card } from '@/components/ui/card';
import { Collapsible, CollapsibleTrigger } from '@/components/ui/collapsible';
import { useBookingService } from '@/contexts/ops-services';
import { getOpsBookingStatusUi } from '@/lib/ops/booking-status';
import { queryKeys } from '@/lib/query/keys';
import { cn } from '@/lib/utils';
import { useMinimumDelay } from '@src/hooks/use-minimum-delay';

import { OpsBookingCardActions } from './OpsBookingCardActions';
import { OpsBookingCardDetails } from './OpsBookingCardDetails';
import { OpsBookingCardHeader } from './OpsBookingCardHeader';
import { getDashboardPerfStart, recordDashboardPerfMetric } from '../list/performance';

import type { OpsBookingCardViewModel } from './opsBookingCardUtils';

const PREFETCH_DELAY_MS = 180;
const PREFETCH_THROTTLE_MS = 30_000;
const MAX_ACTIVE_PREFETCHES = 2;

type PrefetchTask = {
  cancelled: boolean;
  run: () => Promise<void>;
};

let activePrefetches = 0;
const queuedPrefetches: PrefetchTask[] = [];
const lastPrefetchAtByBookingId = new Map<string, number>();

function drainPrefetchQueue() {
  while (activePrefetches < MAX_ACTIVE_PREFETCHES && queuedPrefetches.length > 0) {
    const task = queuedPrefetches.shift();
    if (!task || task.cancelled) continue;

    activePrefetches += 1;
    void task.run().finally(() => {
      activePrefetches = Math.max(0, activePrefetches - 1);
      drainPrefetchQueue();
    });
  }
}

function enqueuePrefetchTask(task: PrefetchTask) {
  queuedPrefetches.push(task);
  drainPrefetchQueue();
}

function shouldPrefetchBooking(bookingId: string) {
  const now = Date.now();
  const lastPrefetchAt = lastPrefetchAtByBookingId.get(bookingId) ?? 0;
  if (now - lastPrefetchAt < PREFETCH_THROTTLE_MS) return false;
  lastPrefetchAtByBookingId.set(bookingId, now);
  return true;
}

function prefetchDialogBundle(params: {
  bookingId: string;
  bookingService: ReturnType<typeof useBookingService>;
  queryClient: QueryClient;
}) {
  const { bookingId, bookingService, queryClient } = params;
  return queryClient.prefetchQuery({
    queryKey: ['ops', 'bookings', 'dialog', bookingId] as const,
    queryFn: async () => {
      const bundle = await bookingService.getDialogBundle(bookingId);
      queryClient.setQueryData(queryKeys.opsBookings.detail(bookingId), bundle.booking);
      queryClient.setQueryData(
        queryKeys.opsBookings.assignmentContext(bookingId),
        bundle.assignmentContext,
      );
      return bundle;
    },
    staleTime: 30_000,
  });
}

export type OpsBookingCardProps = {
  viewModel: OpsBookingCardViewModel;
  onEdit?: (bookingId: string) => void;
  onCancel?: (bookingId: string) => void;
  onDetails?: (bookingId: string) => void;
  onCheckIn?: (bookingId: string) => Promise<void>;
  onCheckOut?: (bookingId: string) => Promise<void>;
  onMarkNoShow?: (bookingId: string) => Promise<void>;
};

export const OpsBookingCard = memo(function OpsBookingCard({
  viewModel,
  onEdit,
  onCancel,
  onDetails,
  onCheckIn,
  onCheckOut,
  onMarkNoShow,
}: OpsBookingCardProps) {
  const { booking, meta, disableActions: viewDisabled, header, details, actions } = viewModel;
  const [isOpen, setIsOpen] = useState(false);
  const queryClient = useQueryClient();
  const bookingService = useBookingService();
  const prefetchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const queuedPrefetchRef = useRef<PrefetchTask | null>(null);
  const renderStartedAtRef = useRef(getDashboardPerfStart());
  renderStartedAtRef.current = getDashboardPerfStart();

  useEffect(() => {
    if (!booking.id) return;
    // Default to closed whenever the row re-renders for a different booking.
    // This prevents unexpected auto-expansion in a virtualized list.
    setIsOpen(false);
  }, [booking.id]);

  useEffect(() => {
    recordDashboardPerfMetric('ops-dashboard.card.commit', renderStartedAtRef.current, {
      bookingId: booking.id,
      status: booking.status,
      pending: Boolean(actions.pendingAction),
    });
  });

  const handleOpenChange = (open: boolean) => {
    setIsOpen(open);
  };

  const isLoading = Boolean(actions.pendingAction);
  const showLoading = useMinimumDelay(isLoading, { delayMs: 200, minDurationMs: 400 });
  const isInteractionLocked = Boolean(viewDisabled);

  const railClass = useMemo(() => {
    const ui = getOpsBookingStatusUi(booking.status);
    // Urgency is a contextual override on top of status rails.
    if (header.urgency?.variant === 'destructive') return 'border-l-destructive';
    if (header.urgency?.variant === 'warning') return 'border-l-primary';
    return ui.railClass;
  }, [booking.status, header.urgency?.variant]);

  const handleDetails = useCallback(() => {
    onDetails?.(booking.id);
  }, [booking.id, onDetails]);

  const handleEdit = useCallback(() => {
    onEdit?.(booking.id);
  }, [booking.id, onEdit]);

  const handleCancel = useCallback(() => {
    onCancel?.(booking.id);
  }, [booking.id, onCancel]);

  const cancelPendingPrefetch = useCallback(() => {
    if (prefetchTimerRef.current) {
      clearTimeout(prefetchTimerRef.current);
      prefetchTimerRef.current = null;
    }
    if (queuedPrefetchRef.current) {
      queuedPrefetchRef.current.cancelled = true;
      queuedPrefetchRef.current = null;
    }
  }, []);

  useEffect(() => cancelPendingPrefetch, [cancelPendingPrefetch]);

  const handlePrefetch = useCallback(() => {
    if (!booking.id) return;
    cancelPendingPrefetch();

    prefetchTimerRef.current = setTimeout(() => {
      prefetchTimerRef.current = null;
      if (!shouldPrefetchBooking(booking.id)) return;

      const task: PrefetchTask = {
        cancelled: false,
        run: () =>
          prefetchDialogBundle({
            bookingId: booking.id,
            bookingService,
            queryClient,
          }).then(() => undefined),
      };
      queuedPrefetchRef.current = task;
      enqueuePrefetchTask(task);
    }, PREFETCH_DELAY_MS);
  }, [booking.id, bookingService, cancelPendingPrefetch, queryClient]);

  return (
    <Card
      className={cn(
        'group relative overflow-hidden border-l-[3px] transition-shadow duration-200 ease-out sm:hover:shadow-md motion-reduce:transition-none',
        railClass,
        meta.isDone && 'opacity-60',
        isInteractionLocked && 'pointer-events-none opacity-60',
        showLoading && 'opacity-60',
      )}
      aria-labelledby={`guest-name-${booking.id}`}
      aria-busy={showLoading}
      aria-disabled={isInteractionLocked || undefined}
      onMouseEnter={handlePrefetch}
      onMouseLeave={cancelPendingPrefetch}
    >
      <Collapsible open={isOpen} onOpenChange={handleOpenChange} className="w-full">
        {/* Mobile: entire header+details region is the expand trigger.
            sm+: CollapsibleTrigger becomes pointer-events-none so details are always visible. */}
        <CollapsibleTrigger asChild>
          <div
            role="button"
            tabIndex={0}
            aria-expanded={isOpen}
            aria-controls={`ops-booking-details-${booking.id}`}
            className={cn(
              'w-full cursor-pointer select-none text-left',
              'active:bg-muted/30',
              // On sm+ the trigger becomes inert — details are always shown
              'sm:cursor-default sm:select-text sm:pointer-events-none sm:active:bg-transparent',
            )}
          >
            {/* Keep content visible while actions are pending; pending state is communicated via disabled controls + button-level spinners. */}
            <OpsBookingCardHeader
              header={header}
              table={details.table}
              isOpen={isOpen}
              showCollapseToggle={false}
              disableCollapseToggle={isInteractionLocked}
            />

            <OpsBookingCardDetails details={details} />
          </div>
        </CollapsibleTrigger>

        {/* Action footer lives outside the trigger so its buttons stay independently tappable. */}
        <OpsBookingCardActions
          actions={actions}
          onDetails={handleDetails}
          onEdit={handleEdit}
          onCancel={handleCancel}
          onMarkNoShow={onMarkNoShow}
          onCheckIn={onCheckIn}
          onCheckOut={onCheckOut}
        />
      </Collapsible>
    </Card>
  );
});

OpsBookingCard.displayName = 'OpsBookingCard';
