'use client';

import { Ban, Calendar, CheckCircle2, LogIn, LogOut, UserX } from 'lucide-react';
import { DateTime } from 'luxon';
import { useMemo } from 'react';

import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

import type { OpsBookingStatus, OpsTodayBooking } from '@/types/ops';
import type { CSSProperties } from 'react';

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
  const heavyPanelStyle = {
    contentVisibility: 'auto',
    containIntrinsicSize: '1px 400px',
  } as CSSProperties;

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
        label: 'Checked in',
        done: ['checked_in', 'completed'].includes(status),
        icon: LogIn,
        time: formatTime(booking.checkedInAt, timezone),
        tone: 'success',
      },
      {
        key: 'completed',
        label: 'Completed',
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

  const srSummary = useMemo(() => {
    const time = status === 'checked_in' ? formatTime(booking.checkedInAt, timezone) : null;
    const time2 = status === 'completed' ? formatTime(booking.checkedOutAt, timezone) : null;
    const suffix = time ? ` at ${time}` : time2 ? ` at ${time2}` : '';
    return `Current status: ${status.replace(/_/g, ' ')}${suffix}.`;
  }, [booking.checkedInAt, booking.checkedOutAt, status, timezone]);

  return (
    <div style={heavyPanelStyle}>
      <Card className="border-border bg-background shadow-sm">
        <CardContent className="space-y-3 p-4">
          <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            History
          </div>

          <div className="sr-only">{srSummary}</div>

          <div className="space-y-3">
            {steps.map((step, index) => {
              const Icon = step.icon;
              const isLast = index === steps.length - 1;
              const isDone = step.done;

              const dotTone =
                step.tone === 'danger'
                  ? isDone
                    ? 'bg-destructive/10 text-destructive'
                    : 'bg-muted text-muted-foreground'
                  : isDone
                    ? 'bg-primary/10 text-primary'
                    : 'bg-muted text-muted-foreground';

              const lineTone =
                step.tone === 'danger'
                  ? isDone
                    ? 'bg-destructive/10'
                    : 'bg-border'
                  : isDone
                    ? 'bg-primary/10'
                    : 'bg-border';

              return (
                <div key={step.key} className="flex items-start gap-3">
                  <div className="flex flex-col items-center">
                    <div
                      className={cn(
                        'flex h-8 w-8 items-center justify-center rounded-full',
                        dotTone,
                      )}
                    >
                      <Icon className="h-4 w-4" aria-hidden />
                    </div>
                    {!isLast ? <div className={cn('h-6 w-0.5', lineTone)} aria-hidden /> : null}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div
                      className={cn(
                        'text-sm font-medium',
                        isDone ? 'text-foreground' : 'text-muted-foreground',
                      )}
                    >
                      {step.label}
                    </div>
                    {step.time ? (
                      <div className="mt-0.5 text-xs text-muted-foreground">{step.time}</div>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default GuestTimelineCard;
