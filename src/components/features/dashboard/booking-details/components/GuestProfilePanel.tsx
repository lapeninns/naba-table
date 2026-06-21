'use client';

import { ChevronDown } from 'lucide-react';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

import { resolveGuestProfileFacts } from '../guestProfilePanelDomain';
import { ArrivalCountdown } from './ArrivalCountdown';
import { EmailDeliveryPanel } from './EmailDeliveryPanel';
import { GuestDietaryBadge } from './guest/GuestDietaryBadge';
import { GuestSeatingCard } from './guest/GuestSeatingCard';
import { GuestTimelineCard } from './guest/GuestTimelineCard';
import { GuestProfileIdentitySection } from './GuestProfileIdentitySection';
import { GuestProfileStatsGrid } from './GuestProfileStatsGrid';
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

      {/* ── 7. Timeline & Delivery Logs ─────────────────────────────────── */}
      <section className="flex flex-col gap-3 border-t border-border/30 pt-6">
        <Button
          type="button"
          variant="ghost"
          onClick={() => setDeliveryOpen((prev) => !prev)}
          className="h-auto w-full justify-between rounded-lg px-1 py-1 text-left hover:bg-muted/30"
          aria-expanded={deliveryOpen}
        >
          <h3 className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60">
            Timeline &amp; Delivery
          </h3>
          <ChevronDown
            data-icon="inline-end"
            className={cn(
              'text-muted-foreground/70 transition-transform',
              deliveryOpen && 'rotate-180',
            )}
            aria-hidden
          />
        </Button>
        <GuestTimelineCard status={status} booking={booking} timezone={timezone} />
        {deliveryOpen ? (
          <>
            <EmailDeliveryPanel bookingId={booking.id} timezone={timezone} enabled={deliveryOpen} />
            <SmsDeliveryPanel bookingId={booking.id} timezone={timezone} enabled={deliveryOpen} />
          </>
        ) : null}
      </section>
    </div>
  );
}

export default GuestProfilePanel;
