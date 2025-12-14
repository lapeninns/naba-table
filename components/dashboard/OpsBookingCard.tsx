import { DateTime } from 'luxon';
import {
    AlertTriangle,
    Armchair,
    Check,
    Clock,
    FileText,
    LogIn,
    LogOut,
    Sparkles,
    Users,
    Utensils,
    X,
} from 'lucide-react';
import { useMemo } from 'react';

import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import type { BookingDTO } from '@/hooks/useBookings';
import { deriveBookingDisplayState, isBookingPast } from './BookingRow';

export type OpsBookingCardProps = {
    booking: BookingDTO;
    timezone: string;
    now?: DateTime; // Defaults to DateTime.now().setZone(timezone)
    onEdit?: (booking: BookingDTO) => void;
    onCancel?: (booking: BookingDTO) => void;
    onDetails?: (booking: BookingDTO) => void;
    onCheckIn?: (bookingId: string) => Promise<void>;
    onCheckOut?: (bookingId: string) => Promise<void>;
    onMarkNoShow?: (bookingId: string) => Promise<void>;
    onUndoNoShow?: (bookingId: string) => Promise<void>;
    onAssignTable?: (bookingId: string, tableId: string) => Promise<any>;
    onUnassignTable?: (bookingId: string, tableId: string) => Promise<any>;
    pendingAction?: 'check-in' | 'check-out' | 'no-show' | 'undo-no-show' | null;
    allowTableAssignments?: boolean;
    highlightUrgency?: boolean;
};

const StatusIndicator = ({ status }: { status: string }) => {
    const styles: Record<string, string> = {
        pending: 'bg-amber-500',
        pending_allocation: 'bg-amber-500',
        confirmed: 'bg-blue-500',
        PRIORITY_WAITLIST: 'bg-blue-500',
        checked_in: 'bg-emerald-500',
        completed: 'bg-slate-400',
        no_show: 'bg-rose-500',
        cancelled: 'bg-slate-300',
    };

    const labels: Record<string, string> = {
        confirmed: 'Expected',
        PRIORITY_WAITLIST: 'Expected',
        pending: 'Pending',
        pending_allocation: 'Pending',
        checked_in: 'Seated',
        completed: 'Left',
        no_show: 'No Show',
        cancelled: 'Cancelled',
    };

    const colorClass = styles[status] || styles['confirmed'];
    const label = labels[status] || status.replace('_', ' ');

    return (
        <div className="flex items-center gap-2">
            <span className={cn('h-2 w-2 rounded-full', colorClass)} />
            <span className={cn('text-xs font-medium', status === 'completed' || status === 'cancelled' ? 'text-slate-400' : 'text-slate-700')}>
                {label}
            </span>
        </div>
    );
};

const TableAssignment = ({ assignments, status }: {
    assignments: BookingDTO['tableAssignments'],
    status: string,
}) => {
    if (!assignments || assignments.length === 0) {
        if (status === 'confirmed' || status === 'PRIORITY_WAITLIST') {
            return (
                <div className="flex items-center gap-1.5 text-amber-600">
                    <AlertTriangle className="h-3.5 w-3.5" />
                    <span className="text-xs font-medium">No Table</span>
                </div>
            );
        }
        return <span className="text-xs text-slate-400 italic">No table</span>;
    }

    // Generate table label
    const labels: string[] = [];
    for (const group of assignments) {
        const members = group.members ?? [];
        const memberLabels = members.map((member) => member.tableNumber || '—');
        labels.push(memberLabels.join(' + '));
    }
    const displayTables = labels.join(', ');

    return (
        <div className="flex items-center gap-1.5 text-slate-700">
            <Armchair className="h-3.5 w-3.5 text-slate-400" />
            <span className="text-xs font-semibold">Table {displayTables}</span>
        </div>
    );
};

