'use client';

import { Clock } from 'lucide-react';
import { useEffect, useState } from 'react';

import { cn } from '@/lib/utils';

type HoldExpirationTimerProps = {
  expiresAt: string | Date;
  onExpired?: () => void;
  className?: string;
};

export function HoldExpirationTimer({ expiresAt, onExpired, className }: HoldExpirationTimerProps) {
  const [timeLeft, setTimeLeft] = useState<number>(0);

  useEffect(() => {
    const updateTimer = () => {
      const now = Date.now();
      const expiry = typeof expiresAt === 'string' ? new Date(expiresAt).getTime() : expiresAt.getTime();
      const remaining = Math.max(0, expiry - now);

      setTimeLeft(remaining);

      if (remaining === 0 && onExpired) {
        onExpired();
      }
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);

    return () => clearInterval(interval);
  }, [expiresAt, onExpired]);

  const totalSeconds = Math.floor(timeLeft / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  const isExpired = timeLeft === 0;
  const isLowTime = totalSeconds < 60 && !isExpired;

  return (
    <div
      className={cn(
        'flex items-center gap-2 rounded-lg border px-3 py-1.5',
        isExpired
          ? 'border-destructive/20 bg-destructive/5'
          : isLowTime
            ? 'border-amber-200 bg-amber-50'
            : 'border-border bg-muted/30',
        className
      )}
      role="timer"
      aria-live="polite"
      aria-label={`Hold expires in ${minutes} minutes and ${seconds} seconds`}
    >
      <Clock
        className={cn(
          'h-4 w-4',
          isExpired ? 'text-destructive' : isLowTime ? 'text-amber-600' : 'text-muted-foreground'
        )}
      />
      <div className="flex flex-col">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          Hold Expires
        </span>
        <span
          className={cn(
            'text-sm font-mono font-bold tabular-nums',
            isExpired ? 'text-destructive' : isLowTime ? 'text-amber-600' : 'text-foreground'
          )}
        >
          {isExpired ? 'Expired' : `${minutes}:${seconds.toString().padStart(2, '0')}`}
        </span>
      </div>
    </div>
  );
}
