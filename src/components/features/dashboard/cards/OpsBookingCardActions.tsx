'use client';

import {
  Check,
  LogIn,
  LogOut,
  MoreHorizontal,
  Loader2,
} from 'lucide-react';
import { memo, useCallback, useState } from 'react';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';

import type { BookingMeta } from './opsBookingCardUtils';
import type { BookingDTO } from '@/hooks/useBookings';

export type OpsBookingCardActionsProps = {
  booking: BookingDTO;
  meta: BookingMeta;
  disableActions: boolean;
  pendingAction?: 'check-in' | 'check-out' | 'no-show' | 'undo-no-show' | null;
  onDetails?: (booking: BookingDTO) => void;
  onEdit?: (booking: BookingDTO) => void;
  onCancel?: (booking: BookingDTO) => void;
  onMarkNoShow?: (bookingId: string) => Promise<void>;
  onCheckIn?: (bookingId: string) => Promise<void>;
  onCheckOut?: (bookingId: string) => Promise<void>;
};

export const OpsBookingCardActions = memo(function OpsBookingCardActions({
  booking,
  meta,
  disableActions,
  pendingAction = null,
  onDetails,
  onEdit,
  onCancel,
  onMarkNoShow,
  onCheckIn,
  onCheckOut,
}: OpsBookingCardActionsProps) {
  const isLifecyclePending = pendingAction === 'check-in' || pendingAction === 'check-out';
  const isNoShowPending = pendingAction === 'no-show';
  const [isNoShowOpen, setIsNoShowOpen] = useState(false);

  const handleConfirmNoShow = useCallback(async () => {
    try {
      await onMarkNoShow?.(booking.id);
    } finally {
      setIsNoShowOpen(false);
    }
  }, [booking.id, onMarkNoShow]);

  return (
    <div className="px-4 pb-4">
      <div className="flex flex-wrap items-center justify-between gap-y-3 border-t border-border/60 pt-3">
        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="sm"
            className="h-11 px-4 text-xs font-medium focus-visible:ring-2 focus-visible:ring-ring sm:h-8"
            onClick={() => onDetails?.(booking)}
            disabled={disableActions}
          >
            Details
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-11 w-11 p-0 focus-visible:ring-2 focus-visible:ring-ring sm:h-8 sm:w-8"
                aria-label="More actions"
                disabled={disableActions}
              >
                <MoreHorizontal className="h-4 w-4" aria-hidden />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              <DropdownMenuLabel className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                Manage
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => onEdit?.(booking)}
                disabled={disableActions || meta.isPastDay}
              >
                Edit Booking
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => setIsNoShowOpen(true)}
                disabled={disableActions || !meta.isToday || meta.isSeated}
                variant="destructive"
              >
                Mark No Show
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => onCancel?.(booking)}
                disabled={disableActions || meta.isPastDay}
                variant="destructive"
              >
                Cancel Booking
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <div>
          {!meta.isDone ? (
            <Button
              size="sm"
              disabled={!meta.isToday || disableActions || isLifecyclePending}
              className={cn(
                'h-11 min-w-[120px] px-6 font-semibold text-white shadow-sm transition-[box-shadow,background-color] duration-150 ease-out hover:shadow-sm motion-reduce:transition-none sm:h-9',
                meta.isSeated ? 'bg-slate-700 hover:bg-slate-800' : 'bg-emerald-600 hover:bg-emerald-700',
              )}
              onClick={() =>
                meta.isSeated ? onCheckOut?.(booking.id) : onCheckIn?.(booking.id)
              }
            >
              {isLifecyclePending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden /> Updating…
                </>
              ) : meta.isSeated ? (
                <>
                  <LogOut className="mr-2 h-4 w-4" aria-hidden /> Finish
                </>
              ) : (
                <>
                  <LogIn className="mr-2 h-4 w-4" aria-hidden /> Seat Guest
                </>
              )}
            </Button>
          ) : (
            <div
              className="flex items-center gap-1.5 px-3 text-xs font-bold text-slate-400"
              role="status"
            >
              <Check className="h-4 w-4 text-emerald-500" aria-hidden />
              {booking.status === 'completed' ? 'Completed' : 'Closed'}
            </div>
          )}
        </div>
      </div>

      <AlertDialog open={isNoShowOpen} onOpenChange={setIsNoShowOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Mark as no-show?</AlertDialogTitle>
            <AlertDialogDescription>
              You’re about to mark{' '}
              <span className="font-semibold text-foreground">{meta.customerLabel}</span> as a no-show
              for <span className="font-semibold text-foreground">{booking.partySize}</span>{' '}
              cover{booking.partySize === 1 ? '' : 's'} on{' '}
              <span className="font-semibold text-foreground">
                {meta.dateLabel} · {meta.timeRangeLabel}
              </span>
              . You can undo this shortly after confirming.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={disableActions || isNoShowPending}>
              Keep booking
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => void handleConfirmNoShow()}
              className="bg-rose-600 hover:bg-rose-700"
              disabled={disableActions || isNoShowPending}
            >
              {isNoShowPending ? 'Marking…' : 'Confirm no-show'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
});

OpsBookingCardActions.displayName = 'OpsBookingCardActions';
