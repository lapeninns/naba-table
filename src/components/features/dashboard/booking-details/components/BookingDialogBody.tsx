/**
 * BookingDialogBody
 *
 * Extracted from BookingDialog to keep the dialog orchestrator under the repo LOC cap
 * while keeping a single canonical business-rules path in BookingDialog.
 */

'use client';

import { ChevronDown } from 'lucide-react';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
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
      <ScrollArea className="h-full bg-muted/30">
        <div className="flex flex-col gap-5 p-4 pb-20 sm:p-5">
          <GuestProfilePanel
            booking={booking}
            bookingDate={bookingDate}
            timezone={timezone}
            status={status}
            minutesRemaining={minutesRemaining}
            assignedTableRows={assignedTableRows}
            totalCapacity={totalCapacity}
            capacityPercent={capacityPercent}
          />

          <div
            ref={tablePanelRef}
            className="rounded-2xl border border-border/40 bg-background/60 p-4 shadow-sm backdrop-blur-md sm:p-5"
          >
            <Collapsible
              open={isTableAssignmentOpen}
              onOpenChange={onTableAssignmentOpenChange}
              className="space-y-3.5"
            >
              <CollapsibleTrigger asChild>
                <Button
                  variant="ghost"
                  className="mb-3 flex h-auto w-full items-center justify-between rounded-md p-0 hover:bg-transparent hover:no-underline"
                >
                  <div className="text-left">
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-bold text-foreground uppercase tracking-wider mb-1">
                        Table Assignment
                      </h3>
                      {needsAssignment && !isTableAssignmentOpen ? (
                        <Badge
                          variant="destructive"
                          className="gap-1 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide motion-reduce:animate-none"
                        >
                          <span className="h-1.5 w-1.5 rounded-full bg-destructive" aria-hidden />
                          Action required
                        </Badge>
                      ) : null}
                    </div>
                    <p className="text-xs text-muted-foreground font-normal">
                      Manage seating and capacity.
                    </p>
                  </div>
                  <ChevronDown
                    className={cn(
                      'h-4 w-4 text-muted-foreground transition-transform duration-200',
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
    <div className="grid h-full grid-cols-1 overflow-hidden md:grid-cols-[minmax(300px,0.92fr)_minmax(0,1.08fr)] xl:grid-cols-[minmax(340px,0.9fr)_minmax(0,1.1fr)]">
      {/* ── Left: Guest Profile ────────────────────────────────────────── */}
      <ScrollArea className="h-full border-b border-border/30 bg-gradient-to-b from-muted/30 to-muted/10 md:border-b-0 md:border-r md:border-border/30">
        <div className="p-5 sm:p-6 xl:p-8">
          <GuestProfilePanel
            booking={booking}
            bookingDate={bookingDate}
            timezone={timezone}
            status={status}
            minutesRemaining={minutesRemaining}
            assignedTableRows={assignedTableRows}
            totalCapacity={totalCapacity}
            capacityPercent={capacityPercent}
          />
        </div>
      </ScrollArea>

      {/* ── Right: Table Assignment ───────────────────────────────────── */}
      <ScrollArea className="h-full bg-background/60 backdrop-blur-sm">
        <div ref={tablePanelRef} className="p-5 sm:p-6 xl:p-8">
          {/* Section label */}
          <div className="mb-5 flex items-center gap-2">
            <h3 className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60">
              Table Assignment
            </h3>
            <span className="flex-1 h-px bg-border/30" />
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
