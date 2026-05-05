'use client';

import {
  Calendar,
  Clock,
  CreditCard,
  Mail,
  MessageCircle,
  MessageSquare,
  Phone,
  Users,
} from 'lucide-react';
import { useMemo } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

import { formatBookingTime, formatPhoneForTel, getGuestInitials, parseBookingDateTime } from '../utils';
import { ArrivalCountdown } from './ArrivalCountdown';
import { EmailDeliveryPanel } from './EmailDeliveryPanel';
import { GuestDietaryBadge } from './guest/GuestDietaryBadge';
import { GuestSeatingCard } from './guest/GuestSeatingCard';
import { GuestTimelineCard } from './guest/GuestTimelineCard';
import { SmsDeliveryPanel } from './SmsDeliveryPanel';

import type { FlattenedTable } from '../utils';
import type { OpsBookingStatus, OpsTodayBooking } from '@/types/ops';

export interface GuestProfilePanelProps {
  booking: OpsTodayBooking;
  bookingDate: string | null;
  timezone: string;
  status: OpsBookingStatus;
  minutesRemaining: number | null;
  assignedTableRows: FlattenedTable[];
  totalCapacity: number;
  capacityPercent: number;
  enableDesktopTabs?: boolean;
}

function formatDepositGBP(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  const parsed =
    typeof value === 'number'
      ? value
      : typeof value === 'string'
        ? Number(value)
        : Number.NaN;
  if (!Number.isNaN(parsed) && Number.isFinite(parsed)) {
    return new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(parsed);
  }
  if (typeof value === 'string' && value.trim().length > 0) return value.trim();
  return null;
}

