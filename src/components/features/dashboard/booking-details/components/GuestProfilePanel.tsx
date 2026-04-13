'use client';

import { useMemo } from 'react';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';

import { ArrivalCountdown } from './ArrivalCountdown';
import { EmailDeliveryPanel } from './EmailDeliveryPanel';
import { SmsDeliveryPanel } from './SmsDeliveryPanel';
import { formatBookingTime, parseBookingDateTime } from '../utils';
import { GuestContactCard } from './guest/GuestContactCard';
import { GuestDepositCard } from './guest/GuestDepositCard';
import { GuestDietaryBadge } from './guest/GuestDietaryBadge';
import { GuestIdentityCard } from './guest/GuestIdentityCard';
import { GuestMetaGrid } from './guest/GuestMetaGrid';
import { GuestNotesCard } from './guest/GuestNotesCard';
import { GuestSeatingCard } from './guest/GuestSeatingCard';
import { GuestTimelineCard } from './guest/GuestTimelineCard';

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
  /**
   * When true, the panel renders a desktop-only IA using Tabs to reduce scanning cost.
   * Mobile and constrained layouts should keep the linear stack.
   */
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

  if (typeof value === 'string' && value.trim().length > 0) {
    return value.trim();
  }

  return null;
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
  enableDesktopTabs = false,
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

  const sourceLabel = booking.source ? booking.source : 'Direct';
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

  const isLate = status === 'confirmed' && minutesRemaining !== null && minutesRemaining < 0;
  const hasDietary =
    Boolean(booking.allergies && booking.allergies.length > 0) ||
    Boolean(booking.dietaryRestrictions && booking.dietaryRestrictions.length > 0);

  const CriticalStrip = (
    <div className="flex flex-wrap items-center gap-2">
      {hasDietary ? (
        <GuestDietaryBadge
          allergies={booking.allergies}
          dietaryRestrictions={booking.dietaryRestrictions}
        />
      ) : null}

      {isLate ? (
        <Badge variant="outline" className="border-rose-200 bg-rose-50 text-rose-800">
          Late
        </Badge>
      ) : null}

      {booking.requiresTableAssignment && assignedTableRows.length === 0 ? (
        <Badge variant="outline" className="border-amber-200 bg-amber-50 text-amber-900">
          No table assigned
        </Badge>
      ) : null}
    </div>
  );

  const CountdownCard =
    minutesRemaining !== null && minutesRemaining > -120 ? (
      <Card
        className={cn(
          'border-slate-200/60 bg-white shadow-sm',
          isLate && 'border-rose-200 bg-rose-50/40',
        )}
      >
        <CardContent className="p-4">
          <ArrivalCountdown
            status={status}
            startTime={booking.startTime}
            date={bookingDate}
            timezone={timezone}
          />
        </CardContent>
      </Card>
    ) : null;

  if (enableDesktopTabs) {
    return (
      <div className="space-y-4">
        {CriticalStrip}
        <GuestIdentityCard booking={booking} />

        <Tabs defaultValue="guest" className="w-full">
          <TabsList className="w-full justify-start gap-1">
            <TabsTrigger value="guest">Guest</TabsTrigger>
            <TabsTrigger value="booking">Booking</TabsTrigger>
            <TabsTrigger value="history">History</TabsTrigger>
          </TabsList>

          <TabsContent value="guest" className="mt-4">
            <div className="space-y-4">
              <GuestContactCard booking={booking} />
              <GuestNotesCard bookingNotes={null} profileNotes={booking.profileNotes ?? null} />
            </div>
          </TabsContent>

          <TabsContent value="booking" className="mt-4">
            <div className="space-y-4">
              <GuestMetaGrid
                partySize={booking.partySize}
                formattedStartTime={formattedStartTime}
                durationMinutes={durationMinutes}
                sourceLabel={sourceLabel}
                occasionLabel={occasionLabel}
              />
              {CountdownCard}
              <GuestSeatingCard
                assignedTableRows={assignedTableRows}
                totalCapacity={totalCapacity}
                capacityPercent={capacityPercent}
                partySize={booking.partySize}
                seatingPreference={booking.seatingPreference ?? null}
              />
              <GuestNotesCard bookingNotes={booking.notes ?? null} profileNotes={null} />
              <GuestDepositCard depositLabel={depositLabel} />
            </div>
          </TabsContent>

          <TabsContent value="history" className="mt-4">
            <div className="space-y-4">
              <GuestTimelineCard status={status} booking={booking} timezone={timezone} />
              <EmailDeliveryPanel bookingId={booking.id} timezone={timezone} />
              <SmsDeliveryPanel bookingId={booking.id} timezone={timezone} />
            </div>
          </TabsContent>
        </Tabs>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {CriticalStrip}
      <GuestIdentityCard booking={booking} />
      <GuestContactCard booking={booking} />
      <EmailDeliveryPanel bookingId={booking.id} timezone={timezone} />
      <SmsDeliveryPanel bookingId={booking.id} timezone={timezone} />
      <GuestMetaGrid
        partySize={booking.partySize}
        formattedStartTime={formattedStartTime}
        durationMinutes={durationMinutes}
        sourceLabel={sourceLabel}
        occasionLabel={occasionLabel}
      />
      {CountdownCard}
      <GuestSeatingCard
        assignedTableRows={assignedTableRows}
        totalCapacity={totalCapacity}
        capacityPercent={capacityPercent}
        partySize={booking.partySize}
        seatingPreference={booking.seatingPreference ?? null}
      />
      <GuestTimelineCard status={status} booking={booking} timezone={timezone} />
      <GuestNotesCard bookingNotes={booking.notes ?? null} profileNotes={booking.profileNotes ?? null} />
      <GuestDepositCard depositLabel={depositLabel} />
    </div>
  );
}

export default GuestProfilePanel;
