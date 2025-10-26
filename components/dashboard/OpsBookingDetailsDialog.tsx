'use client';

import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';

import { StatusChip } from './StatusChip';

import type { BookingDTO } from '@/hooks/useBookings';


type OpsBookingDetailsDialogProps = {
  booking: BookingDTO;
  formatDate: (iso: string) => string;
  formatTime: (iso: string) => string;
};

type InfoItemProps = {
  label: string;
  value: string | null;
  href?: string | null;
};

function InfoItem({ label, value, href }: InfoItemProps) {
  const displayValue = value && value.trim().length > 0 ? value.trim() : '—';
  const content =
    href && displayValue !== '—' ? (
      <a href={href} className="text-sm text-primary underline-offset-2 hover:underline">
        {displayValue}
      </a>
    ) : (
      <span className="text-sm text-foreground">{displayValue}</span>
    );

  return (
    <div className="space-y-1">
      <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd>{content}</dd>
    </div>
  );
}

export function OpsBookingDetailsDialog({ booking, formatDate, formatTime }: OpsBookingDetailsDialogProps) {
  const serviceDate = formatDate(booking.startIso);
  const startTime = formatTime(booking.startIso);
  const endTime = booking.endIso ? formatTime(booking.endIso) : null;
  const hasEndTime = endTime && endTime !== '—' && endTime !== startTime;
  const timeLabel = hasEndTime ? `${startTime} – ${endTime}` : startTime;
  const customerLabel = booking.customerName?.trim() || 'Guest name unavailable';
  const emailLabel = booking.customerEmail?.trim() || null;
  const phoneLabel = booking.customerPhone?.trim() || null;
  const sanitizedPhone = phoneLabel ? phoneLabel.replace(/[^+\d]/g, '') : '';
  const phoneHref = sanitizedPhone.length > 0 ? `tel:${sanitizedPhone}` : null;
  const restaurantLabel = booking.restaurantName?.trim() || '—';

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button type="button" size="sm" variant="outline">
          Details
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md space-y-5">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between gap-3 text-left text-lg font-semibold text-foreground">
            <span>{customerLabel}</span>
            <StatusChip status={booking.status} />
          </DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground">
            {serviceDate} · {timeLabel}
          </DialogDescription>
        </DialogHeader>

        <dl className="grid gap-4 sm:grid-cols-2">
          <InfoItem label="Restaurant" value={restaurantLabel} />
          <InfoItem label="Party size" value={`${booking.partySize}`} />
          <InfoItem label="Customer email" value={emailLabel} href={emailLabel ? `mailto:${emailLabel}` : null} />
          <InfoItem label="Customer phone" value={phoneLabel} href={phoneHref} />
          <InfoItem label="Status" value={booking.status.replace(/_/g, ' ')} />
        </dl>

        <section className="space-y-2">
          <h3 className="text-sm font-semibold text-foreground">Notes</h3>
          <p className="rounded-lg border border-border/60 bg-muted/20 px-3 py-2 text-sm text-muted-foreground">
            {booking.notes?.trim() && booking.notes.trim().length > 0 ? booking.notes.trim() : 'No notes added.'}
          </p>
        </section>
      </DialogContent>
    </Dialog>
  );
}
