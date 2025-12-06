'use client';

import {
    Calendar,
    CalendarPlus,
    CheckCircle2,
    ChevronRight,
    Clock,
    Download,
    Mail,
    Share2,
    Users,
} from 'lucide-react';
import Link from 'next/link';
import { useCallback, useMemo } from 'react';

import { GuestCard, GuestHero, GuestSection, GuestStatus } from '@/components/guest/ui';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { emit } from '@/lib/analytics/emit';
import { shareReservationDetails } from '@/lib/reservations/share';
import { cn } from '@/lib/utils';
import { useReservation } from '@features/reservations/wizard/api/useReservation';
import { DEFAULT_VENUE } from '@shared/config/venue';


const formatDateFull = (iso: string | null | undefined) => {
    if (!iso) return '—';
    const parsed = new Date(iso);
    if (Number.isNaN(parsed.getTime())) return '—';
    return new Intl.DateTimeFormat(undefined, {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
        year: 'numeric',
    }).format(parsed);
};

const formatTime = (iso: string | null | undefined) => {
    if (!iso) return '—';
    const parsed = new Date(iso);
    if (Number.isNaN(parsed.getTime())) return '—';
    return new Intl.DateTimeFormat(undefined, {
        hour: 'numeric',
        minute: 'numeric',
    }).format(parsed);
};

type ReceiptClientProps = {
    reservationId: string;
    token: string | null;
    hasSession: boolean;
    prefetchedStatus: string | null;
};

