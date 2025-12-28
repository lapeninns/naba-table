/**
 * BookingDialog
 *
 * Usage:
 * <BookingDialog
 *   booking={booking}
 *   summary={summary}
 *   allowTableAssignments
 *   onCheckIn={...}
 *   onCheckOut={...}
 *   onMarkNoShow={...}
 *   onUndoNoShow={...}
 *   open={open}
 *   onOpenChange={setOpen}
 * />
 */

'use client';

import { useQueryClient } from '@tanstack/react-query';
import {
  Calendar,
  Clock,
  Copy,
  CreditCard,
  LayoutGrid,
  LogIn,
  LogOut,
  Mail,
  Phone,
  RefreshCw,
  RotateCcw,
  Star,
  UserX,
  Users,
  X,
} from 'lucide-react';
import { DateTime } from 'luxon';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
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
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Sheet, SheetContent, SheetDescription, SheetTitle } from '@/components/ui/sheet';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useIsMobile } from '@/hooks/use-mobile';
import { useToast } from '@/hooks/use-toast';
import { queryKeys } from '@/lib/query/keys';
import { cn } from '@/lib/utils';

import {
  ArrivalCountdown,
  BookingStatCard,
  BookingStatusBadge,
  ClickToCopy,
  ContactInfoRow,
  TableAssignmentPanel,
} from './components';
import {
  calculateCapacityPercent,
  calculateTotalCapacity,
  canCheckIn,
  canMarkNoShow,
  copyToClipboard,
  flattenTableAssignments,
  formatBookingDate,
  formatBookingTime,
  formatPhoneForTel,
  getGuestInitials,
  getMinutesUntilTime,
  getStatusConfig,
  parseBookingDateTime,
} from './utils';

import type { BookingActionType, BookingDialogProps } from './types';
import type { LucideIcon } from 'lucide-react';

type PrimaryAction =
  | { id: 'assign-table'; label: string; icon: LucideIcon; tone: string; onClick: () => void }
  | { id: BookingActionType; label: string; icon: LucideIcon; tone: string; onClick: () => void }
  | null;

