'use client';

import { Pause, Play, RotateCcw } from 'lucide-react';
import { useCallback, useRef } from 'react';

import { Button } from '@/components/ui/button';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { cn } from '@/lib/utils';

import { formatClock } from './format';
import { FLOOR_FOCUS_RING } from './styles';

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
  const isLg = useMediaQuery('(min-width: 1024px)', true);
  const range = Math.max(1, windowEndMs - windowStartMs);
  const pct = Math.min(100, Math.max(0, ((effectiveMs - windowStartMs) / range) * 100));
  const nowPct = Math.min(100, Math.max(0, ((liveNowMs - windowStartMs) / range) * 100));

  // Accessibility values are service-window MINUTE OFFSETS, not the raw epoch-ms the slider
  // works in internally. A screen reader otherwise announces a 13-digit millisecond integer
  // (the audited defect); minutes-from-start (paired with the human aria-valuetext clock) is
  // what a host actually needs. All scrub math below still uses epoch ms.
  const windowMinutes = Math.max(1, Math.round(range / 60_000));
  const valueNowMinutes = Math.min(
    windowMinutes,
    Math.max(0, Math.round((effectiveMs - windowStartMs) / 60_000)),
  );

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
  const minorTicks: number[] = [];
  const halfHourMs = 30 * 60_000;
  for (
    let t = Math.ceil(windowStartMs / halfHourMs) * halfHourMs;
    t <= windowEndMs;
    t += halfHourMs
  ) {
    if (t % hourMs !== 0) minorTicks.push(((t - windowStartMs) / range) * 100);
  }
  // Many hour labels collide on a narrow phone track; show every other one below lg while
  // keeping every hour MARK. Desktop (default true) always shows all labels — no regression.
  const labelStride = isLg || ticks.length <= 6 ? 1 : 2;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <Button
          variant="outline"
          size="icon"
          type="button"
          onClick={onTogglePlay}
          aria-label={playing ? 'Pause replay' : 'Play service replay'}
          className={cn(
            'rounded-md',
            FLOOR_FOCUS_RING,
            playing && 'bg-primary text-primary-foreground hover:bg-primary/90',
          )}
        >
          {playing ? <Pause className="size-4" /> : <Play className="size-4" />}
        </Button>
        <div className="flex min-w-[72px] flex-col">
          <span className="text-xl font-semibold leading-none tabular-nums text-foreground sm:text-2xl">
            {formatClock(effectiveMs, timezone)}
          </span>
          <span
            className={cn(
              'text-[10px] uppercase tracking-wide',
              scrubbing ? 'text-primary' : 'text-muted-foreground',
            )}
          >
            {scrubbing ? 'Scrubbing' : 'Live now'}
          </span>
        </div>
        <div className="w-full sm:ml-auto sm:w-auto">
          {scrubbing ? (
            <Button
              variant="outline"
              size="sm"
              type="button"
              onClick={onBackToNow}
              className={cn('gap-1.5', FLOOR_FOCUS_RING)}
            >
              <RotateCcw className="size-3.5" /> Back to now
            </Button>
          ) : (
            <span className="text-[10px] uppercase tracking-wide tabular-nums text-muted-foreground">
              {seatedCovers} seated · {bookedCovers} booked
            </span>
          )}
        </div>
      </div>

      <div className="px-0.5 pb-5 pt-1">
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
            const STEP = 60_000;
            const PAGE = 15 * 60_000;
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
          className={cn(
            'relative h-11 cursor-pointer touch-none rounded-lg border border-border bg-muted/40',
            FLOOR_FOCUS_RING,
          )}
          role="slider"
          aria-label="Service time"
          aria-valuemin={0}
          aria-valuemax={windowMinutes}
          aria-valuenow={valueNowMinutes}
          aria-valuetext={formatClock(effectiveMs, timezone)}
          tabIndex={0}
        >
          <span
            aria-hidden
            className="absolute inset-y-0 left-0 rounded-l-lg bg-primary/10"
            style={{ width: `${pct}%` }}
          />
          {isLg
            ? minorTicks.map((p, i) => (
                <span
                  key={`m${i}`}
                  aria-hidden
                  className="absolute w-px bg-border/60"
                  style={{ left: `${p}%`, top: '34%', bottom: '34%' }}
                />
              ))
            : null}
          {ticks.map((tick, i) => {
            // Edge labels anchor to the track edge instead of centering off-track.
            const edge =
              tick.pct <= 4
                ? 'translate-x-0'
                : tick.pct >= 96
                  ? '-translate-x-full'
                  : '-translate-x-1/2';
            return (
              <span key={`h${tick.pct}`} aria-hidden>
                <span
                  className="absolute bottom-0 top-0 w-px bg-border"
                  style={{ left: `${tick.pct}%` }}
                />
                {i % labelStride === 0 ? (
                  <span
                    className={cn(
                      'absolute whitespace-nowrap text-[10px] tabular-nums text-muted-foreground',
                      edge,
                    )}
                    style={{ left: `${tick.pct}%`, bottom: -19 }}
                  >
                    {tick.label}
                  </span>
                ) : null}
              </span>
            );
          })}
          <span
            aria-hidden
            className="absolute w-0.5 bg-muted-foreground/50"
            style={{ left: `${nowPct}%`, top: -5, bottom: -5 }}
          />
          <span
            aria-hidden
            className="absolute -translate-x-1/2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground"
            style={{ left: `${nowPct}%`, top: -18 }}
          >
            Now
          </span>
          <span
            aria-hidden
            className="absolute w-0.5 bg-primary"
            style={{ left: `${pct}%`, top: -6, bottom: -6 }}
          />
          <span
            aria-hidden
            className="absolute top-1/2 size-[18px] -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-primary bg-card shadow-sm"
            style={{ left: `${pct}%` }}
          />
        </div>
      </div>
    </div>
  );
}
