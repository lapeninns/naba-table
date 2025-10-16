'use client';

import { Mail, Phone, Clock, Users, Calendar as CalendarIcon, AlertTriangle, Award, CheckCircle2, XCircle, Loader2 } from 'lucide-react';
import { useEffect, useMemo, useState, type ComponentType } from 'react';
import { useQuery } from '@tanstack/react-query';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { formatDateReadable, formatTimeRange } from '@/lib/utils/datetime';
import { queryKeys } from '@/lib/query/keys';
import { useTableInventoryService } from '@/contexts/ops-services';
import type { TableInventory } from '@/services/ops/tables';

import type { OpsTodayBooking, OpsTodayBookingsSummary } from '@/types/ops';


const STATUS_LABELS: Record<string, string> = {
  completed: 'Show',
  confirmed: 'Confirmed',
  pending: 'Pending',
  pending_allocation: 'Pending allocation',
  no_show: 'No show',
  cancelled: 'Cancelled',
};

const TIER_COLORS: Record<string, string> = {
  platinum: 'bg-purple-500 text-white border-purple-500',
  gold: 'bg-yellow-500 text-black border-yellow-500',
  silver: 'bg-gray-400 text-white border-gray-400',
  bronze: 'bg-amber-700 text-white border-amber-700',
};

type BookingDetailsDialogProps = {
  booking: OpsTodayBooking;
  summary: OpsTodayBookingsSummary;
  onStatusChange: (status: 'completed' | 'no_show') => Promise<void>;
  onAssignTable?: (tableId: string) => Promise<OpsTodayBooking['tableAssignments']>;
  onUnassignTable?: (tableId: string) => Promise<OpsTodayBooking['tableAssignments']>;
  tableActionState?: {
    type: 'assign' | 'unassign';
    tableId?: string | null;
  } | null;
};

const DEFAULT_DURATION_MINUTES = 90;