export function OpsBookingCard({
    booking,
    timezone,
    now: propNow,
    onEdit,
    onCancel,
    onDetails,
    onCheckIn,
    onCheckOut,
    onMarkNoShow,
    pendingAction,
    highlightUrgency = true,
}: OpsBookingCardProps) {
    const now = useMemo(() => propNow ?? DateTime.now().setZone(timezone), [propNow, timezone]);

    // Use derived state for consistency
    const isPastBooking = isBookingPast(booking);
    const { displayStatus } = deriveBookingDisplayState(booking, { isPastView: false });

    // Status checks
    const isDone = booking.status === 'completed' || booking.status === 'cancelled' || booking.status === 'no_show';
    const isSeated = booking.status === 'checked_in';
    const isUpcoming = !isDone && (displayStatus === 'confirmed' || displayStatus === 'PRIORITY_WAITLIST' || booking.status === 'pending' || booking.status === 'pending_allocation');

    const isLoading = Boolean(pendingAction);

    // Parse Times
    const parseTime = (t: string | null) => {
        if (!t) return null;
        let dt = DateTime.fromFormat(t, 'HH:mm:ss');
        if (!dt.isValid) dt = DateTime.fromFormat(t, 'HH:mm');
        return dt.isValid ? dt : null;
    };

    const startIso = DateTime.fromISO(booking.startIso).setZone(timezone);
    const endIso = booking.endIso ? DateTime.fromISO(booking.endIso).setZone(timezone) : null;

    const startTimeStr = startIso.isValid ? startIso.toFormat('h:mm a') : '--:--';
    const endTimeStr = endIso?.isValid ? endIso.toFormat('h:mm a') : null;
    const startDateStr = startIso.isValid ? startIso.toFormat('EEE, MMM d') : '';

    // Time urgency calculation
    const timeUrgency = useMemo(() => {
        if (!highlightUrgency || !isUpcoming || !startIso.isValid) return null;
        const bookingDate = startIso.toISODate();
        const todayDate = now.toISODate();
        if (bookingDate !== todayDate) return null;

        const diffMinutes = startIso.diff(now, 'minutes').minutes;

        if (diffMinutes <= -15) {
            return { type: 'late' as const, label: `${Math.abs(Math.round(diffMinutes))} min late` };
        } else if (diffMinutes <= 0 && diffMinutes > -15) {
            return { type: 'overdue' as const, label: 'Past time' };
        } else if (diffMinutes <= 10 && diffMinutes > 0) {
            return { type: 'soon' as const, label: `${Math.round(diffMinutes)} min` };
        } else if (diffMinutes <= 30 && diffMinutes > 0) {
            return { type: 'approaching' as const, label: `${Math.round(diffMinutes)} min` };
        }
        return null;
    }, [highlightUrgency, isUpcoming, startIso, now]);

    // Guest Initials
    const guestInitials = (booking.customerName || 'Guest')
        .split(' ')
        .filter(Boolean)
        .map((n) => n[0])
        .join('')
        .substring(0, 2)
        .toUpperCase();

    const handleMainAction = async () => {
        if (!isSeated && onCheckIn) await onCheckIn(booking.id);
        if (isSeated && onCheckOut) await onCheckOut(booking.id);
    };

    // Card Background Styles
    const cardBgClass = useMemo(() => {
        if (isDone) return 'border-border/60 bg-muted/40';
        if (timeUrgency?.type === 'late') return 'border-destructive/40 bg-destructive/5';
        if (timeUrgency?.type === 'overdue') return 'border-amber-500/40 bg-amber-500/5';
        if (timeUrgency?.type === 'soon') return 'border-amber-500/20 bg-amber-500/5';
        return 'border-border/60 bg-card/60 hover:bg-card hover:shadow-md';
    }, [isDone, timeUrgency]);

    return (
        <Card className={cn(
            'group relative flex flex-col gap-3 p-3 transition-all sm:gap-4 sm:p-4 sm:flex-row sm:items-center',
            cardBgClass,
            isLoading && 'opacity-60 pointer-events-none animate-pulse'
        )}>
            {/* Loading overlay */}
            {isLoading && (
                <div className="absolute inset-0 z-10 flex items-center justify-center rounded-xl bg-background/50 backdrop-blur-[1px]">
                    <div className="flex items-center gap-2 rounded-full bg-background border px-3 py-1.5 shadow-lg">
                        <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                        <span className="text-xs font-medium text-foreground">Processing...</span>
                    </div>
                </div>
            )}

            {/* ZONE 1: LOGISTICS (Time & Party) */}
            <div className="flex min-w-[100px] shrink-0 flex-row items-center gap-4 sm:flex-col sm:items-start sm:gap-1">
                <div className="flex flex-col">
                    <span className={cn('text-[10px] font-bold uppercase tracking-wider', isDone ? 'text-muted-foreground' : 'text-muted-foreground')}>
                        {startDateStr}
                    </span>
                    <span className={cn('font-mono text-lg font-bold leading-none tracking-tight', isDone ? 'text-muted-foreground line-through decoration-border' : 'text-foreground')}>
                        {startTimeStr}
                    </span>
                    <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">
                        {endTimeStr ? `Until ${endTimeStr}` : 'Open End'}
                    </span>
                </div>

                <div className="hidden h-px w-8 bg-border sm:block" />

                <div className="flex items-center gap-1.5">
                    <Users className={cn('h-3.5 w-3.5', isDone ? 'text-muted-foreground' : 'text-muted-foreground')} />
                    <span className={cn('text-sm font-medium', isDone ? 'text-muted-foreground' : 'text-foreground')}>
                        {booking.partySize} guests
                    </span>
                </div>

                {timeUrgency && (
                    <Badge
                        variant={timeUrgency.type === 'late' ? 'destructive' : 'secondary'}
                        className={cn(
                            'gap-1 rounded-full text-[10px] animate-pulse px-1.5 py-0 h-5',
                            timeUrgency.type === 'overdue' && 'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-800',
                            timeUrgency.type === 'soon' && 'bg-amber-50 text-amber-600 border-amber-100 dark:bg-amber-900/20 dark:text-amber-300 dark:border-amber-800',
                            timeUrgency.type === 'approaching' && 'bg-blue-50 text-blue-600 border-blue-100 dark:bg-blue-900/20 dark:text-blue-300 dark:border-blue-800'
                        )}
                    >
                        <Clock className="h-3 w-3" />
                        {timeUrgency.label}
                    </Badge>
                )}
            </div>

            {/* ZONE 2: IDENTITY */}
            <div className="flex flex-1 flex-col gap-2">
                <div className="flex items-center gap-3">
                    <Avatar className={cn(isDone ? 'bg-muted' : 'bg-primary/10')}>
                        <AvatarFallback className={cn(
                            'text-xs font-bold',
                            isDone ? 'text-muted-foreground' : 'text-primary'
                        )}>
                            {guestInitials}
                        </AvatarFallback>
                    </Avatar>
                    <div>
                        <div className="flex items-center gap-2">
                            <span className={cn('text-base font-semibold', isDone ? 'text-muted-foreground line-through decoration-border' : 'text-foreground')}>
                                {booking.customerName}
                            </span>
                            {booking.loyaltyTier && (
                                <Sparkles
                                    className={cn(
                                        'h-3.5 w-3.5',
                                        booking.loyaltyTier === 'platinum' ? 'text-indigo-500' :
                                            booking.loyaltyTier === 'gold' ? 'text-amber-500' : 'text-muted-foreground'
                                    )}
                                    fill="currentColor"
                                />
                            )}
                        </div>
                        {booking.customerEmail && (
                            <span className="text-xs text-muted-foreground block truncate max-w-[250px]">{booking.customerEmail}</span>
                        )}
                    </div>
                </div>

                <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                    <StatusIndicator status={booking.status} />
                    <div className="h-3 w-px bg-border" />
                    <TableAssignment
                        assignments={booking.tableAssignments}
                        status={booking.status}
                    />
                </div>

                {(booking.allergies?.length || booking.notes || booking.seatingPreference || booking.dietaryRestrictions) ? (
                    <div className="mt-1 flex flex-wrap gap-2 text-xs">
                        {booking.allergies?.map((allergy, i) => (
                            <Badge key={`alg-${i}`} variant="destructive" className="gap-1 px-1.5 py-0 h-5 font-normal">
                                <AlertTriangle className="h-3 w-3" />
                                {allergy}
                            </Badge>
                        ))}
                        {booking.notes && (
                            <Badge variant="secondary" className="gap-1 max-w-[240px] truncate px-1.5 py-0 h-5 font-normal bg-muted text-muted-foreground hover:bg-muted" title={booking.notes}>
                                <FileText className="h-3 w-3 shrink-0" />
                                <span className="truncate">{booking.notes}</span>
                            </Badge>
                        )}
                        {booking.seatingPreference && (
                            <Badge variant="outline" className="gap-1 max-w-[150px] truncate px-1.5 py-0 h-5 font-normal" title={booking.seatingPreference}>
                                <Armchair className="h-3 w-3 shrink-0" />
                                <span className="truncate">{booking.seatingPreference}</span>
                            </Badge>
                        )}
                        {booking.dietaryRestrictions && booking.dietaryRestrictions.length > 0 && (
                            <Badge variant="outline" className="gap-1 max-w-[150px] truncate bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/20 dark:text-amber-300 dark:border-amber-800 px-1.5 py-0 h-5 font-normal" title={booking.dietaryRestrictions.join(', ')}>
                                <Utensils className="h-3 w-3 shrink-0" />
                                <span className="truncate">{booking.dietaryRestrictions.join(', ')}</span>
                            </Badge>
                        )}
                    </div>
                ) : null}
            </div>

            {/* ZONE 3: ACTIONS */}
            <div className="flex shrink-0 items-center justify-between gap-2 border-t border-border pt-3 sm:mt-0 sm:flex-col sm:items-end sm:border-0 sm:pt-0 sm:gap-3">
                {!isDone ? (
                    <>
                        {(onCheckIn && !isSeated) || (onCheckOut && isSeated) ? (
                            <Button
                                size="sm"
                                className={cn(
                                    'flex-1 h-11 sm:h-auto sm:w-auto shadow-sm transition-all',
                                    isSeated
                                        ? 'bg-background border border-emerald-500/20 text-emerald-600 hover:bg-emerald-50 hover:text-emerald-700 dark:hover:bg-emerald-950/30'
                                        : ''
                                )}
                                variant={isSeated ? 'outline' : 'default'}
                                onClick={handleMainAction}
                                disabled={isLoading}
                            >
                                {isSeated ? <LogOut className="mr-2 h-3.5 w-3.5" /> : <LogIn className="mr-2 h-3.5 w-3.5" />}
                                {isSeated ? 'Finish' : 'Seat Guest'}
                            </Button>
                        ) : null}

                        <div className="flex gap-1">
                            {!isSeated && onMarkNoShow && (
                                <Button
                                    size="icon"
                                    variant="ghost"
                                    className="h-9 w-9 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                                    onClick={() => onMarkNoShow(booking.id)}
                                    title="Mark as no-show"
                                >
                                    <X className="h-4 w-4" />
                                </Button>
                            )}

                            {onDetails && (
                                <Button
                                    type="button"
                                    variant="outline"
                                    className="h-9 px-3 text-muted-foreground hover:text-foreground"
                                    onClick={() => onDetails(booking)}
                                >
                                    Details
                                </Button>
                            )}
                        </div>

                        {(onEdit || onCancel) && (
                            <div className="flex gap-1">
                                {onEdit && (
                                    <Button variant="ghost" size="sm" onClick={() => onEdit(booking)} disabled={isLoading} className="h-7 text-xs text-muted-foreground hover:text-foreground">
                                        Edit
                                    </Button>
                                )}
                                {onCancel && (
                                    <Button variant="ghost" size="sm" onClick={() => onCancel(booking)} disabled={isLoading} className="h-7 text-xs text-muted-foreground hover:text-destructive hover:bg-destructive/10">
                                        Cancel
                                    </Button>
                                )}
                            </div>
                        )}
                    </>
                ) : (
                    <Button size="sm" variant="ghost" className="w-full cursor-default text-muted-foreground hover:bg-transparent sm:w-auto" disabled>
                        <Check className="mr-2 h-3.5 w-3.5" />
                        {booking.status === 'completed' ? 'Completed' : 'Cancelled'}
                    </Button>
                )}
            </div>
        </Card>
    );
}
