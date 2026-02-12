'use client';

import { memo, useEffect, useMemo, useState } from 'react';

import { Card } from '@/components/ui/card';
import { Collapsible } from '@/components/ui/collapsible';
import { useMinimumDelay } from '@/hooks/use-minimum-delay';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { getOpsBookingStatusUi } from '@/lib/ops/booking-status';
import { cn } from '@/lib/utils';

import { OpsBookingCardActions } from './OpsBookingCardActions';
import { OpsBookingCardDetails } from './OpsBookingCardDetails';
import { OpsBookingCardHeader } from './OpsBookingCardHeader';
import { buildBookingMeta, getTableLabel, getUrgencyBadge } from './opsBookingCardUtils';

import type { BookingDTO } from '@/hooks/useBookings';
import type { OpsBookingStatus } from '@/types/ops';

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
  const isMobile = useMediaQuery('(max-width: 639px)');
  const now = useMemo(() => (propNow ? new Date(propNow) : new Date()), [propNow]);

  const meta = useMemo(
    () => buildBookingMeta(booking, timezone, now, timeLabelOverride),
    [booking, now, timeLabelOverride, timezone],
  );
  const urgency = useMemo(
    () => getUrgencyBadge(meta, now, highlightUrgency),
    [highlightUrgency, meta, now],
  );

  useEffect(() => {
    if (!booking.id) return;
    // Default to closed whenever the row re-renders for a different booking.
    // This prevents unexpected auto-expansion in a virtualized list.
    setIsOpen(false);
  }, [booking.id]);

  const handleOpenChange = (open: boolean) => {
    setIsOpen(open);
  };

  const isLoading = Boolean(pendingAction);
  const showLoading = useMinimumDelay(isLoading, { delayMs: 200, minDurationMs: 400 });
  const isLocked = Boolean(actionsDisabled);
  const disableActions = isLoading || isLocked;
  const tableLabel = getTableLabel(booking.tableAssignments);

  const railClass = useMemo(() => {
    const ui = getOpsBookingStatusUi(booking.status as OpsBookingStatus);
    // Urgency is a contextual override on top of status rails.
    if (urgency?.variant === 'destructive') return 'border-l-rose-400';
    if (urgency?.variant === 'warning') return 'border-l-amber-400/70';
    return ui.railClass;
  }, [booking.status, urgency?.variant]);

  const cardBody = (
    <>
      {/* Keep content visible while actions are pending; pending state is communicated via disabled controls + button-level spinners. */}

      <OpsBookingCardHeader
        booking={booking}
        meta={meta}
        urgency={urgency}
        isOpen={isOpen}
        disableActions={disableActions}
        showCollapseToggle={isMobile}
      />

      <OpsBookingCardDetails booking={booking} meta={meta} tableLabel={tableLabel} />

      <OpsBookingCardActions
        booking={booking}
        meta={meta}
        disableActions={disableActions}
        pendingAction={pendingAction ?? null}
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
        'group relative overflow-hidden border-l-[3px] transition-shadow duration-200 ease-out hover:shadow-md motion-reduce:transition-none',
        railClass,
        meta.isDone && 'opacity-60',
        isLocked && 'pointer-events-none',
        (showLoading || isLocked) && 'opacity-60',
      )}
      role="article"
      aria-labelledby={`guest-name-${booking.id}`}
      aria-busy={showLoading}
    >
      <Collapsible open={isOpen} onOpenChange={handleOpenChange} className="w-full">
        {cardBody}
      </Collapsible>
    </Card>
  );
});

OpsBookingCard.displayName = 'OpsBookingCard';
