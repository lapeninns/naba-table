'use client';

import { memo, useCallback, useEffect, useMemo, useState } from 'react';

import { Card } from '@/components/ui/card';
import { Collapsible } from '@/components/ui/collapsible';
import { getOpsBookingStatusUi } from '@/lib/ops/booking-status';
import { cn } from '@/lib/utils';
import { useMinimumDelay } from '@src/hooks/use-minimum-delay';
import { useMediaQuery } from '@src/hooks/useMediaQuery';

import { OpsBookingCardActions } from './OpsBookingCardActions';
import { OpsBookingCardDetails } from './OpsBookingCardDetails';
import { OpsBookingCardHeader } from './OpsBookingCardHeader';

import type { OpsBookingCardViewModel } from './opsBookingCardUtils';

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
  const {
    booking,
    meta,
    pendingAction,
    disableActions: viewDisabled,
    header,
    details,
    actions,
  } = viewModel;
  const [isOpen, setIsOpen] = useState(false);
  const isMobile = useMediaQuery('(max-width: 639px)');

  useEffect(() => {
    if (!booking.id) return;
    // Default to closed whenever the row re-renders for a different booking.
    // This prevents unexpected auto-expansion in a virtualized list.
    setIsOpen(false);
  }, [booking.id]);

  const handleOpenChange = (open: boolean) => {
    setIsOpen(open);
  };

  const isLoading = Boolean(actions.pendingAction);
  const showLoading = useMinimumDelay(isLoading, { delayMs: 200, minDurationMs: 400 });
  const isVisuallyDisabled = Boolean(viewDisabled) && pendingAction === null;

  const railClass = useMemo(() => {
    const ui = getOpsBookingStatusUi(booking.status);
    // Urgency is a contextual override on top of status rails.
    if (header.urgency?.variant === 'destructive') return 'border-l-rose-400';
    if (header.urgency?.variant === 'warning') return 'border-l-amber-400/70';
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

  const cardBody = (
    <>
      {/* Keep content visible while actions are pending; pending state is communicated via disabled controls + button-level spinners. */}

      <OpsBookingCardHeader
        header={header}
        isOpen={isOpen}
        showCollapseToggle={isMobile}
      />

      <OpsBookingCardDetails details={details} />

      <OpsBookingCardActions
        actions={actions}
        onDetails={handleDetails}
        onEdit={handleEdit}
        onCancel={handleCancel}
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
        (showLoading || isVisuallyDisabled) && 'opacity-60',
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
