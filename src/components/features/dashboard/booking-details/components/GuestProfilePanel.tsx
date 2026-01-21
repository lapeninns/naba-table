'use client';

import {
  Calendar,
  CheckCircle2,
  Clock,
  CreditCard,
  LogIn,
  LogOut,
  Mail,
  MessageCircle,
  Phone,
  Star,
  Users,
} from 'lucide-react';
import { DateTime } from 'luxon';

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';

import { ArrivalCountdown } from './ArrivalCountdown';
import { ClickToCopy } from './ClickToCopy';
import { ContactInfoRow } from './ContactInfoRow';
import {
  formatBookingTime,
  formatPhoneForTel,
  getGuestInitials,
  parseBookingDateTime,
} from '../utils';

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
  const formattedStartTime = formatBookingTime(booking.startTime, bookingDate, timezone);

  const startDateTime = bookingDate
    ? parseBookingDateTime({ time: booking.startTime, date: bookingDate, timezone })
    : null;
  const endDateTime = bookingDate
    ? parseBookingDateTime({ time: booking.endTime, date: bookingDate, timezone })
    : null;
  const durationMinutes =
    startDateTime && endDateTime
      ? Math.max(0, Math.round(endDateTime.diff(startDateTime, 'minutes').minutes ?? 0))
      : null;

  const sourceLabel = booking.source ? booking.source : 'Direct';
  const occasionLabel =
    booking.details && typeof booking.details['occasion'] === 'string'
      ? String(booking.details['occasion'])
      : 'Standard';
  const depositValue =
    booking.details?.['deposit'] ??
    booking.details?.['depositAmount'] ??
    booking.details?.['prepay'] ??
    booking.details?.['prepayAmount'] ??
    booking.details?.['prepaidAmount'];
  const depositLabel =
    typeof depositValue === 'number' || typeof depositValue === 'string'
      ? `£${depositValue}`
      : 'None';

  const statusTimeline = [
    {
      status: 'created',
      label: 'Booked',
      done: true,
      icon: Calendar,
    },
    {
      status: 'confirmed',
      label: 'Confirmed',
      done: ['confirmed', 'checked_in', 'completed'].includes(status),
      icon: CheckCircle2,
    },
    {
      status: 'checked_in',
      label: 'Checked In',
      done: ['checked_in', 'completed'].includes(status),
      time: booking.checkedInAt
        ? DateTime.fromISO(booking.checkedInAt, { zone: timezone }).toFormat('HH:mm')
        : null,
      icon: LogIn,
    },
    {
      status: 'completed',
      label: 'Completed',
      done: status === 'completed',
      time: booking.checkedOutAt
        ? DateTime.fromISO(booking.checkedOutAt, { zone: timezone }).toFormat('HH:mm')
        : null,
      icon: LogOut,
    },
  ];

  const hasSeatingPreference = Boolean(booking.seatingPreference);

  const getLoyaltyGradient = (tier: string | null) => {
    switch (tier) {
      case 'platinum':
        return 'from-purple-500 to-violet-600';
      case 'gold':
        return 'from-amber-500 to-orange-500';
      case 'silver':
        return 'from-slate-400 to-slate-500';
      case 'bronze':
        return 'from-orange-400 to-amber-600';
      default:
        return 'from-slate-300 to-slate-400';
    }
  };

  const tags: Array<{ label: string; className: string }> = [];
  const isVip = booking.loyaltyTier === 'gold' || booking.loyaltyTier === 'platinum';
  if (isVip) {
    tags.push({ label: 'VIP', className: 'bg-amber-50 text-amber-700 border-amber-200' });
  }
  (booking.allergies ?? []).forEach((allergy) => {
    tags.push({
      label: `Allergy: ${allergy}`,
      className: 'bg-rose-50 text-rose-700 border-rose-200',
    });
  });
  (booking.dietaryRestrictions ?? []).forEach((restriction) => {
    tags.push({
      label: `Diet: ${restriction}`,
      className: 'bg-indigo-50 text-indigo-700 border-indigo-200',
    });
  });

  const whatsappDigits = booking.customerPhone ? booking.customerPhone.replace(/[^0-9]/g, '') : '';
  const whatsappHref = whatsappDigits ? `https://wa.me/${whatsappDigits}` : null;

  return (
    <div className="space-y-4">
      <Card className="overflow-hidden border-slate-200/60 shadow-lg shadow-slate-100/50 bg-gradient-to-br from-white via-slate-50/30 to-slate-100/20">
        <CardContent className="p-4">
          <div className="flex items-start gap-3 mb-3">
            <div
              className={cn(
                'h-12 w-12 rounded-full flex items-center justify-center text-white font-bold text-lg shadow-md',
                booking.loyaltyTier
                  ? `bg-gradient-to-br ${getLoyaltyGradient(booking.loyaltyTier)}`
                  : 'bg-gradient-to-br from-indigo-500 to-purple-600',
              )}
            >
              {getGuestInitials(booking.customerName)}
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-base font-semibold text-slate-900 tracking-tight">
                  {booking.customerName}
                </h3>
                {booking.loyaltyTier && (
                  <Badge
                    className={cn(
                      'text-[10px] font-semibold tracking-wide uppercase shadow-sm',
                      booking.loyaltyTier === 'platinum' &&
                        'bg-gradient-to-r from-purple-500 to-violet-600 border-purple-400',
                      booking.loyaltyTier === 'gold' &&
                        'bg-gradient-to-r from-amber-500 to-orange-500 border-amber-400',
                      booking.loyaltyTier === 'silver' &&
                        'bg-gradient-to-r from-slate-400 to-slate-500 border-slate-300',
                      booking.loyaltyTier === 'bronze' &&
                        'bg-gradient-to-r from-orange-400 to-amber-600 border-orange-400',
                    )}
                  >
                    {booking.loyaltyTier}
                  </Badge>
                )}
              </div>
              <div className="text-xs text-slate-500 mt-0.5 flex items-center gap-1.5">
                {booking.loyaltyPoints ? (
                  <>
                    <Star className="h-3 w-3 text-amber-500 fill-amber-500" />
                    <span className="font-medium">{booking.loyaltyPoints} points</span>
                  </>
                ) : (
                  <span>New guest</span>
                )}
              </div>
              {tags.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-2">
                  {tags.map((tag) => (
                    <Badge
                      key={tag.label}
                      variant="outline"
                      className={cn('text-[10px]', tag.className)}
                    >
                      {tag.label}
                    </Badge>
                  ))}
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="border-slate-200/60 bg-white">
        <CardContent className="p-3 space-y-2">
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Contact
          </div>
          {booking.customerPhone ? (
            <ContactInfoRow
              icon={Phone}
              label="Phone"
              value={booking.customerPhone}
              href={`tel:${formatPhoneForTel(booking.customerPhone)}`}
              actions={
                whatsappHref
                  ? [
                      {
                        label: 'WhatsApp',
                        href: whatsappHref,
                        icon: MessageCircle,
                      },
                    ]
                  : undefined
              }
            />
          ) : (
            <Alert variant="default" className="border-stone-200/70 bg-white/70 text-stone-600">
              <Phone className="h-4 w-4" />
              <AlertTitle>No phone provided</AlertTitle>
              <AlertDescription>Phone number not available for this booking.</AlertDescription>
            </Alert>
          )}
          {booking.customerEmail ? (
            <ContactInfoRow
              icon={Mail}
              label="Email"
              value={booking.customerEmail}
              href={`mailto:${booking.customerEmail}`}
            />
          ) : null}
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 gap-3">
        <Card className="group hover:shadow-md transition-all duration-200 border-slate-200/60 bg-gradient-to-br from-white to-indigo-50/30">
          <CardContent className="p-3">
            <div className="flex flex-col gap-2">
              <div className="h-8 w-8 rounded-lg bg-indigo-100 text-indigo-600 flex items-center justify-center shadow-sm group-hover:scale-110 transition-transform">
                <Users className="h-4 w-4" />
              </div>
              <div>
                <div className="text-xl font-bold text-slate-900 tracking-tight">
                  {booking.partySize}
                </div>
                <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                  Covers
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="group hover:shadow-md transition-all duration-200 border-slate-200/60 bg-gradient-to-br from-white to-amber-50/30">
          <CardContent className="p-3">
            <div className="flex flex-col gap-2">
              <div className="h-8 w-8 rounded-lg bg-amber-100 text-amber-600 flex items-center justify-center shadow-sm group-hover:scale-110 transition-transform">
                <Clock className="h-4 w-4" />
              </div>
              <div>
                <div className="text-sm font-bold text-slate-900 leading-tight">
                  {formattedStartTime}
                </div>
                <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                  {durationMinutes ? `${durationMinutes}m` : 'TBC'}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="group hover:shadow-md transition-all duration-200 border-slate-200/60 bg-white">
          <CardContent className="p-3">
            <div className="flex items-center gap-2.5">
              <div className="h-7 w-7 rounded-md bg-slate-100 text-slate-500 flex items-center justify-center shrink-0">
                <Star className="h-3.5 w-3.5" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 leading-none mb-0.5">
                  Source
                </div>
                <div className="text-xs font-semibold text-slate-900 break-words" title={sourceLabel}>
                  {sourceLabel}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="group hover:shadow-md transition-all duration-200 border-slate-200/60 bg-white">
          <CardContent className="p-3">
            <div className="flex items-center gap-2.5">
              <div className="h-7 w-7 rounded-md bg-slate-100 text-slate-500 flex items-center justify-center shrink-0">
                <Calendar className="h-3.5 w-3.5" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 leading-none mb-0.5">
                  Occasion
                </div>
                <div className="text-xs font-semibold text-slate-900 break-words" title={occasionLabel}>
                  {occasionLabel}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {minutesRemaining !== null && minutesRemaining > -120 && (
        <Card
          className={cn(
            'border-2 overflow-hidden',
            minutesRemaining > 0 && minutesRemaining <= 30
              ? 'border-emerald-300 bg-gradient-to-r from-emerald-50 to-teal-50'
              : minutesRemaining > 30
                ? 'border-amber-300 bg-gradient-to-r from-amber-50 to-orange-50'
                : 'border-slate-300 bg-gradient-to-r from-slate-50 to-slate-100',
          )}
        >
          <CardContent className="p-3">
            <ArrivalCountdown
              status={status}
              startTime={booking.startTime}
              date={bookingDate}
              timezone={timezone}
            />
          </CardContent>
        </Card>
      )}

      {assignedTableRows.length > 0 ? (
        <Card className="border-slate-200/60 shadow-sm">
          <CardContent className="p-3 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Assigned Tables
              </span>
              <div className="flex gap-1">
                {assignedTableRows.map((member) => (
                  <Badge key={member.id} variant="secondary" className="text-xs font-semibold">
                    {member.tableNumber}
                  </Badge>
                ))}
              </div>
            </div>
            <Progress value={capacityPercent} className="h-2 bg-slate-100" />
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-600">Capacity</span>
              <span
                className={cn(
                  'font-bold',
                  capacityPercent >= 100
                    ? 'text-emerald-600'
                    : capacityPercent >= 80
                      ? 'text-amber-600'
                      : 'text-slate-600',
                )}
              >
                {totalCapacity} / {booking.partySize} seats
              </span>
            </div>
            {hasSeatingPreference && (
              <Badge
                variant="outline"
                className="mt-1 text-xs border-indigo-200 bg-indigo-50 text-indigo-700"
              >
                {booking.seatingPreference}
              </Badge>
            )}
          </CardContent>
        </Card>
      ) : (
        <Alert className="border-amber-200 bg-amber-50">
          <AlertTitle className="text-amber-900">No table assigned</AlertTitle>
          <AlertDescription className="text-amber-700">
            Assign a table to complete the seating plan.
          </AlertDescription>
        </Alert>
      )}

      <Card className="border-slate-200/60 shadow-sm">
        <CardContent className="p-3">
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-3">
            Journey Timeline
          </div>
          <div className="space-y-3">
            {statusTimeline.map((step, index) => {
              const StepIcon = step.icon;
              return (
                <div key={step.status} className="flex items-center gap-3">
                  <div className="flex flex-col items-center">
                    <div
                      className={cn(
                        'h-8 w-8 rounded-full flex items-center justify-center transition-all duration-300',
                        step.done
                          ? 'bg-gradient-to-br from-emerald-400 to-teal-500 text-white shadow-md shadow-emerald-200/50'
                          : 'bg-slate-100 text-slate-400',
                      )}
                    >
                      <StepIcon className="h-4 w-4" />
                    </div>
                    {index < statusTimeline.length - 1 && (
                      <div
                        className={cn(
                          'w-0.5 h-6 transition-all duration-300',
                          step.done
                            ? 'bg-gradient-to-b from-emerald-400 to-emerald-200'
                            : 'bg-slate-200',
                        )}
                      />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div
                      className={cn(
                        'text-sm font-medium transition-colors',
                        step.done ? 'text-slate-900' : 'text-slate-400',
                      )}
                    >
                      {step.label}
                    </div>
                    {step.time && (
                      <div className="text-xs text-emerald-600 font-medium">{step.time}</div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {(booking.notes || booking.profileNotes) && (
        <Card className="border-slate-200/60 bg-gradient-to-br from-white to-slate-50/30">
          <CardContent className="p-3">
            <Accordion type="single" collapsible defaultValue={booking.notes ? 'notes' : undefined}>
              <AccordionItem value="notes" className="border-none">
                <AccordionTrigger className="text-xs font-semibold uppercase tracking-wide text-slate-500 hover:no-underline py-2">
                  Notes & Requests
                </AccordionTrigger>
                <AccordionContent>
                  {booking.notes ? (
                    <div className="space-y-2">
                      <div className="text-sm text-slate-700 bg-white rounded-lg p-3 border border-slate-200 italic">
                        &ldquo;{booking.notes}&rdquo;
                      </div>
                      <ClickToCopy text={booking.notes} label="Copy notes" compact />
                    </div>
                  ) : (
                    <p className="text-sm text-slate-400">No notes recorded.</p>
                  )}
                </AccordionContent>
              </AccordionItem>
              {booking.profileNotes && (
                <AccordionItem value="profile" className="border-none">
                  <AccordionTrigger className="text-xs font-semibold uppercase tracking-wide text-slate-500 hover:no-underline py-2">
                    Guest Profile Notes
                  </AccordionTrigger>
                  <AccordionContent>
                    <div className="text-sm text-slate-700 bg-white rounded-lg p-3 border border-slate-200">
                      {booking.profileNotes}
                    </div>
                  </AccordionContent>
                </AccordionItem>
              )}
            </Accordion>
          </CardContent>
        </Card>
      )}

      {depositLabel !== 'None' && (
        <Card className="border-emerald-200/60 bg-gradient-to-r from-emerald-50 to-teal-50">
          <CardContent className="p-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-sm">
                  <CreditCard className="h-4 w-4 text-white" />
                </div>
                <div>
                  <div className="text-xs font-semibold uppercase tracking-wide text-emerald-600">
                    Deposit
                  </div>
                  <div className="text-lg font-bold text-emerald-900">{depositLabel}</div>
                </div>
              </div>
              <Badge className="bg-emerald-600 text-white shadow-sm">
                <CheckCircle2 className="h-3 w-3 mr-1" />
                Paid
              </Badge>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
