'use client';

import { ChevronDown } from 'lucide-react';
import dynamic from 'next/dynamic';
import { useEffect, useState } from 'react';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

import type { FlattenedTable } from '../utils';
import type { RefObject } from 'react';

const TableAssignmentPanel = dynamic(
  () => import('./TableAssignmentPanel').then((m) => m.TableAssignmentPanel),
  {
    ssr: false,
    loading: () => (
      <div className="space-y-3" aria-busy="true">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
    ),
  },
);

type BookingDialogTableAssignmentPanelProps = {
  allowTableAssignments: boolean;
  assignedTableRows: FlattenedTable[];
  bookingEndTime?: string | null;
  bookingId: string;
  bookingStartTime?: string | null;
  date: string;
  enabled: boolean;
  initialFocusRef: RefObject<HTMLButtonElement | null>;
  onAssignmentComplete: () => void;
  partySize: number;
  realtime: boolean;
  restaurantId: string;
};

type BookingDialogMobileTableAssignmentSectionProps = BookingDialogTableAssignmentPanelProps & {
  isOpen: boolean;
  needsAssignment: boolean;
  onOpenChange: (nextOpen: boolean) => void;
  tablePanelRef: RefObject<HTMLDivElement | null>;
};

type BookingDialogDesktopTableAssignmentSectionProps = Omit<
  BookingDialogTableAssignmentPanelProps,
  'enabled'
> & {
  queryEnabled: boolean;
  tablePanelRef: RefObject<HTMLDivElement | null>;
};

export function BookingDialogMobileTableAssignmentSection({
  allowTableAssignments,
  assignedTableRows,
  bookingEndTime,
  bookingId,
  bookingStartTime,
  date,
  enabled,
  initialFocusRef,
  isOpen,
  needsAssignment,
  onAssignmentComplete,
  onOpenChange,
  partySize,
  realtime,
  restaurantId,
  tablePanelRef,
}: BookingDialogMobileTableAssignmentSectionProps) {
  return (
    <div
      ref={tablePanelRef}
      className="rounded-2xl border border-border/40 bg-background/60 p-4 shadow-sm backdrop-blur-md sm:p-5"
    >
      <Collapsible open={isOpen} onOpenChange={onOpenChange} className="space-y-3.5">
        <CollapsibleTrigger asChild>
          <Button
            variant="ghost"
            className="mb-3 flex h-auto w-full items-center justify-between rounded-md p-0 hover:bg-transparent hover:no-underline"
          >
            <div className="text-left">
              <div className="flex items-center gap-2">
                <h3 className="mb-1 text-sm font-bold uppercase tracking-wider text-foreground">
                  Table Assignment
                </h3>
                {needsAssignment && !isOpen ? (
                  <Badge
                    variant="destructive"
                    className="gap-1 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide motion-reduce:animate-none"
                  >
                    <span className="size-1.5 rounded-full bg-destructive" aria-hidden />
                    Action required
                  </Badge>
                ) : null}
              </div>
              <p className="text-xs font-normal text-muted-foreground">
                Manage seating and capacity.
              </p>
            </div>
            <ChevronDown
              className={cn(
                'h-4 w-4 text-muted-foreground transition-transform duration-200',
                isOpen && 'rotate-180',
              )}
            />
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          {isOpen ? (
            <BookingDialogTableAssignmentPanel
              allowTableAssignments={allowTableAssignments}
              assignedTableRows={assignedTableRows}
              bookingEndTime={bookingEndTime}
              bookingId={bookingId}
              bookingStartTime={bookingStartTime}
              date={date}
              enabled={enabled}
              initialFocusRef={initialFocusRef}
              onAssignmentComplete={onAssignmentComplete}
              partySize={partySize}
              realtime={realtime}
              restaurantId={restaurantId}
            />
          ) : null}
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}

export function BookingDialogDesktopTableAssignmentSection({
  allowTableAssignments,
  assignedTableRows,
  bookingEndTime,
  bookingId,
  bookingStartTime,
  date,
  initialFocusRef,
  onAssignmentComplete,
  partySize,
  queryEnabled,
  realtime,
  restaurantId,
  tablePanelRef,
}: BookingDialogDesktopTableAssignmentSectionProps) {
  const [panelReady, setPanelReady] = useState(false);

  useEffect(() => {
    setPanelReady(false);
    const timer = window.setTimeout(() => setPanelReady(true), 180);
    return () => window.clearTimeout(timer);
  }, [bookingId, restaurantId]);

  return (
    <div ref={tablePanelRef} className="p-5 sm:p-6 xl:p-8">
      <div className="mb-5 flex items-center gap-2">
        <h3 className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60">
          Table Assignment
        </h3>
        <span className="h-px flex-1 bg-border/30" />
      </div>

      <BookingDialogTableAssignmentPanel
        allowTableAssignments={allowTableAssignments}
        assignedTableRows={assignedTableRows}
        bookingEndTime={bookingEndTime}
        bookingId={bookingId}
        bookingStartTime={bookingStartTime}
        date={date}
        enabled={panelReady && queryEnabled}
        initialFocusRef={initialFocusRef}
        onAssignmentComplete={onAssignmentComplete}
        partySize={partySize}
        realtime={realtime}
        restaurantId={restaurantId}
      />
    </div>
  );
}

function BookingDialogTableAssignmentPanel({
  allowTableAssignments,
  assignedTableRows,
  bookingEndTime,
  bookingId,
  bookingStartTime,
  date,
  enabled,
  initialFocusRef,
  onAssignmentComplete,
  partySize,
  realtime,
  restaurantId,
}: BookingDialogTableAssignmentPanelProps) {
  if (!allowTableAssignments) {
    return (
      <Alert>
        <AlertTitle>Table assignment disabled</AlertTitle>
        <AlertDescription>Assignments are locked for past or completed bookings.</AlertDescription>
      </Alert>
    );
  }

  return (
    <TableAssignmentPanel
      bookingId={bookingId}
      restaurantId={restaurantId}
      partySize={partySize}
      date={date}
      currentAssignments={assignedTableRows.map((row) => row.id)}
      initialFocusRef={initialFocusRef}
      onAssignmentComplete={onAssignmentComplete}
      bookingStartTime={bookingStartTime}
      bookingEndTime={bookingEndTime}
      enabled={enabled}
      realtime={realtime}
    />
  );
}
