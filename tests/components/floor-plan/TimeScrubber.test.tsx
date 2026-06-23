import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { TimeScrubber } from '@/components/features/floor-plan/TimeScrubber';

vi.mock('@/hooks/useMediaQuery', () => ({ useMediaQuery: () => true }));

// 7-hour service window 16:00–23:00 UTC (17:00–24:00 BST); head at 19:30 UTC = 20:30 BST.
const windowStartMs = Date.parse('2026-06-23T16:00:00.000Z');
const windowEndMs = Date.parse('2026-06-23T23:00:00.000Z');
const effectiveMs = Date.parse('2026-06-23T19:30:00.000Z');

function setup(overrides: Record<string, unknown> = {}) {
  const onScrub = vi.fn();
  const onTogglePlay = vi.fn();
  const onBackToNow = vi.fn();
  render(
    <TimeScrubber
      windowStartMs={windowStartMs}
      windowEndMs={windowEndMs}
      effectiveMs={effectiveMs}
      liveNowMs={effectiveMs}
      scrubbing={false}
      playing={false}
      timezone="Europe/London"
      seatedCovers={28}
      bookedCovers={10}
      onScrub={onScrub}
      onTogglePlay={onTogglePlay}
      onBackToNow={onBackToNow}
      {...overrides}
    />,
  );
  return { onScrub, onTogglePlay, onBackToNow };
}

describe('TimeScrubber accessibility', () => {
  it('exposes the service time as a human-readable aria-valuetext, not a raw epoch', () => {
    setup();
    const slider = screen.getByRole('slider', { name: 'Service time' });
    expect(slider).toHaveAttribute('aria-valuetext', '20:30');
  });

  it('exposes aria bounds as service-window minute offsets with no 13-digit epoch anywhere', () => {
    setup();
    const slider = screen.getByRole('slider', { name: 'Service time' });
    expect(slider).toHaveAttribute('aria-valuemin', '0');
    expect(slider).toHaveAttribute('aria-valuemax', '420');
    expect(slider).toHaveAttribute('aria-valuenow', '210');
    for (const attr of [
      'aria-valuemin',
      'aria-valuemax',
      'aria-valuenow',
      'aria-valuetext',
      'aria-label',
    ]) {
      expect(slider.getAttribute(attr) ?? '').not.toMatch(/\d{13}/);
    }
  });

  it('steps by one minute on ArrowRight/ArrowLeft with minute-rounded callbacks', () => {
    const { onScrub } = setup();
    const slider = screen.getByRole('slider', { name: 'Service time' });
    fireEvent.keyDown(slider, { key: 'ArrowRight' });
    expect(onScrub).toHaveBeenCalledWith(effectiveMs + 60_000);
    fireEvent.keyDown(slider, { key: 'ArrowLeft' });
    expect(onScrub).toHaveBeenCalledWith(effectiveMs - 60_000);
  });

  it('jumps to the window start/end on Home/End', () => {
    const { onScrub } = setup();
    const slider = screen.getByRole('slider', { name: 'Service time' });
    fireEvent.keyDown(slider, { key: 'Home' });
    expect(onScrub).toHaveBeenCalledWith(windowStartMs);
    fireEvent.keyDown(slider, { key: 'End' });
    expect(onScrub).toHaveBeenCalledWith(windowEndMs);
  });

  it('rounds pointer scrubs to the minute', () => {
    const { onScrub } = setup();
    const slider = screen.getByRole('slider', { name: 'Service time' });
    slider.getBoundingClientRect = () =>
      ({
        left: 0,
        top: 0,
        width: 700,
        height: 44,
        right: 700,
        bottom: 44,
        x: 0,
        y: 0,
        toJSON() {},
      }) as DOMRect;
    // Halfway across the 7h window → 19:30 UTC, already minute-aligned.
    fireEvent.pointerDown(slider, { clientX: 350, pointerId: 1 });
    expect(onScrub).toHaveBeenCalledWith(effectiveMs);
    const calledWith = onScrub.mock.calls[0][0] as number;
    expect(calledWith % 60_000).toBe(0);
  });
});
