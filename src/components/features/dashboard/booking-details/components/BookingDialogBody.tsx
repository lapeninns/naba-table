/**
 * BookingDialogBody
 *
 * Composition layer for the booking dialog body.
 */

'use client';

import { ScrollArea } from '@/components/ui/scroll-area';

import {
  BookingDialogEmptyState,
  BookingDialogErrorState,
  BookingDialogLoadingState,
} from './BookingDialogBodyStates';
import {
  BookingDialogDesktopTableAssignmentSection,
  BookingDialogMobileTableAssignmentSection,
} from './BookingDialogTableAssignmentSection';
import { GuestProfilePanel } from './GuestProfilePanel';

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
  tableAssignmentQueryEnabled?: boolean;
  tableAssignmentRealtime?: boolean;
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
  tableAssignmentQueryEnabled = true,
  tableAssignmentRealtime = true,
}: BookingDialogBodyProps) {
  if (isLoading) {
    return <BookingDialogLoadingState />;
  }

  if (errorMessage) {
    return <BookingDialogErrorState errorMessage={errorMessage} onRetry={onRetry} />;
  }

  if (!booking || !summary) {
    return <BookingDialogEmptyState />;
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

          <BookingDialogMobileTableAssignmentSection
            allowTableAssignments={allowTableAssignments}
            assignedTableRows={assignedTableRows}
            bookingEndTime={bookingEndTime}
            bookingId={booking.id}
            bookingStartTime={bookingStartTime}
            date={summary.date}
            enabled={isTableAssignmentOpen && tableAssignmentQueryEnabled}
            initialFocusRef={tableAssignmentPrimaryFocusRef}
            isOpen={isTableAssignmentOpen}
            needsAssignment={needsAssignment}
            onAssignmentComplete={onAssignmentComplete}
            onOpenChange={onTableAssignmentOpenChange}
            partySize={booking.partySize}
            realtime={tableAssignmentRealtime}
            restaurantId={summary.restaurantId}
            tablePanelRef={tablePanelRef}
          />
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
        <BookingDialogDesktopTableAssignmentSection
          allowTableAssignments={allowTableAssignments}
          assignedTableRows={assignedTableRows}
          bookingEndTime={bookingEndTime}
          bookingId={booking.id}
          bookingStartTime={bookingStartTime}
          date={summary.date}
          initialFocusRef={tableAssignmentPrimaryFocusRef}
          onAssignmentComplete={onAssignmentComplete}
          partySize={booking.partySize}
          queryEnabled={tableAssignmentQueryEnabled}
          realtime={tableAssignmentRealtime}
          restaurantId={summary.restaurantId}
          tablePanelRef={tablePanelRef}
        />
      </ScrollArea>
    </div>
  );
}

export default BookingDialogBody;
