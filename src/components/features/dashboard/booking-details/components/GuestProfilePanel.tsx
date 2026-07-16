'use client';

import { ChevronDown } from 'lucide-react';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

import { resolveGuestProfileFacts } from '../guestProfilePanelDomain';
import { ArrivalCountdown } from './ArrivalCountdown';
import { BookingDeliveryPanel } from './BookingDeliveryPanel';
import { GuestDietaryBadge } from './guest/GuestDietaryBadge';
import { GuestSeatingCard } from './guest/GuestSeatingCard';
import { GuestTimelineCard } from './guest/GuestTimelineCard';
import { GuestProfileIdentitySection } from './GuestProfileIdentitySection';
import { GuestProfileStatsGrid } from './GuestProfileStatsGrid';

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
  const [deliveryOpen, setDeliveryOpen] = useState(false);
  const facts = resolveGuestProfileFacts({
    booking,
    bookingDate,
    timezone,
    status,
    minutesRemaining,
  });

  return (
    <div className="flex flex-col gap-6 w-full">
      {/* ── 1. Hero Identity Strip ───────────────────────────────────────── */}
      <GuestProfileIdentitySection
        booking={booking}
        initials={facts.initials}
        isLate={facts.isLate}
        whatsappHref={facts.whatsappHref}
        assignedTableRows={assignedTableRows}
      />

      {/* ── 2. Glassy Stat Grid ─────────────────────────────────────────── */}
      <GuestProfileStatsGrid
        formattedStartTime={facts.formattedStartTime}
        durationMinutes={facts.durationMinutes}
        partySize={booking.partySize}
        occasionLabel={facts.occasionLabel}
        depositLabel={facts.depositLabel}
        sourceLabel={facts.sourceLabel}
      />

      {/* ── 3. Arrival Countdown (urgent) ──────────────────────────────── */}
      {facts.showCountdown && (
        <section>
          <div
            className={cn(
              'flex items-center rounded-2xl border p-4',
              facts.isLate
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
      {facts.hasDietary && (
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
      {facts.hasNotes && (
        <section className="flex flex-col gap-3 rounded-2xl border border-border/40 bg-background/40 p-4 backdrop-blur-md">
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

      {/* ── 7. Timeline ─────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-6 border-t border-border/30 pt-6">
        <section className="flex flex-col gap-3" aria-labelledby="guest-timeline-heading">
          <h3
            id="guest-timeline-heading"
            className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/70"
          >
            Timeline
          </h3>
          <GuestTimelineCard status={status} booking={booking} timezone={timezone} />
        </section>

        {/* ── 8. Delivery (lazy) ─────────────────────────────────────────── */}
        <section className="flex flex-col gap-3" aria-labelledby="guest-delivery-heading">
          <Button
            type="button"
            variant="ghost"
            onClick={() => setDeliveryOpen((prev) => !prev)}
            className="h-auto w-full justify-between rounded-lg px-0 py-1 text-left hover:bg-transparent hover:text-foreground"
            aria-expanded={deliveryOpen}
            aria-controls="guest-delivery-panel"
          >
            <span
              id="guest-delivery-heading"
              className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/70"
            >
              Delivery
            </span>
            <ChevronDown
              data-icon="inline-end"
              className={cn(
                'text-muted-foreground/70 transition-transform',
                deliveryOpen && 'rotate-180',
              )}
              aria-hidden
            />
          </Button>
          {deliveryOpen ? (
            <div id="guest-delivery-panel">
              <BookingDeliveryPanel
                bookingId={booking.id}
                timezone={timezone}
                enabled={deliveryOpen}
              />
            </div>
          ) : null}
        </section>
      </div>
    </div>
  );
}

export default GuestProfilePanel;
