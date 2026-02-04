'use client';

import { memo, useEffect, useMemo, useRef, useState } from 'react';

import { Card } from '@/components/ui/card';
import { Collapsible } from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';

import { OpsBookingCardActions } from './OpsBookingCardActions';
import { OpsBookingCardDetails } from './OpsBookingCardDetails';
import { OpsBookingCardHeader } from './OpsBookingCardHeader';
import {
  buildBookingMeta,
  getTableLabel,
  getUrgencyBadge,
} from './opsBookingCardUtils';

import type { BookingDTO } from '@/hooks/useBookings';

export type OpsBookingCardProps = {
  booking: BookingDTO;
  timezone: string;
  now?: Date;
  onEdit?: (booking: BookingDTO) => void;
  onCancel?: (booking: BookingDTO) => void;
  onDetails?: (booking: BookingDTO) => void;
  onCheckIn?: (bookingId: string) => Promise<void>;
  onCheckOut?: (bookingId: string) => Promise<void>;
  onMarkNoShow?: (bookingId: string) => Promise<void>;
  onUndoNoShow?: (bookingId: string) => Promise<void>;
  onAssignTable?: (bookingId: string, tableId: string) => Promise<BookingDTO['tableAssignments']>;
  onUnassignTable?: (bookingId: string, tableId: string) => Promise<BookingDTO['tableAssignments']>;
  pendingAction?: 'check-in' | 'check-out' | 'no-show' | 'undo-no-show' | null;
  actionsDisabled?: boolean;
  allowTableAssignments?: boolean;
  timeLabelOverride?: string | null;
  highlightUrgency?: boolean;
};

export const OpsBookingCard = memo(function OpsBookingCard({
  booking,
  timezone,
  now: propNow,
  onEdit,
  onCancel,
  onDetails,
  onCheckIn,
  onCheckOut,
  onMarkNoShow,
  pendingAction,
  actionsDisabled,
  timeLabelOverride,
  highlightUrgency = true,
}: OpsBookingCardProps) {
  const [isOpen, setIsOpen] = useState(false);
  const hasAutoExpanded = useRef(false);
  const hasUserToggled = useRef(false);
  const isMobile = useMemo(() => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia('(max-width: 639px)').matches;
  }, []);
  const now = useMemo(() => (propNow ? new Date(propNow) : new Date()), [propNow]);

  const meta = useMemo(
    () => buildBookingMeta(booking, timezone, now, timeLabelOverride),
    [booking, now, timeLabelOverride, timezone],
  );
  const urgency = useMemo(
    () => getUrgencyBadge(meta, now, highlightUrgency),
    [highlightUrgency, meta, now],
  );

  const shouldAutoExpand = urgency?.variant === 'destructive' || urgency?.label === 'Overdue';

  useEffect(() => {
    hasAutoExpanded.current = false;
    hasUserToggled.current = false;
  }, [booking.id]);

  useEffect(() => {
    if (
      !shouldAutoExpand ||
      isOpen ||
      hasAutoExpanded.current ||
      hasUserToggled.current ||
      typeof window === 'undefined'
    ) {
      return;
    }
    if (window.matchMedia('(max-width: 639px)').matches) {
      setIsOpen(true);
      hasAutoExpanded.current = true;
    }
  }, [shouldAutoExpand, isOpen]);

  const handleOpenChange = (open: boolean) => {
    hasUserToggled.current = true;
    setIsOpen(open);
  };

  const isLoading = Boolean(pendingAction);
  const isLocked = Boolean(actionsDisabled);
  const disableActions = isLoading || isLocked;
  const tableLabel = getTableLabel(booking.tableAssignments);

  const railClass = useMemo(() => {
    if (meta.isDone) return 'border-l-slate-300';
    if (meta.isSeated) return 'border-l-emerald-500';
    if (urgency?.variant === 'destructive') return 'border-l-rose-500';
    if (urgency?.variant === 'warning') return 'border-l-amber-500';
    return 'border-l-blue-600';
  }, [meta, urgency]);

  const cardBody = (
    <>
      {isLoading ? (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-white/45 backdrop-blur-[2px] motion-safe:animate-in motion-safe:fade-in motion-safe:duration-150">
          <div className="flex items-center gap-2 rounded-full border bg-white px-4 py-2 shadow-md">
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
            <span className="text-xs font-bold uppercase tracking-tighter text-slate-600">
              Updating
            </span>
          </div>
        </div>
      ) : null}

      <OpsBookingCardHeader
        booking={booking}
        meta={meta}
        urgency={urgency}
        isOpen={isOpen}
        disableActions={disableActions}
        showCollapseToggle={isMobile}
      />

      <OpsBookingCardDetails
        booking={booking}
        meta={meta}
        tableLabel={tableLabel}
        collapsible={isMobile}
      />

      <OpsBookingCardActions
        booking={booking}
        meta={meta}
        disableActions={disableActions}
        onDetails={onDetails}
        onEdit={onEdit}
        onCancel={onCancel}
        onMarkNoShow={onMarkNoShow}
        onCheckIn={onCheckIn}
        onCheckOut={onCheckOut}
      />
    </>
  );

  return (
    <Card
      className={cn(
        'group relative overflow-hidden border-l-4 transition-[transform,box-shadow,opacity] duration-200 ease-out motion-reduce:transition-none',
        railClass,
        meta.isDone ? 'opacity-75' : 'hover:shadow-md motion-safe:hover:-translate-y-0.5',
        (isLoading || isLocked) && 'pointer-events-none opacity-60',
      )}
      role="article"
      aria-labelledby={`guest-name-${booking.id}`}
    >
      {isMobile ? (
        <Collapsible open={isOpen} onOpenChange={handleOpenChange} className="w-full">
          {cardBody}
        </Collapsible>
      ) : (
        <div className="w-full">{cardBody}</div>
      )}
    </Card>
  );
});

OpsBookingCard.displayName = 'OpsBookingCard';
