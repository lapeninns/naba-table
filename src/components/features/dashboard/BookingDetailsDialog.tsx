'use client';

import { Mail, Phone, Clock, Users, Calendar as CalendarIcon, AlertTriangle, Award, CheckCircle2, XCircle } from 'lucide-react';
import { useState, type ComponentType } from 'react';

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
import { cn } from '@/lib/utils';
import { formatDateReadable, formatTimeRange } from '@/lib/utils/datetime';

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
};

export function BookingDetailsDialog({ booking, summary, onStatusChange }: BookingDetailsDialogProps) {
  const [pendingStatus, setPendingStatus] = useState<'completed' | 'no_show' | null>(null);

  const mailHref = booking.customerEmail ? `mailto:${booking.customerEmail}` : null;
  const phoneHref = booking.customerPhone ? `tel:${booking.customerPhone.replace(/[^+\d]/g, '')}` : null;

  const serviceDateReadable = formatDateReadable(summary.date, summary.timezone);
  const serviceTime = formatTimeRange(booking.startTime, booking.endTime, summary.timezone);

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
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="h-11 md:h-9">
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
