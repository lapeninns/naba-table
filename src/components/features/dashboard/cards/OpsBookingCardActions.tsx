'use client';

import {
  Check,
  LogIn,
  LogOut,
  MoreHorizontal,
} from 'lucide-react';
import { memo } from 'react';

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
  onDetails,
  onEdit,
  onCancel,
  onMarkNoShow,
  onCheckIn,
  onCheckOut,
}: OpsBookingCardActionsProps) {
  return (
    <div className="px-4 pb-4">
      <div className="flex flex-wrap items-center justify-between gap-y-3 border-t border-border/60 pt-3">
        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="sm"
            className="h-8 px-4 text-xs font-medium"
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
                className="h-8 w-8 p-0"
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
                onClick={() => onMarkNoShow?.(booking.id)}
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
              disabled={!meta.isToday || disableActions}
              className={cn(
                'h-9 min-w-[120px] px-6 font-semibold text-white shadow-sm transition-[box-shadow,background-color] duration-150 ease-out hover:shadow-sm motion-reduce:transition-none',
                meta.isSeated ? 'bg-slate-700 hover:bg-slate-800' : 'bg-emerald-600 hover:bg-emerald-700',
              )}
              onClick={() =>
                meta.isSeated ? onCheckOut?.(booking.id) : onCheckIn?.(booking.id)
              }
            >
              {meta.isSeated ? (
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
    </div>
  );
});

OpsBookingCardActions.displayName = 'OpsBookingCardActions';