export function ReceiptClient({
    reservationId,
    token,
    hasSession,
    prefetchedStatus: _prefetchedStatus,
}: ReceiptClientProps) {
    const { data: reservation, isLoading, isError } = useReservation(reservationId, token ?? undefined);

    const venue = useMemo(() => {
        if (!reservation) return DEFAULT_VENUE;
        return {
            name: reservation.restaurantName ?? DEFAULT_VENUE.name,
            timezone: reservation.restaurantTimezone ?? DEFAULT_VENUE.timezone,
            slug: reservation.restaurantSlug ?? DEFAULT_VENUE.slug,
        };
    }, [reservation]);

    const sharePayload = useMemo(() => {
        if (!reservation) return null;
        return {
            reservationId,
            reference: reservation.reference ?? null,
            guestName: reservation.customerName,
            partySize: reservation.partySize,
            startAt: reservation.startAt,
            endAt: reservation.endAt ?? undefined,
            venueName: venue.name,
            venueAddress: '',
            venueTimezone: venue.timezone,
        };
    }, [reservation, reservationId, venue]);

    const handleShare = useCallback(() => {
        if (!sharePayload) return;
        void emit('receipt_share_clicked', { reservationId });
        void shareReservationDetails(sharePayload);
    }, [sharePayload, reservationId]);

    const handleDownload = useCallback(() => {
        if (!reservation) return;
        void emit('receipt_download_clicked', { reservationId });
        const link = document.createElement('a');
        link.href = `/api/reservations/${reservation.id}/confirmation`;
        link.download = `reservation-${reservation.reference ?? reservation.id}.pdf`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }, [reservation, reservationId]);

    const handleAddToCalendar = useCallback(() => {
        if (!reservation) return;
        void emit('receipt_add_calendar_clicked', { reservationId });
        // Build Google Calendar URL
        const startDate = new Date(reservation.startAt);
        const endDate = reservation.endAt ? new Date(reservation.endAt) : new Date(startDate.getTime() + 90 * 60000);
        const formatGCalDate = (d: Date) => d.toISOString().replace(/-|:|\.\d{3}/g, '');
        const url = new URL('https://www.google.com/calendar/render');
        url.searchParams.set('action', 'TEMPLATE');
        url.searchParams.set('text', `Reservation at ${venue.name}`);
        url.searchParams.set('dates', `${formatGCalDate(startDate)}/${formatGCalDate(endDate)}`);
        url.searchParams.set('details', `Party of ${reservation.partySize}. Ref: ${reservation.reference ?? reservation.id.slice(0, 8).toUpperCase()}`);
        window.open(url.toString(), '_blank', 'noopener');
    }, [reservation, reservationId, venue.name]);

    // Loading State
    if (isLoading && !reservation) {
        return (
            <div className="min-h-[70vh] animate-fade-in px-4 py-12">
                <Skeleton className="mx-auto h-10 w-48 mb-6" />
                <Skeleton className="mx-auto h-8 w-64 mb-10" />
                <div className="mx-auto max-w-2xl space-y-4">
                    <Skeleton className="h-32 rounded-2xl" />
                    <Skeleton className="h-24 rounded-2xl" />
                </div>
            </div>
        );
    }

    // Error State
    if (isError || !reservation) {
        return (
            <div className="min-h-[70vh] flex items-center justify-center px-4 py-12">
                <GuestStatus
                    tone="error"
                    title="Unable to load receipt"
                    description="We couldn't find your booking details. The link may have expired."
                    actions={
                        <Link href="/guest/bookings">
                            <Button variant="outline" className="rounded-full mt-4">
                                View My Bookings
                            </Button>
                        </Link>
                    }
                />
            </div>
        );
    }

    const isConfirmed = reservation.status === 'confirmed' || reservation.status === 'completed' || reservation.status === 'checked_in';
    const isPending = reservation.status === 'pending' || reservation.status === 'pending_allocation';
    const isCancelled = reservation.status === 'cancelled';

    return (
        <div className="min-h-[70vh] px-4 py-12">
            <div className="mx-auto flex max-w-6xl flex-col gap-10">
                {/* Hero Section */}
                <GuestHero
                    badge={isConfirmed ? 'Confirmed' : isPending ? 'Pending' : 'Receipt'}
                    title={isCancelled ? 'Booking Cancelled' : 'You\'re all set!'}
                    description={
                        isCancelled
                            ? 'This reservation has been cancelled.'
                            : 'Your table is reserved. We\'ve sent a confirmation email with these details.'
                    }
                    ctas={
                        <>
                            <Button asChild size="lg" className="rounded-full">
                                <Link href={`/guest/bookings/${reservationId}`}>
                                    View Full Details
                                    <ChevronRight className="ml-1 h-5 w-5" />
                                </Link>
                            </Button>
                            <Button
                                asChild
                                variant="outline"
                                size="lg"
                                className="rounded-full border-slate-200"
                            >
                                <Link href="/restaurants">
                                    Browse Restaurants
                                </Link>
                            </Button>
                        </>
                    }
                />

                {/* Receipt Card */}
                <GuestCard className="overflow-hidden border-slate-100 shadow-lg">
                    <div className="border-b border-slate-100 bg-gradient-to-r from-slate-50 to-white px-6 py-5">
                        <div className="flex items-center justify-between">
                            <div>
                                <h2 className="text-xl font-bold text-slate-900">{venue.name}</h2>
                                <p className="mt-1 font-mono text-sm text-slate-500">
                                    Ref: {reservation.reference ?? reservation.id.slice(0, 8).toUpperCase()}
                                </p>
                            </div>
                            <Badge
                                className={cn(
                                    'rounded-full px-3 py-1 text-sm font-semibold border-0',
                                    isConfirmed && 'bg-emerald-100 text-emerald-700',
                                    isPending && 'bg-amber-100 text-amber-800',
                                    isCancelled && 'bg-red-100 text-red-700'
                                )}
                            >
                                <CheckCircle2 className="mr-1 h-4 w-4" />
                                {reservation.status.charAt(0).toUpperCase() + reservation.status.slice(1).replace('_', ' ')}
                            </Badge>
                        </div>
                    </div>

                    <div className="grid gap-0 divide-y divide-slate-50 sm:grid-cols-3 sm:divide-x sm:divide-y-0">
                        <ReceiptDetailCell
                            icon={Calendar}
                            label="Date"
                            value={formatDateFull(reservation.startAt)}
                        />
                        <ReceiptDetailCell
                            icon={Clock}
                            label="Time"
                            value={formatTime(reservation.startAt)}
                        />
                        <ReceiptDetailCell
                            icon={Users}
                            label="Party"
                            value={`${reservation.partySize} ${reservation.partySize === 1 ? 'Guest' : 'Guests'}`}
                        />
                    </div>

                    <div className="border-t border-slate-100 bg-slate-50/50 px-6 py-4">
                        <p className="text-sm text-slate-600">
                            <span className="font-semibold">{reservation.customerName}</span>
                            {reservation.customerEmail && (
                                <>
                                    <span className="mx-2 text-slate-300">·</span>
                                    {reservation.customerEmail}
                                </>
                            )}
                        </p>
                    </div>
                </GuestCard>

                {/* Actions */}
                <GuestSection className="bg-white" padding="md">
                    <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
                        <Button
                            variant="outline"
                            className="rounded-full border-slate-200"
                            onClick={handleAddToCalendar}
                        >
                            <CalendarPlus className="mr-2 h-4 w-4" />
                            Add to Calendar
                        </Button>
                        <Button
                            variant="outline"
                            className="rounded-full border-slate-200"
                            onClick={handleDownload}
                        >
                            <Download className="mr-2 h-4 w-4" />
                            Download PDF
                        </Button>
                        <Button
                            variant="outline"
                            className="rounded-full border-slate-200"
                            onClick={handleShare}
                        >
                            <Share2 className="mr-2 h-4 w-4" />
                            Share
                        </Button>
                    </div>
                </GuestSection>

                {/* Footer tip */}
                <div className="flex items-center justify-center gap-3 text-sm text-slate-500">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-50 text-blue-600">
                        <Mail className="h-5 w-5" />
                    </div>
                    <p>
                        A confirmation email has been sent. Save it for check-in.
                    </p>
                </div>

                {/* Sign in prompt for token-only access */}
                {!hasSession && (
                    <GuestStatus
                        tone="info"
                        title="Sign in for easier access"
                        description="Create an account to manage all your bookings in one place."
                        actions={
                            <Link
                                href={`/auth/signin?redirectedFrom=/guest/bookings/${reservationId}`}
                                className="font-semibold text-blue-700 hover:underline"
                            >
                                Sign In →
                            </Link>
                        }
                    />
                )}
            </div>
        </div>
    );
}

function ReceiptDetailCell({
    icon: Icon,
    label,
    value,
}: {
    icon: React.ElementType;
    label: string;
    value: string;
}) {
    return (
        <div className="flex items-center gap-4 px-6 py-5">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                <Icon className="h-5 w-5" />
            </div>
            <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">{label}</p>
                <p className="mt-0.5 font-semibold text-slate-900">{value}</p>
            </div>
        </div>
    );
}
