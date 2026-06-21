'use client';

import { Pause, Play, RotateCcw } from 'lucide-react';
import { useCallback, useRef } from 'react';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

import { formatClock } from './format';

export type TimeScrubberProps = {
  windowStartMs: number;
  windowEndMs: number;
  effectiveMs: number;
  liveNowMs: number;
  scrubbing: boolean;
  playing: boolean;
  timezone: string;
  seatedCovers: number;
  bookedCovers: number;
  onScrub: (ms: number) => void;
  onTogglePlay: () => void;
  onBackToNow: () => void;
};

/** Replay service: scrub/play through the night; the room re-colours from the head. */
export function TimeScrubber({
  windowStartMs,
  windowEndMs,
  effectiveMs,
  liveNowMs,
  scrubbing,
  playing,
  timezone,
  seatedCovers,
  bookedCovers,
  onScrub,
  onTogglePlay,
  onBackToNow,
}: TimeScrubberProps) {
  const trackRef = useRef<HTMLDivElement | null>(null);
  const draggingRef = useRef(false);
  const range = Math.max(1, windowEndMs - windowStartMs);
  const pct = Math.min(100, Math.max(0, ((effectiveMs - windowStartMs) / range) * 100));
  const nowPct = Math.min(100, Math.max(0, ((liveNowMs - windowStartMs) / range) * 100));

  const scrubToClientX = useCallback(
    (clientX: number) => {
      const rect = trackRef.current?.getBoundingClientRect();
      if (!rect || rect.width === 0) return;
      const fraction = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
      const ms = windowStartMs + fraction * range;
      onScrub(Math.round(ms / 60_000) * 60_000);
    },
    [onScrub, range, windowStartMs],
  );

  const stepScrub = useCallback(
    (deltaMs: number) => {
      const next = Math.min(windowEndMs, Math.max(windowStartMs, effectiveMs + deltaMs));
      onScrub(Math.round(next / 60_000) * 60_000);
    },
    [effectiveMs, onScrub, windowEndMs, windowStartMs],
  );

  const ticks: { pct: number; label: string }[] = [];
  const hourMs = 60 * 60_000;
  for (let t = Math.ceil(windowStartMs / hourMs) * hourMs; t <= windowEndMs; t += hourMs) {
    ticks.push({ pct: ((t - windowStartMs) / range) * 100, label: formatClock(t, timezone) });
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          type="button"
          onClick={onTogglePlay}
          aria-label={playing ? 'Pause replay' : 'Play service replay'}
          className={cn(
            'flex h-11 w-11 flex-none items-center justify-center rounded-full border-2 border-primary p-0 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2',
            playing ? 'bg-primary text-primary-foreground' : 'bg-card text-primary',
          )}
        >
          {playing ? <Pause className="size-4" /> : <Play className="size-4" />}
        </Button>
        <div className="flex min-w-[72px] flex-col">
          <span className="font-mono text-2xl font-semibold leading-none tabular-nums text-foreground">
            {formatClock(effectiveMs, timezone)}
          </span>
          <span
            className={cn(
              'font-mono text-[10px] uppercase tracking-[0.1em]',
              scrubbing ? 'text-primary' : 'text-success',
            )}
          >
            {scrubbing ? 'Scrubbing' : 'Live now'}
          </span>
        </div>
        <div className="ml-auto">
          {scrubbing ? (
            <Button
              variant="ghost"
              type="button"
              onClick={onBackToNow}
              className="inline-flex h-auto items-center gap-1.5 rounded-full border border-primary bg-primary/5 px-3 py-1.5 font-mono text-[10px] font-semibold uppercase tracking-[0.08em] text-primary"
            >
              <RotateCcw className="size-3" /> Back to now
            </Button>
          ) : (
            <span className="font-mono text-[10px] uppercase tracking-[0.06em] text-muted-foreground">
              {seatedCovers} seated · {bookedCovers} booked
            </span>
          )}
        </div>
      </div>

      <div className="px-0.5 pt-1">
        <div
          ref={trackRef}
          onPointerDown={(event) => {
            event.preventDefault();
            draggingRef.current = true;
            try {
              event.currentTarget.setPointerCapture(event.pointerId);
            } catch {
              /* ignore */
            }
            scrubToClientX(event.clientX);
          }}
          onPointerMove={(event) => {
            if (draggingRef.current) scrubToClientX(event.clientX);
          }}
          onPointerUp={(event) => {
            draggingRef.current = false;
            try {
              event.currentTarget.releasePointerCapture(event.pointerId);
            } catch {
              /* ignore */
            }
          }}
          onKeyDown={(event) => {
            const STEP = 60_000; // 1 min
            const PAGE = 15 * 60_000; // 15 min
            switch (event.key) {
              case 'ArrowLeft':
              case 'ArrowDown':
                stepScrub(-STEP);
                break;
              case 'ArrowRight':
              case 'ArrowUp':
                stepScrub(STEP);
                break;
              case 'PageDown':
                stepScrub(-PAGE);
                break;
              case 'PageUp':
                stepScrub(PAGE);
                break;
              case 'Home':
                onScrub(windowStartMs);
                break;
              case 'End':
                onScrub(windowEndMs);
                break;
              default:
                return;
            }
            event.preventDefault();
          }}
          className="relative h-10 cursor-pointer touch-none rounded-lg border border-border bg-muted/50"
          role="slider"
          aria-label="Service time"
          aria-valuemin={windowStartMs}
          aria-valuemax={windowEndMs}
          aria-valuenow={effectiveMs}
          aria-valuetext={formatClock(effectiveMs, timezone)}
          tabIndex={0}
        >
          {ticks.map((tick) => (
            <span
              key={tick.label}
              aria-hidden
              className="absolute bottom-1 top-1 w-px bg-border"
              style={{ left: `${tick.pct}%` }}
            />
          ))}
          <span
            aria-hidden
            className="absolute inset-y-0 left-0 rounded-l-lg bg-primary/10"
            style={{ width: `${pct}%` }}
          />
          <span
            aria-hidden
            className="absolute -top-1 bottom-[-0.25rem] w-px bg-muted-foreground/50"
            style={{ left: `${nowPct}%` }}
          />
          <span
            aria-hidden
            className="absolute top-1/2 size-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-[3px] border-primary bg-card shadow-sm"
            style={{ left: `${pct}%` }}
          />
        </div>
      </div>
    </div>
  );
}