export function BookingDialog({
  booking,
  summary,
  allowTableAssignments,
  isLoading = false,
  errorMessage = null,
  onRetry,
  onCheckIn,
  onCheckOut,
  onMarkNoShow,
  onUndoNoShow,
  pendingLifecycleAction,
  open,
  onOpenChange,
}: BookingDialogProps) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const isMobile = useIsMobile();

  const [isOpen, setIsOpen] = useState(Boolean(open));
  const [pendingAction, setPendingAction] = useState<BookingActionType | null>(null);
  const [confirmNoShow, setConfirmNoShow] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');

  useEffect(() => {
    if (open !== undefined) setIsOpen(open);
  }, [open]);

  const handleOpenChange = useCallback(
    (value: boolean) => {
      setIsOpen(value);
      onOpenChange?.(value);
    },
    [onOpenChange],
  );

  const timezone = summary?.timezone ?? 'UTC';
  const bookingDate = summary?.date ?? null;
  const status = booking?.status ?? 'pending';

  const formattedDate = bookingDate ? formatBookingDate(bookingDate, timezone) : '--';
  const formattedStartTime = booking ? formatBookingTime(booking.startTime, bookingDate, timezone) : '--:--';
  const formattedEndTime = booking ? formatBookingTime(booking.endTime, bookingDate, timezone) : '--:--';

  const titleText = booking?.customerName ? `Booking for ${booking.customerName}` : 'Booking details';
  const descriptionText = booking
    ? `${formattedDate} · ${formattedStartTime} · ${booking.partySize} covers`
    : 'Booking overview and table assignment';

  const startDateTime = booking && bookingDate
    ? parseBookingDateTime({ time: booking.startTime, date: bookingDate, timezone })
    : null;
  const endDateTime = booking && bookingDate
    ? parseBookingDateTime({ time: booking.endTime, date: bookingDate, timezone })
    : null;
  const durationMinutes =
    startDateTime && endDateTime
      ? Math.max(0, Math.round(endDateTime.diff(startDateTime, 'minutes').minutes ?? 0))
      : null;

  const minutesRemaining =
    booking && bookingDate ? getMinutesUntilTime(booking.startTime, bookingDate, timezone) : null;

  const assignedTableRows = useMemo(
    () => (booking ? flattenTableAssignments(booking.tableAssignments) : []),
    [booking],
  );
  const totalCapacity = calculateTotalCapacity(assignedTableRows);
  const capacityPercent = booking ? calculateCapacityPercent(totalCapacity, booking.partySize) : 0;

  const shouldShowNoShow = booking ? canMarkNoShow(booking.status) && Boolean(onMarkNoShow) : false;
  const canUndoNoShow = booking?.status === 'no_show';
  const canCheckOut = booking?.status === 'checked_in';

  const needsAssignment =
    Boolean(booking?.requiresTableAssignment) && allowTableAssignments && assignedTableRows.length === 0;

  const isActionPending = Boolean(pendingLifecycleAction || pendingAction);

  const handleAction = useCallback(
    async (action: BookingActionType) => {
      if (!action) return;
      setPendingAction(action);
      try {
        if (action === 'check-in') {
          await onCheckIn?.();
        } else if (action === 'check-out') {
          await onCheckOut?.();
        } else if (action === 'undo-no-show') {
          await onUndoNoShow?.();
        } else if (action === 'no-show') {
          await onMarkNoShow?.();
        }
        if (booking?.id) {
          queryClient.invalidateQueries({ queryKey: queryKeys.opsBookings.detail(booking.id) });
        }
      } finally {
        setPendingAction(null);
      }
    },
    [booking?.id, onCheckIn, onCheckOut, onMarkNoShow, onUndoNoShow, queryClient],
  );

  const handleCopySummary = useCallback(async () => {
    if (!booking || !summary) return;
    const statusLabel = getStatusConfig(booking.status).label;
    const tableLabel = assignedTableRows.length
      ? assignedTableRows.map((member) => member.tableNumber).join(', ')
      : 'Unassigned';
    const summaryText = [
      `Booking: ${booking.customerName}`,
      `Covers: ${booking.partySize}`,
      `Time: ${formattedDate} ${formattedStartTime}${booking.endTime ? ` - ${formattedEndTime}` : ''}`,
      `Status: ${statusLabel}`,
      `Reference: ${booking.reference ?? booking.id}`,
      `Tables: ${tableLabel}`,
      booking.customerPhone ? `Phone: ${booking.customerPhone}` : null,
      booking.customerEmail ? `Email: ${booking.customerEmail}` : null,
      booking.notes ? `Notes: ${booking.notes}` : null,
    ]
      .filter(Boolean)
      .join('\n');

    const success = await copyToClipboard(summaryText);
    toast({
      title: success ? 'Summary copied' : 'Copy failed',
      description: success ? 'Booking summary copied to clipboard.' : 'Please try again.',
      variant: success ? 'default' : 'destructive',
      duration: 2000,
    });
  }, [
    assignedTableRows,
    booking,
    formattedDate,
    formattedEndTime,
    formattedStartTime,
    summary,
    toast,
  ]);

  const primaryAction: PrimaryAction = useMemo(() => {
    if (!booking) return null;

    if (needsAssignment) {
      return {
        id: 'assign-table',
        label: 'Assign table',
        icon: LayoutGrid,
        tone: 'bg-indigo-600 hover:bg-indigo-700',
        onClick: () => {
          if (isMobile) setActiveTab('tables');
        },
      };
    }

    if (canCheckOut && onCheckOut) {
      return {
        id: 'check-out',
        label: 'Complete visit',
        icon: LogOut,
        tone: 'bg-blue-600 hover:bg-blue-700',
        onClick: () => handleAction('check-out'),
      };
    }

    if (canUndoNoShow && onUndoNoShow) {
      return {
        id: 'undo-no-show',
        label: 'Undo no-show',
        icon: RotateCcw,
        tone: 'bg-orange-600 hover:bg-orange-700',
        onClick: () => handleAction('undo-no-show'),
      };
    }

    if (canCheckIn(booking.status) && onCheckIn) {
      return {
        id: 'check-in',
        label: 'Mark arrived',
        icon: LogIn,
        tone: 'bg-emerald-600 hover:bg-emerald-700',
        onClick: () => handleAction('check-in'),
      };
    }

    return null;
  }, [booking, canCheckOut, canUndoNoShow, handleAction, isMobile, needsAssignment, onCheckIn, onCheckOut, onUndoNoShow]);

  const HeaderContent = () => (
    <div className="flex items-start justify-between gap-4">
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <BookingStatusBadge status={status} />
          <span className="inline-flex items-center gap-1">
            <Clock className="h-3.5 w-3.5" />
            {formattedStartTime}
          </span>
          <Separator orientation="vertical" className="h-4" />
          <span className="inline-flex items-center gap-1">
            <Users className="h-3.5 w-3.5" />
            {booking?.partySize ?? '--'} covers
          </span>
          {minutesRemaining !== null ? (
            <ArrivalCountdown status={status} startTime={booking?.startTime ?? null} date={bookingDate} timezone={timezone} />
          ) : null}
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center text-sm font-semibold">
            {booking ? getGuestInitials(booking.customerName) : '--'}
          </div>
          <div className="min-w-0">
            <div className="text-lg font-semibold text-foreground truncate">
              {booking?.customerName ?? 'Booking details'}
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Calendar className="h-3 w-3" />
              {formattedDate}
              {booking?.reference || booking?.id ? (
                <>
                  <Separator orientation="vertical" className="h-3" />
                  <ClickToCopy text={booking.reference ?? booking.id} label="Reference" compact />
                </>
              ) : null}
            </div>
          </div>
        </div>
      </div>
      <Button
        variant="ghost"
        size="icon"
        onClick={() => handleOpenChange(false)}
        className="h-9 w-9 rounded-full"
        aria-label="Close booking details"
      >
        <X className="h-4 w-4" />
      </Button>
    </div>
  );

  const renderOverview = () => {
    if (!booking || !summary) return null;

    const sourceLabel = booking.source ? booking.source : 'Direct';
    const occasionLabel = booking.details && typeof booking.details['occasion'] === 'string'
      ? String(booking.details['occasion'])
      : booking.loyaltyTier
        ? `Loyalty · ${booking.loyaltyTier}`
        : 'Standard';
    const depositValue =
      booking.details?.['deposit'] ??
      booking.details?.['depositAmount'] ??
      booking.details?.['prepay'] ??
      booking.details?.['prepayAmount'] ??
      booking.details?.['prepaidAmount'];
    const depositLabel =
      typeof depositValue === 'number' || typeof depositValue === 'string'
        ? String(depositValue)
        : 'None';
    const updatedAt =
      (booking.details && typeof booking.details['updatedAt'] === 'string' && booking.details['updatedAt']) ||
      booking.checkedOutAt ||
      booking.checkedInAt;
    const updatedDateTime = updatedAt ? DateTime.fromISO(updatedAt, { zone: timezone }) : null;
    const updatedLabel = updatedDateTime && updatedDateTime.isValid
      ? updatedDateTime.toLocaleString(DateTime.DATETIME_SHORT)
      : 'Not recorded';

    const tags = [
      ...(booking.allergies ?? []).map((tag) => ({ label: tag, tone: 'destructive' as const })),
      ...(booking.dietaryRestrictions ?? []).map((tag) => ({ label: tag, tone: 'secondary' as const })),
      booking.seatingPreference ? { label: booking.seatingPreference, tone: 'outline' as const } : null,
    ].filter(Boolean) as Array<{ label: string; tone: 'destructive' | 'secondary' | 'outline' }>;

    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <BookingStatCard icon={Users} label="Covers" value={booking.partySize} subtext="Guests" />
          <BookingStatCard
            icon={Clock}
            label="Time window"
            value={booking.endTime ? `${formattedStartTime} – ${formattedEndTime}` : formattedStartTime}
            subtext={durationMinutes ? `${durationMinutes} min` : 'Duration TBC'}
            highlight
          />
          <BookingStatCard icon={Star} label="Source" value={sourceLabel} variant="compact" />
          <BookingStatCard icon={Calendar} label="Occasion" value={occasionLabel} variant="compact" />
          <BookingStatCard icon={RefreshCw} label="Updated" value={updatedLabel} variant="compact" />
          <BookingStatCard icon={CreditCard} label="Deposit" value={depositLabel} variant="compact" />
        </div>

        {assignedTableRows.length > 0 ? (
          <Card>
            <CardContent className="space-y-2 p-4">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium text-foreground">Current tables</span>
                <span className="text-muted-foreground">
                  {assignedTableRows.map((member) => member.tableNumber).join(', ')}
                </span>
              </div>
              <Progress value={capacityPercent} className="h-2" />
              <div className="text-xs text-muted-foreground">
                {totalCapacity} / {booking.partySize} seats
              </div>
            </CardContent>
          </Card>
        ) : (
          <Alert>
            <AlertTitle>No table assigned</AlertTitle>
            <AlertDescription>
              Assign a table to complete the seating plan.
            </AlertDescription>
          </Alert>
        )}

        {tags.length > 0 ? (
          <Card>
            <CardContent className="space-y-2 p-4">
              <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Preferences
              </div>
              <div className="flex flex-wrap gap-2">
                {tags.map((tag) => (
                  <Badge key={tag.label} variant={tag.tone}>
                    {tag.label}
                  </Badge>
                ))}
              </div>
            </CardContent>
          </Card>
        ) : null}

        <Accordion type="single" collapsible defaultValue={booking.notes ? 'notes' : undefined}>
          <AccordionItem value="notes">
            <AccordionTrigger>Notes & requests</AccordionTrigger>
            <AccordionContent>
              {booking.notes ? (
                <div className="space-y-2">
                  <p className="text-sm text-foreground">{booking.notes}</p>
                  <ClickToCopy text={booking.notes} label="Notes" compact />
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No notes recorded.</p>
              )}
            </AccordionContent>
          </AccordionItem>
          {booking.profileNotes ? (
            <AccordionItem value="profile">
              <AccordionTrigger>Guest profile notes</AccordionTrigger>
              <AccordionContent>
                <p className="text-sm text-foreground">{booking.profileNotes}</p>
              </AccordionContent>
            </AccordionItem>
          ) : null}
        </Accordion>
      </div>
    );
  };

  const renderContact = () => {
    if (!booking) return null;
    return (
      <div className="space-y-3">
        {booking.customerPhone ? (
          <ContactInfoRow
            icon={Phone}
            label="Phone"
            value={booking.customerPhone}
            href={`tel:${formatPhoneForTel(booking.customerPhone)}`}
            copyable
            action={{
              label: 'Call',
              href: `tel:${formatPhoneForTel(booking.customerPhone)}`,
              icon: Phone,
            }}
          />
        ) : (
          <Alert>
            <AlertTitle>No phone provided</AlertTitle>
            <AlertDescription>Ask the host to update the phone number.</AlertDescription>
          </Alert>
        )}

        {booking.customerEmail ? (
          <ContactInfoRow
            icon={Mail}
            label="Email"
            value={booking.customerEmail}
            href={`mailto:${booking.customerEmail}`}
            copyable
            action={{
              label: 'Email',
              href: `mailto:${booking.customerEmail}`,
              icon: Mail,
            }}
          />
        ) : null}
      </div>
    );
  };

  const renderTables = () => {
    if (!booking || !summary) return null;
    if (!allowTableAssignments) {
      return (
        <Alert>
          <AlertTitle>Table assignment disabled</AlertTitle>
          <AlertDescription>Assignments are locked for past bookings.</AlertDescription>
        </Alert>
      );
    }

    return (
      <TableAssignmentPanel
        bookingId={booking.id}
        restaurantId={summary.restaurantId}
        partySize={booking.partySize}
        currentAssignments={assignedTableRows.map((member) => member.id)}
        onAssignmentComplete={() => {
          queryClient.invalidateQueries({ queryKey: queryKeys.opsBookings.detail(booking.id) });
        }}
      />
    );
  };

  const renderBody = () => {
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
        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex h-full flex-col">
          <TabsList className="grid w-full grid-cols-3 rounded-none border-b bg-background">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="contact">Contact</TabsTrigger>
            <TabsTrigger value="tables">Tables</TabsTrigger>
          </TabsList>
          <TabsContent value="overview" className="flex-1 overflow-hidden">
            <ScrollArea className="h-full">
              <div className="p-4">{renderOverview()}</div>
            </ScrollArea>
          </TabsContent>
          <TabsContent value="contact" className="flex-1 overflow-hidden">
            <ScrollArea className="h-full">
              <div className="p-4">{renderContact()}</div>
            </ScrollArea>
          </TabsContent>
          <TabsContent value="tables" className="flex-1 overflow-hidden">
            <ScrollArea className="h-full">
              <div className="p-4">{renderTables()}</div>
            </ScrollArea>
          </TabsContent>
        </Tabs>
      );
    }

    return (
      <div className="grid h-full grid-cols-[minmax(0,1fr)_minmax(0,380px)]">
        <ScrollArea className="h-full border-r">
          <div className="p-6 space-y-6">
            {renderOverview()}
            <Separator />
            <div>
              <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3">
                Contact
              </div>
              {renderContact()}
            </div>
          </div>
        </ScrollArea>
        <ScrollArea className="h-full">
          <div className="p-6">{renderTables()}</div>
        </ScrollArea>
      </div>
    );
  };

  const content = (
    <div className="flex h-full flex-col">
      <div className="sticky top-0 z-10 border-b bg-background/95 backdrop-blur px-4 py-4">
        <HeaderContent />
      </div>
      <div className="flex-1 min-h-0">{renderBody()}</div>
      <div className="sticky bottom-0 z-10 border-t bg-background/95 backdrop-blur px-4 py-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="text-xs text-muted-foreground">
            {booking ? `${formattedDate} · ${formattedStartTime}` : 'Booking details'}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleCopySummary} disabled={!booking || !summary}>
              <Copy className="h-3.5 w-3.5 mr-1" />
              Copy summary
            </Button>
            {booking?.customerPhone ? (
              <Button variant="outline" size="sm" asChild>
                <a href={`tel:${formatPhoneForTel(booking.customerPhone)}`}>
                  <Phone className="h-3.5 w-3.5 mr-1" />
                  Call guest
                </a>
              </Button>
            ) : null}
            {shouldShowNoShow && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setConfirmNoShow(true)}
                disabled={isActionPending}
                className="text-rose-600 hover:text-rose-700"
              >
                <UserX className="h-3.5 w-3.5 mr-1" />
                No-show
              </Button>
            )}
            {primaryAction ? (() => {
              const PrimaryIcon = primaryAction.icon;
              return (
                <Button
                  size="sm"
                  onClick={primaryAction.onClick}
                  disabled={isActionPending}
                  className={cn('text-white', primaryAction.tone)}
                >
                  <PrimaryIcon className="h-4 w-4 mr-1.5" />
                  {primaryAction.label}
                </Button>
              );
            })() : null}
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <>
      {isMobile ? (
        <Sheet open={isOpen} onOpenChange={handleOpenChange}>
          <SheetContent
            side="bottom"
            className={cn('h-[92vh] p-0 gap-0 overflow-hidden [&>button]:hidden', 'rounded-t-2xl')}
          >
            <SheetTitle className="sr-only">{titleText}</SheetTitle>
            <SheetDescription className="sr-only">{descriptionText}</SheetDescription>
            {content}
          </SheetContent>
        </Sheet>
      ) : (
        <Dialog open={isOpen} onOpenChange={handleOpenChange}>
          <DialogContent className="h-[88vh] max-w-5xl p-0 overflow-hidden [&>button]:hidden">
            <DialogTitle className="sr-only">{titleText}</DialogTitle>
            <DialogDescription className="sr-only">{descriptionText}</DialogDescription>
            {content}
          </DialogContent>
        </Dialog>
      )}

      <AlertDialog open={confirmNoShow} onOpenChange={setConfirmNoShow}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Mark as no-show?</AlertDialogTitle>
            <AlertDialogDescription>
              This will mark the booking as a no-show. You can undo this later if the guest arrives.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => handleAction('no-show')}
              className="bg-rose-600 hover:bg-rose-700"
            >
              Confirm no-show
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

export default BookingDialog;
