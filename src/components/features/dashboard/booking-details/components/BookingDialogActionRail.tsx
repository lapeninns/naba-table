'use client';

import { Ban, Check, Copy, MoreHorizontal, Phone, UserX } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';

import { formatPhoneForTel } from '../utils';

import type { BookingActionType } from '../types';
import type { OpsTodayBooking } from '@/types/ops';
import type { LucideIcon } from 'lucide-react';

export type BookingDialogPrimaryAction = {
  id: 'assign-table' | BookingActionType;
  label: string;
  icon: LucideIcon;
  tone: string;
  onClick: () => void;
} | null;

export type BookingDialogActionRailProps = {
  booking: OpsTodayBooking | null;
  canCancel: boolean;
  copySummaryStatus: 'idle' | 'copied' | 'failed';
  formattedDate: string;
  formattedStartTime: string;
  isActionPending: boolean;
  isMobile: boolean;
  primaryAction: BookingDialogPrimaryAction;
  shouldShowNoShow: boolean;
  srStatusMessage: string;
  summaryAvailable: boolean;
  onConfirmCancel: () => void;
  onConfirmNoShow: () => void;
  onCopyReference: () => void;
  onCopySummary: () => void;
};

export function BookingDialogActionRail({
  booking,
  canCancel,
  copySummaryStatus,
  formattedDate,
  formattedStartTime,
  isActionPending,
  isMobile,
  primaryAction,
  shouldShowNoShow,
  srStatusMessage,
  summaryAvailable,
  onConfirmCancel,
  onConfirmNoShow,
  onCopyReference,
  onCopySummary,
}: BookingDialogActionRailProps) {
  const PrimaryIcon = primaryAction?.icon ?? null;
  const referenceLabel = booking?.reference ?? booking?.id ?? null;

  return (
    <div className="z-20 shrink-0 border-t border-border/40 bg-background/60 px-4 py-4 shadow-[0_-10px_40px_-15px_rgba(0,0,0,0.1)] backdrop-blur-xl sm:px-6">
      <div className="flex flex-wrap items-center justify-between gap-3 sm:gap-4">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          {!isMobile && booking?.customerPhone ? (
            <Button
              variant="ghost"
              size="sm"
              className="h-8 gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground hover:bg-background hover:text-foreground"
              asChild
            >
              <a href={`tel:${formatPhoneForTel(booking.customerPhone)}`}>
                <Phone data-icon="inline-start" aria-hidden />
                Call Guest
              </a>
            </Button>
          ) : (
            <div className="hidden text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60 sm:block">
              {booking ? `${formattedDate} · ${formattedStartTime}` : 'Operation Mode'}
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          {booking ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="size-9 p-0 text-muted-foreground hover:bg-background hover:text-foreground"
                  aria-label="More operations"
                  disabled={isActionPending}
                >
                  <MoreHorizontal aria-hidden />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuGroup>
                  <DropdownMenuItem
                    onSelect={(event) => {
                      event.preventDefault();
                      onCopySummary();
                    }}
                    disabled={!summaryAvailable}
                  >
                    {copySummaryStatus === 'copied' ? (
                      <Check className="text-primary" aria-hidden />
                    ) : (
                      <Copy aria-hidden />
                    )}
                    {copySummaryStatus === 'copied' ? 'Copied summary' : 'Copy summary'}
                  </DropdownMenuItem>

                  {referenceLabel ? (
                    <DropdownMenuItem
                      onSelect={(event) => {
                        event.preventDefault();
                        onCopyReference();
                      }}
                    >
                      <Copy aria-hidden />
                      Copy reference
                    </DropdownMenuItem>
                  ) : null}
                </DropdownMenuGroup>

                {shouldShowNoShow || canCancel ? <DropdownMenuSeparator /> : null}

                {shouldShowNoShow || canCancel ? (
                  <DropdownMenuGroup>
                    {shouldShowNoShow ? (
                      <DropdownMenuItem
                        variant="destructive"
                        onSelect={(event) => {
                          event.preventDefault();
                          onConfirmNoShow();
                        }}
                      >
                        <UserX aria-hidden />
                        Mark no-show
                      </DropdownMenuItem>
                    ) : null}

                    {canCancel ? (
                      <DropdownMenuItem
                        variant="destructive"
                        onSelect={(event) => {
                          event.preventDefault();
                          onConfirmCancel();
                        }}
                      >
                        <Ban aria-hidden />
                        Cancel booking
                      </DropdownMenuItem>
                    ) : null}
                  </DropdownMenuGroup>
                ) : null}
              </DropdownMenuContent>
            </DropdownMenu>
          ) : null}

          {primaryAction && PrimaryIcon ? (
            <Button
              size="sm"
              onClick={primaryAction.onClick}
              disabled={isActionPending}
              className={cn(
                'h-9 px-4 text-xs font-bold uppercase tracking-widest shadow-sm transition-all active:scale-[0.98]',
                primaryAction.tone,
              )}
            >
              <PrimaryIcon data-icon="inline-start" aria-hidden />
              {primaryAction.label}
            </Button>
          ) : null}
        </div>
      </div>

      <div className="sr-only" role="status" aria-live="polite">
        {srStatusMessage}
      </div>
    </div>
  );
}
