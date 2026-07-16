'use client';

import { Ban, Calendar, CheckCircle2, LogIn, LogOut, UserX } from 'lucide-react';
import { DateTime } from 'luxon';
import { useMemo } from 'react';

import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

import type { OpsBookingStatus, OpsTodayBooking } from '@/types/ops';

export type GuestTimelineCardProps = {
  status: OpsBookingStatus;
  booking: OpsTodayBooking;
  timezone: string;
};

type Step = {
  key: string;
  label: string;
  done: boolean;
  icon: React.ComponentType<{ className?: string; 'aria-hidden'?: boolean }>;
  time?: string | null;
  tone?: 'neutral' | 'success' | 'danger';
};

function formatTime(iso: string | null, timezone: string) {
  if (!iso) return null;
  const dt = DateTime.fromISO(iso, { zone: timezone });
  return dt.isValid ? dt.toFormat('HH:mm') : null;
}

export function GuestTimelineCard({ status, booking, timezone }: GuestTimelineCardProps) {
  const steps = useMemo<Step[]>(() => {
    const base: Step[] = [
      { key: 'created', label: 'Booked', done: true, icon: Calendar, tone: 'neutral' },
      {
        key: 'confirmed',
        label: 'Confirmed',
        done: ['confirmed', 'checked_in', 'completed', 'cancelled', 'no_show'].includes(status),
        icon: CheckCircle2,
        tone: 'neutral',
      },
      {
        key: 'checked_in',
        label: 'Arrived',
        done: ['checked_in', 'completed'].includes(status),
        icon: LogIn,
        time: formatTime(booking.checkedInAt, timezone),
        tone: 'success',
      },
      {
        key: 'completed',
        label: 'Finished',
        done: status === 'completed',
        icon: LogOut,
        time: formatTime(booking.checkedOutAt, timezone),
        tone: 'success',
      },
    ];

    if (status === 'cancelled') {
      base.push({ key: 'cancelled', label: 'Cancelled', done: true, icon: Ban, tone: 'danger' });
    }
    if (status === 'no_show') {
      base.push({ key: 'no_show', label: 'No-show', done: true, icon: UserX, tone: 'danger' });
    }

    return base;
  }, [booking.checkedInAt, booking.checkedOutAt, status, timezone]);

  return (
    <Card className="border-border/50 bg-background shadow-sm ring-1 ring-border/5">
      <CardContent className="p-3">
        <div className="flex flex-col gap-1">
          {steps.map((step, index) => {
            const Icon = step.icon;
            const isLast = index === steps.length - 1;
            const isDone = step.done;

            const dotTone =
              step.tone === 'danger'
                ? isDone
                  ? 'bg-destructive/10 text-destructive border-destructive/20'
                  : 'bg-muted text-muted-foreground/40 border-border/50'
                : isDone
                  ? 'bg-primary/10 text-primary border-primary/20'
                  : 'bg-muted text-muted-foreground/40 border-border/50';

            const lineTone =
              step.tone === 'danger'
                ? isDone
                  ? 'bg-destructive/20'
                  : 'bg-border/40'
                : isDone
                  ? 'bg-primary/20'
                  : 'bg-border/40';

            return (
              <div key={step.key} className="flex items-start gap-3">
                <div className="flex flex-col items-center">
                  <div
                    className={cn(
                      'flex h-6 w-6 items-center justify-center rounded-full border shadow-sm',
                      dotTone,
                    )}
                  >
                    <Icon className="size-3" aria-hidden />
                  </div>
                  {!isLast ? <div className={cn('h-3 w-px', lineTone)} aria-hidden /> : null}
                </div>
                <div className="min-w-0 flex-1 py-0.5">
                  <div className="flex items-center justify-between gap-2">
                    <span
                      className={cn(
                        'text-[11px] font-bold tracking-tight',
                        isDone ? 'text-foreground' : 'text-muted-foreground/60',
                      )}
                    >
                      {step.label}
                    </span>
                    {step.time ? (
                      <span className="text-[10px] font-bold text-muted-foreground/50">
                        {step.time}
                      </span>
                    ) : null}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

export default GuestTimelineCard;
