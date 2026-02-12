/**
 * BookingDialogBody
 *
 * Extracted from BookingDialog to keep the dialog orchestrator under the repo LOC cap
 * while keeping a single canonical business-rules path in BookingDialog.
 */

'use client';

import { ChevronDown } from 'lucide-react';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

import { GuestProfilePanel } from './GuestProfilePanel';
import { TableAssignmentPanel } from './TableAssignmentPanel';

import type { OpsBookingStatus, OpsTodayBooking, OpsTodayBookingsSummary } from '../types';
import type { FlattenedTable } from '../utils';
import type { RefObject } from 'react';

export type BookingDialogBodyProps = {
  isLoading: boolean;
  errorMessage: string | null;
  onRetry?: () => void;

  booking: OpsTodayBooking | null;
  summary: OpsTodayBookingsSummary | null;
  isMobile: boolean;
  allowTableAssignments: boolean;
  needsAssignment: boolean;

  bookingDate: string | null;
  timezone: string;
  status: OpsBookingStatus;
  minutesRemaining: number | null;

  assignedTableRows: FlattenedTable[];
  totalCapacity: number;
  capacityPercent: number;

  isTableAssignmentOpen: boolean;
  onTableAssignmentOpenChange: (nextOpen: boolean) => void;

  tablePanelRef: RefObject<HTMLDivElement | null>;
  tableAssignmentPrimaryFocusRef: RefObject<HTMLButtonElement | null>;
  onAssignmentComplete: () => void;

  bookingStartTime?: string | null;
  bookingEndTime?: string | null;
};

export function BookingDialogBody({
  isLoading,
  errorMessage,
  onRetry,
  booking,
  summary,
  isMobile,
  allowTableAssignments,
  needsAssignment,
  bookingDate,
  timezone,
  status,
  minutesRemaining,
  assignedTableRows,
  totalCapacity,
  capacityPercent,
  isTableAssignmentOpen,
  onTableAssignmentOpenChange,
  tablePanelRef,
  tableAssignmentPrimaryFocusRef,
  onAssignmentComplete,
  bookingStartTime,
  bookingEndTime,
}: BookingDialogBodyProps) {
  if (isLoading) {
    return (
      <div className="space-y-4 p-4">
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }

  if (errorMessage) {
    return (
      <div className="p-4">
        <Alert variant="destructive">
          <AlertTitle>Unable to load booking</AlertTitle>
          <AlertDescription className="flex items-center justify-between gap-3">
            <span>{errorMessage}</span>
            {onRetry ? (
              <Button variant="outline" size="sm" onClick={onRetry}>
                Retry
              </Button>
            ) : null}
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  if (!booking || !summary) {
    return (
      <div className="p-4">
        <Alert>
          <AlertTitle>No booking selected</AlertTitle>
          <AlertDescription>Select a booking to view details.</AlertDescription>
        </Alert>
      </div>
    );
  }

  if (isMobile) {
    return (
      <ScrollArea className="h-full bg-slate-50/30">
        <div className="flex flex-col gap-6 p-4 pb-20">
          <GuestProfilePanel
            booking={booking}
            bookingDate={bookingDate}
            timezone={timezone}
            status={status}
            minutesRemaining={minutesRemaining}
            assignedTableRows={assignedTableRows}
            totalCapacity={totalCapacity}
            capacityPercent={capacityPercent}
            enableDesktopTabs={false}
          />

          <div ref={tablePanelRef} className="pt-4 border-t border-dashed border-slate-200">
            <Collapsible
              open={isTableAssignmentOpen}
              onOpenChange={onTableAssignmentOpenChange}
              className="space-y-3"
            >
              <CollapsibleTrigger asChild>
                <Button
                  variant="ghost"
                  className="flex w-full items-center justify-between p-0 hover:bg-transparent mb-4 h-auto hover:no-underline"
                >
                  <div className="text-left">
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-1">
                        Table Assignment
                      </h3>
                      {needsAssignment && !isTableAssignmentOpen ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-rose-600 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white motion-reduce:animate-none">
                          <span className="h-1.5 w-1.5 rounded-full bg-white/90" aria-hidden />
                          Action required
                        </span>
                      ) : null}
                    </div>
                    <p className="text-xs text-slate-500 font-normal">Manage seating and capacity.</p>
                  </div>
                  <ChevronDown
                    className={cn(
                      'h-4 w-4 text-slate-500 transition-transform duration-200',
                      isTableAssignmentOpen && 'rotate-180',
                    )}
                  />
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent>
                {isTableAssignmentOpen && (
                  <>
                    {allowTableAssignments ? (
                      <TableAssignmentPanel
                        bookingId={booking.id}
                        restaurantId={summary.restaurantId}
                        partySize={booking.partySize}
                        date={summary.date}
                        currentAssignments={assignedTableRows.map((row) => row.id)}
                        initialFocusRef={tableAssignmentPrimaryFocusRef}
                        onAssignmentComplete={onAssignmentComplete}
                        bookingStartTime={bookingStartTime}
                        bookingEndTime={bookingEndTime}
                      />
                    ) : (
                      <Alert>
                        <AlertTitle>Table assignment disabled</AlertTitle>
                        <AlertDescription>
                          Assignments are locked for past or completed bookings.
                        </AlertDescription>
                      </Alert>
                    )}
                  </>
                )}
              </CollapsibleContent>
            </Collapsible>
          </div>
        </div>
      </ScrollArea>
    );
  }

  return (
    <div className="grid h-full overflow-hidden grid-cols-1 lg:grid-cols-2">
      <ScrollArea className="h-full border-b border-stone-200/70 lg:border-b-0 lg:border-r bg-gradient-to-b from-stone-50/80 via-white to-stone-50/60 overflow-x-hidden">
        <div className="p-5 lg:p-6 space-y-5 overflow-x-hidden">
          <GuestProfilePanel
            booking={booking}
            bookingDate={bookingDate}
            timezone={timezone}
            status={status}
            minutesRemaining={minutesRemaining}
            assignedTableRows={assignedTableRows}
            totalCapacity={totalCapacity}
            capacityPercent={capacityPercent}
            enableDesktopTabs={true}
          />
        </div>
      </ScrollArea>
      <ScrollArea className="h-full overflow-x-hidden bg-white">
        <div ref={tablePanelRef} className="p-4 lg:p-6 overflow-x-hidden h-full">
          <div className="mb-4 lg:hidden">
            <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
              Table Assignment
            </h3>
          </div>
          {allowTableAssignments ? (
            <TableAssignmentPanel
              bookingId={booking.id}
              restaurantId={summary.restaurantId}
              partySize={booking.partySize}
              date={summary.date}
              currentAssignments={assignedTableRows.map((row) => row.id)}
              initialFocusRef={tableAssignmentPrimaryFocusRef}
              onAssignmentComplete={onAssignmentComplete}
              bookingStartTime={bookingStartTime}
              bookingEndTime={bookingEndTime}
            />
          ) : (
            <Alert>
              <AlertTitle>Table assignment disabled</AlertTitle>
              <AlertDescription>
                Assignments are locked for past or completed bookings.
              </AlertDescription>
            </Alert>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}

export default BookingDialogBody;