// ---------------------------------------------------------------------------
// Small atom: a single data chip used in the stat-grid
// ---------------------------------------------------------------------------
function StatChip({
  icon: Icon,
  label,
  value,
  accent = false,
}: {
  icon: React.ElementType;
  label: string;
  value: React.ReactNode;
  accent?: boolean;
}) {
  return (
    <div
      className={cn(
        'flex flex-col gap-1 rounded-2xl border p-4 transition-colors',
        accent
          ? 'border-primary/20 bg-primary/5 hover:bg-primary/10'
          : 'border-border/40 bg-background/40 hover:bg-background/60 backdrop-blur-md',
      )}
    >
      <div className="flex items-center gap-1.5 text-muted-foreground mb-0.5">
        <Icon className={cn('h-3.5 w-3.5', accent ? 'text-primary' : 'text-muted-foreground')} />
        <span className="text-[10px] font-bold uppercase tracking-widest">{label}</span>
      </div>
      <div className="text-sm font-bold text-foreground leading-snug">{value}</div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export function GuestProfilePanel({
  booking,
  bookingDate,
  timezone,
  status,
  minutesRemaining,
  assignedTableRows,
  totalCapacity,
  capacityPercent,
}: GuestProfilePanelProps) {
  const formattedStartTime = useMemo(
    () => formatBookingTime(booking.startTime, bookingDate, timezone),
    [booking.startTime, bookingDate, timezone],
  );

  const durationMinutes = useMemo(() => {
    if (!bookingDate) return null;
    const start = parseBookingDateTime({ time: booking.startTime, date: bookingDate, timezone });
    const end = parseBookingDateTime({ time: booking.endTime, date: bookingDate, timezone });
    if (!start || !end) return null;
    const minutes = Math.max(0, Math.round(end.diff(start, 'minutes').minutes ?? 0));
    return Number.isFinite(minutes) ? minutes : null;
  }, [booking.endTime, booking.startTime, bookingDate, timezone]);

  const whatsappHref = useMemo(() => {
    const digits = booking.customerPhone ? booking.customerPhone.replace(/[^0-9]/g, '') : '';
    return digits ? `https://wa.me/${digits}` : null;
  }, [booking.customerPhone]);

  const sourceLabel = booking.source ?? 'Direct';
  const occasionLabel =
    booking.details && typeof booking.details['occasion'] === 'string'
      ? String(booking.details['occasion'])
      : 'Standard';

  const depositRaw =
    booking.details?.['deposit'] ??
    booking.details?.['depositAmount'] ??
    booking.details?.['prepay'] ??
    booking.details?.['prepayAmount'] ??
    booking.details?.['prepaidAmount'];
  const depositLabel = formatDepositGBP(depositRaw);

  const initials = getGuestInitials(booking.customerName);
  const isLate = status === 'confirmed' && minutesRemaining !== null && minutesRemaining < 0;
  const hasDietary =
    Boolean(booking.allergies && booking.allergies.length > 0) ||
    Boolean(booking.dietaryRestrictions && booking.dietaryRestrictions.length > 0);
  const showCountdown =
    minutesRemaining !== null &&
    minutesRemaining > -120 &&
    !['completed', 'cancelled', 'no_show', 'checked_in'].includes(status);
  const hasNotes = Boolean(booking.notes) || Boolean(booking.profileNotes);

  return (
    <div className="flex flex-col gap-6 w-full">

      {/* ── 1. Hero Identity Strip ───────────────────────────────────────── */}
      <section className="relative flex items-start gap-4">
        {/* Ambient glow behind avatar */}
        <div
          className={cn(
            'absolute -top-2 -left-2 h-24 w-24 rounded-full blur-3xl opacity-30 pointer-events-none',
            isLate ? 'bg-destructive' : 'bg-primary',
          )}
          aria-hidden
        />

        {/* Avatar */}
        <div
          className={cn(
            'relative z-10 flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl text-base font-extrabold uppercase tracking-wider shadow-lg ring-2',
            isLate
              ? 'bg-destructive/20 text-destructive ring-destructive/20'
              : 'bg-primary/15 text-primary ring-primary/20',
          )}
          aria-hidden
        >
          {initials}
        </div>

        {/* Name + labels */}
        <div className="relative z-10 min-w-0 flex-1 pt-0.5">
          <h2 className="truncate text-xl font-extrabold tracking-tight text-foreground leading-tight">
            {booking.customerName}
          </h2>
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            <Badge
              variant="secondary"
              className="bg-muted/80 text-muted-foreground border-border/50 text-[10px] font-bold uppercase tracking-widest px-2 py-0.5"
            >
              Primary Guest
            </Badge>
            {isLate && (
              <Badge
                variant="outline"
                className="border-destructive/30 bg-destructive/10 text-destructive text-[10px] font-bold uppercase tracking-widest px-2 py-0.5"
              >
                Late
              </Badge>
            )}
            {booking.requiresTableAssignment && assignedTableRows.length === 0 && (
              <Badge
                variant="outline"
                className="border-border/40 bg-muted/40 text-muted-foreground text-[10px] font-bold uppercase tracking-widest px-2 py-0.5"
              >
                No table
              </Badge>
            )}
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            {booking.customerPhone && (
              <Button
                variant="outline"
                size="sm"
                asChild
                className="h-auto gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold"
              >
                <a href={`tel:${formatPhoneForTel(booking.customerPhone)}`}>
                  <Phone className="h-3.5 w-3.5 text-primary" />
                  {booking.customerPhone}
                </a>
              </Button>
            )}
            {whatsappHref && (
              <Button
                variant="outline"
                size="sm"
                asChild
                className="h-auto gap-1.5 rounded-xl border-primary/30 bg-primary/5 px-3 py-1.5 text-xs font-semibold text-primary hover:bg-primary/10 hover:text-primary"
              >
                <a href={whatsappHref} target="_blank" rel="noopener noreferrer">
                  <MessageCircle className="h-3.5 w-3.5" />
                  WhatsApp
                </a>
              </Button>
            )}
            {booking.customerEmail && (
              <Button
                variant="outline"
                size="sm"
                asChild
                className="h-auto gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold"
              >
                <a href={`mailto:${booking.customerEmail}`}>
                  <Mail className="h-3.5 w-3.5 text-primary" />
                  Email
                </a>
              </Button>
            )}
          </div>
        </div>
      </section>

      {/* ── 2. Glassy Stat Grid ─────────────────────────────────────────── */}
      <section className="grid grid-cols-2 gap-2.5 sm:grid-cols-2">
        <StatChip icon={Clock} label="Time" value={
          <span>
            {formattedStartTime}
            {durationMinutes && (
              <span className="ml-1.5 text-xs font-normal text-muted-foreground">
                {Math.floor(durationMinutes / 60) > 0
                  ? `${Math.floor(durationMinutes / 60)}h ${durationMinutes % 60}m`
                  : `${durationMinutes}m`}
              </span>
            )}
          </span>
        } accent />
        <StatChip icon={Users} label="Party" value={`${booking.partySize} guests`} accent />
        <StatChip icon={Calendar} label="Occasion" value={<span className="capitalize">{occasionLabel}</span>} />
        <StatChip
          icon={CreditCard}
          label="Deposit"
          value={depositLabel ?? <span className="text-muted-foreground font-normal text-xs">None</span>}
        />
        <StatChip
          icon={MessageSquare}
          label="Source"
          value={<span className="capitalize">{sourceLabel}</span>}
        />
      </section>

      {/* ── 3. Arrival Countdown (urgent) ──────────────────────────────── */}
      {showCountdown && (
        <section>
          <div
            className={cn(
              'flex items-center rounded-2xl border p-4',
              isLate
                ? 'border-destructive/20 bg-destructive/5'
                : 'border-primary/15 bg-primary/5',
            )}
          >
            <ArrivalCountdown
              status={status}
              startTime={booking.startTime}
              date={bookingDate}
              timezone={timezone}
            />
          </div>
        </section>
      )}

      {/* ── 4. Dietary / Allergy Alert ──────────────────────────────────── */}
      {hasDietary && (
        <section className="rounded-2xl border border-border/40 bg-muted/30 p-4">
          <h3 className="mb-3 text-[10px] font-bold uppercase tracking-widest text-muted-foreground/70">
            Dietary Requirements
          </h3>
          <GuestDietaryBadge
            allergies={booking.allergies}
            dietaryRestrictions={booking.dietaryRestrictions}
          />
        </section>
      )}

      {/* ── 5. Notes ────────────────────────────────────────────────────── */}
      {hasNotes && (
        <section className="rounded-2xl border border-border/40 bg-background/40 backdrop-blur-md p-4 space-y-3">
          <h3 className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/70">
            Notes &amp; Preferences
          </h3>
          {booking.notes && (
            <div className="rounded-xl border border-border/30 bg-muted/30 p-3 text-sm text-foreground">
              <span className="mr-2 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                Booking:
              </span>
              {booking.notes}
            </div>
          )}
          {booking.profileNotes && (
            <div className="rounded-xl border border-primary/15 bg-primary/5 p-3 text-sm text-foreground">
              <span className="mr-2 text-[10px] font-bold uppercase tracking-widest text-primary/60">
                Profile:
              </span>
              {booking.profileNotes}
            </div>
          )}
        </section>
      )}

      {/* ── 6. Seating ──────────────────────────────────────────────────── */}
      <section className="overflow-hidden rounded-2xl border border-border/40 shadow-sm">
        <GuestSeatingCard
          assignedTableRows={assignedTableRows}
          totalCapacity={totalCapacity}
          capacityPercent={capacityPercent}
          partySize={booking.partySize}
          seatingPreference={booking.seatingPreference ?? null}
        />
      </section>

      {/* ── 7. Timeline & Delivery Logs ─────────────────────────────────── */}
      <section className="space-y-3 border-t border-border/30 pt-6">
        <h3 className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60 px-1">
          Timeline &amp; Delivery
        </h3>
        <GuestTimelineCard status={status} booking={booking} timezone={timezone} />
        <EmailDeliveryPanel bookingId={booking.id} timezone={timezone} />
        <SmsDeliveryPanel bookingId={booking.id} timezone={timezone} />
      </section>
    </div>
  );
}

export default GuestProfilePanel;