export function BookingDetailsDialog({
  booking,
  summary,
  onStatusChange,
  onAssignTable,
  onUnassignTable,
  tableActionState,
}: BookingDetailsDialogProps) {
  const [pendingStatus, setPendingStatus] = useState<'completed' | 'no_show' | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [selectedTableId, setSelectedTableId] = useState<string | null>(null);
  const [assignments, setAssignments] = useState<OpsTodayBooking['tableAssignments']>(booking.tableAssignments);

  const mailHref = booking.customerEmail ? `mailto:${booking.customerEmail}` : null;
  const phoneHref = booking.customerPhone ? `tel:${booking.customerPhone.replace(/[^+\d]/g, '')}` : null;

  const serviceDateReadable = formatDateReadable(summary.date, summary.timezone);
  const serviceTime = formatTimeRange(booking.startTime, booking.endTime, summary.timezone);
  const tableService = useTableInventoryService();
  const supportsTableAssignment = Boolean(onAssignTable && onUnassignTable);

  useEffect(() => {
    setAssignments(booking.tableAssignments);
  }, [booking.tableAssignments]);

  const {
    data: tablesResult,
    isLoading: tablesLoading,
    isError: tablesError,
    error: tablesQueryError,
    refetch: refetchTables,
  } = useQuery({
    queryKey: queryKeys.opsTables.list(summary.restaurantId, { scope: 'assignment' }),
    queryFn: async () => tableService.list(summary.restaurantId),
    enabled: supportsTableAssignment && isOpen,
    staleTime: 60_000,
  });

  const bookingWindow = useMemo(() => computeDialogBookingWindow(booking.startTime, booking.endTime), [booking.startTime, booking.endTime]);

  const conflictingTableIds = useMemo(
    () => computeConflictingTableIds(summary.bookings, booking, bookingWindow),
    [summary.bookings, booking, bookingWindow],
  );

  const assignedTableIds = useMemo(() => new Set(assignments.map((assignment) => assignment.tableId)), [assignments]);

  const tableOptions = useMemo(() => {
    const data = tablesResult?.tables ?? [];
    return data
      .filter((table) => !assignedTableIds.has(table.id))
      .map((table) => {
        const conflict = bookingWindow ? conflictingTableIds.has(table.id) : false;
        const isOutOfService = table.status === 'out_of_service';
        const disabled = conflict || isOutOfService;
        const labelParts = [`Table ${table.tableNumber}`];
        if (table.capacity) {
          labelParts.push(`${table.capacity} seat${table.capacity === 1 ? '' : 's'}`);
        }
        if (table.section) {
          labelParts.push(table.section);
        }
        const reason = conflict
          ? 'Conflicts with another booking'
          : isOutOfService
            ? 'Out of service'
            : null;
        return {
          table,
          label: labelParts.join(' · '),
          disabled,
          reason,
        };
      });
  }, [tablesResult?.tables, assignedTableIds, conflictingTableIds, bookingWindow]);

  const hasAssignableTables = tableOptions.some((option) => !option.disabled);

  useEffect(() => {
    if (!isOpen) {
      setSelectedTableId(null);
    }
  }, [isOpen]);

  useEffect(() => {
    if (supportsTableAssignment && isOpen) {
      void refetchTables();
    }
  }, [supportsTableAssignment, isOpen, refetchTables]);

  const handleAssignTable = async () => {
    if (!selectedTableId || !onAssignTable) {
      return;
    }
    try {
      const updated = await onAssignTable(selectedTableId);
      setAssignments(updated);
      setSelectedTableId(null);
      void refetchTables();
    } catch (error) {
      // Toast handled by mutation hook
    }
  };

  const handleUnassignTable = async (tableId: string) => {
    if (!onUnassignTable) {
      return;
    }
    try {
      const updated = await onUnassignTable(tableId);
      setAssignments(updated);
      void refetchTables();
    } catch (error) {
      // Toast handled by mutation hook
    }
  };

  const handleStatus = async (next: 'completed' | 'no_show') => {
    if (pendingStatus) return;
    setPendingStatus(next);
    try {
      await onStatusChange(next);
    } finally {
      setPendingStatus(null);
    }
  };

  const isCancelled = booking.status === 'cancelled';

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="h-11 min-w-[100px] touch-manipulation">
          Details
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between gap-3 text-xl font-semibold text-foreground">
            <span>{booking.customerName}</span>
            <Badge variant="secondary" className="capitalize">
              {STATUS_LABELS[booking.status] ?? booking.status}
            </Badge>
          </DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground">
            {serviceDateReadable} · {serviceTime}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          <section className="grid gap-3 sm:grid-cols-2">
            <InfoRow icon={Clock} label="Time" value={serviceTime} />
            <InfoRow icon={Users} label="Guests" value={`${booking.partySize}`} />
            <InfoRow icon={CalendarIcon} label="Service date" value={serviceDateReadable} />
            <InfoRow icon={Mail} label="Email" value={booking.customerEmail ?? 'Not provided'} href={mailHref ?? undefined} />
            <InfoRow icon={Phone} label="Phone" value={booking.customerPhone ?? 'Not provided'} href={phoneHref ?? undefined} />
          </section>

          {booking.notes ? (
            <section className="space-y-2">
              <h3 className="text-sm font-semibold text-foreground">Booking Notes</h3>
              <p className="rounded-2xl border border-border/60 bg-muted/10 px-4 py-3 text-sm text-foreground">
                {booking.notes}
              </p>
            </section>
          ) : null}

          {(booking.loyaltyTier || booking.allergies || booking.dietaryRestrictions || booking.seatingPreference || booking.profileNotes || booking.marketingOptIn !== null) ? (
            <section className="space-y-3">
              <h3 className="text-sm font-semibold text-foreground">Guest Profile</h3>
              <div className="space-y-3 rounded-2xl border border-border/60 bg-muted/10 px-4 py-4">
                {booking.loyaltyTier ? (
                  <div className="flex items-center gap-3">
                    <Award className="h-4 w-4 text-muted-foreground" aria-hidden />
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-muted-foreground">Loyalty:</span>
                      <Badge variant="outline" className={cn('text-xs font-semibold', TIER_COLORS[booking.loyaltyTier])}>
                        {booking.loyaltyTier}
                      </Badge>
                      {booking.loyaltyPoints !== null && booking.loyaltyPoints !== undefined ? (
                        <span className="text-xs text-muted-foreground">({booking.loyaltyPoints} points)</span>
                      ) : null}
                    </div>
                  </div>
                ) : null}

                {booking.allergies && booking.allergies.length > 0 ? (
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="h-4 w-4 text-orange-600 mt-0.5" aria-hidden />
                    <div className="flex-1">
                      <span className="text-sm font-medium text-orange-600">Allergies:</span>
                      <div className="mt-1 flex flex-wrap gap-2">
                        {booking.allergies.map((allergy, idx) => (
                          <Badge key={idx} variant="outline" className="border-orange-600 text-orange-600">
                            {allergy}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  </div>
                ) : null}

                {booking.dietaryRestrictions && booking.dietaryRestrictions.length > 0 ? (
                  <div className="flex items-start gap-3">
                    <Users className="h-4 w-4 text-muted-foreground mt-0.5" aria-hidden />
                    <div className="flex-1">
                      <span className="text-sm text-muted-foreground">Dietary Restrictions:</span>
                      <div className="mt-1 flex flex-wrap gap-2">
                        {booking.dietaryRestrictions.map((restriction, idx) => (
                          <Badge key={idx} variant="secondary">
                            {restriction}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  </div>
                ) : null}

                {booking.seatingPreference ? (
                  <div className="flex items-center gap-3">
                    <CalendarIcon className="h-4 w-4 text-muted-foreground" aria-hidden />
                    <div>
                      <span className="text-sm text-muted-foreground">Seating Preference:</span>
                      <span className="ml-2 text-sm text-foreground">{booking.seatingPreference}</span>
                    </div>
                  </div>
                ) : null}

                {booking.marketingOptIn !== null && booking.marketingOptIn !== undefined ? (
                  <div className="flex items-center gap-3">
                    {booking.marketingOptIn ? (
                      <CheckCircle2 className="h-4 w-4 text-green-600" aria-hidden />
                    ) : (
                      <XCircle className="h-4 w-4 text-muted-foreground" aria-hidden />
                    )}
                    <span className="text-sm text-muted-foreground">
                      Marketing: {booking.marketingOptIn ? 'Opted in' : 'Opted out'}
                    </span>
                  </div>
                ) : null}

                {booking.profileNotes ? (
                  <div className="space-y-1">
                    <span className="text-sm font-medium text-foreground">Profile Notes:</span>
                    <p className="text-sm text-muted-foreground">{booking.profileNotes}</p>
                  </div>
                ) : null}
              </div>
            </section>
          ) : null}

          {supportsTableAssignment ? (
            <section className="space-y-4 rounded-2xl border border-border/60 bg-muted/10 px-4 py-4">
              <div>
                <h3 className="text-sm font-semibold text-foreground">Table assignment</h3>
                <p className="text-xs text-muted-foreground">Assign or adjust tables for this reservation.</p>
              </div>

            <div className="space-y-2">
              {assignments.length > 0 ? (
                assignments.map((assignment) => {
                  const isUnassigning =
                    tableActionState?.type === 'unassign' && tableActionState?.tableId === assignment.tableId;
                  const capacityLabel =
                    assignment.capacity && assignment.capacity > 0
                      ? `${assignment.capacity} seat${assignment.capacity === 1 ? '' : 's'}`
                      : null;
                  const meta = [capacityLabel, assignment.section ? `Section ${assignment.section}` : null]
                    .filter(Boolean)
                    .join(' · ');

                  return (
                    <div
                      key={assignment.tableId}
                      className="flex items-center justify-between rounded-xl border border-border/60 bg-white px-3 py-2"
                    >
                      <div className="flex flex-col">
                        <span className="text-sm font-semibold text-foreground">Table {assignment.tableNumber}</span>
                        {meta ? <span className="text-xs text-muted-foreground">{meta}</span> : null}
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8"
                        onClick={() => handleUnassignTable(assignment.tableId)}
                        disabled={isUnassigning || tableActionState?.type === 'assign'}
                      >
                        {isUnassigning ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
                            Removing…
                          </>
                        ) : (
                          'Remove'
                        )}
                      </Button>
                    </div>
                  );
                })
              ) : (
                <p className="text-sm text-muted-foreground">No tables assigned yet.</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor={`table-select-${booking.id}`} className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Assign new table
              </Label>
              {tablesLoading ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Loading tables…
                </div>
              ) : tablesError ? (
                <p className="text-sm text-destructive">
                  {tablesQueryError instanceof Error ? tablesQueryError.message : 'Unable to load tables'}
                </p>
              ) : (
                <Select
                  value={selectedTableId ?? ''}
                  onValueChange={(value) => setSelectedTableId(value)}
                  disabled={!hasAssignableTables || tableActionState?.type === 'assign'}
                >
                  <SelectTrigger id={`table-select-${booking.id}`} className="w-full">
                    <SelectValue placeholder={hasAssignableTables ? 'Choose a table' : 'No tables available'} />
                  </SelectTrigger>
                  <SelectContent>
                    {tableOptions.map((option) => (
                      <SelectItem key={option.table.id} value={option.table.id} disabled={option.disabled}>
                        {option.label}
                        {option.reason ? ` — ${option.reason}` : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              {!hasAssignableTables && !tablesLoading && !tablesError ? (
                <p className="text-xs text-muted-foreground">No available tables match this booking window.</p>
              ) : null}
              {bookingWindow === null ? (
                <p className="text-xs text-muted-foreground">Booking time is incomplete, so availability checks may be inaccurate.</p>
              ) : null}
            </div>

            <div className="flex items-center gap-3">
              <Button
                onClick={handleAssignTable}
                disabled={!selectedTableId || tableActionState?.type === 'assign'}
                className="h-9"
              >
                {tableActionState?.type === 'assign' ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
                    Assigning…
                  </>
                ) : (
                  'Assign table'
                )}
              </Button>
            </div>
            </section>
          ) : null}

          <aside className="space-y-3 rounded-2xl border border-border/60 bg-muted/10 px-4 py-4">
            <h3 className="text-sm font-semibold text-foreground">Status actions</h3>
            <p className="text-xs text-muted-foreground">
              Keep the team in sync by recording shows and no-shows as service progresses.
            </p>
            <div className="flex flex-col gap-2">
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button disabled={isCancelled || booking.status === 'completed'} className="h-11">
                    Mark as show
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Mark booking as show?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Confirm that {booking.customerName} has arrived for their reservation.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel disabled={pendingStatus !== null}>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={() => {
                        void handleStatus('completed');
                      }}
                      disabled={pendingStatus !== null}
                    >
                      {pendingStatus === 'completed' ? 'Updating…' : 'Confirm'}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>

              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive" disabled={isCancelled || booking.status === 'no_show'} className="h-11">
                    Mark as no show
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Mark booking as no show?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This flags the booking as unattended. You can update the status again if the guest arrives later.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel disabled={pendingStatus !== null}>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={() => {
                        void handleStatus('no_show');
                      }}
                      disabled={pendingStatus !== null}
                    >
                      {pendingStatus === 'no_show' ? 'Updating…' : 'Confirm'}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>

            {isCancelled ? (
              <p className="flex items-center gap-2 rounded-md border border-dashed border-border/80 bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
                <AlertTriangle className="h-4 w-4" aria-hidden />
                This booking has been cancelled. Status changes are disabled.
              </p>
            ) : null}
          </aside>
        </div>
      </DialogContent>
    </Dialog>
  );
}

type InfoRowProps = {
  icon: ComponentType<{ className?: string }>;
  label: string;
  value: string;
  href?: string;
};

function InfoRow({ icon: Icon, label, value, href }: InfoRowProps) {
  const content = (
    <div className="flex flex-col">
      <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</span>
      <span className="text-sm text-foreground">{value}</span>
    </div>
  );

  return (
    <div className="flex items-center gap-3 rounded-2xl border border-border/60 bg-muted/10 px-4 py-3">
      <Icon className="h-4 w-4 text-muted-foreground" aria-hidden />
      {href ? (
        <a href={href} className="text-sm text-primary underline-offset-4 hover:underline">
          {content}
        </a>
      ) : (
        content
      )}
    </div>
  );
}

type DialogBookingWindow = {
  start: number;
  end: number;
};

function parseMinutes(value: string | null): number | null {
  if (!value) {
    return null;
  }
  const [hours, minutes] = value.split(':').map((part) => Number.parseInt(part, 10));
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) {
    return null;
  }
  return hours * 60 + minutes;
}

function computeDialogBookingWindow(startTime: string | null, endTime: string | null): DialogBookingWindow | null {
  const start = parseMinutes(startTime);
  if (start === null) {
    return null;
  }
  const endCandidate = parseMinutes(endTime);
  const end = endCandidate !== null && endCandidate > start ? endCandidate : start + DEFAULT_DURATION_MINUTES;
  return { start, end };
}

function windowsOverlap(a: DialogBookingWindow, b: DialogBookingWindow): boolean {
  return a.start < b.end && b.start < a.end;
}

function computeConflictingTableIds(
  bookings: OpsTodayBooking[],
  current: OpsTodayBooking,
  window: DialogBookingWindow | null,
): Set<string> {
  const conflicts = new Set<string>();
  if (!window) {
    return conflicts;
  }

  for (const booking of bookings) {
    if (booking.id === current.id) {
      continue;
    }

    if (!booking.tableAssignments || booking.tableAssignments.length === 0) {
      continue;
    }

    if (booking.status === 'cancelled' || booking.status === 'no_show') {
      continue;
    }

    const otherWindow = computeDialogBookingWindow(booking.startTime, booking.endTime);
    if (!otherWindow) {
      continue;
    }

    if (!windowsOverlap(window, otherWindow)) {
      continue;
    }

    for (const assignment of booking.tableAssignments) {
      conflicts.add(assignment.tableId);
    }
  }

  return conflicts;
}
