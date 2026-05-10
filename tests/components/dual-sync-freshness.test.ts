import { describe, expect, it } from 'vitest';

import {
  classifyAge,
  formatAge,
  freshnessAge,
} from '@/components/features/restaurant-settings/dual-sync/freshness';

const NOW = new Date('2026-04-29T12:00:00.000Z');

describe('classifyAge', () => {
  it('returns "fresh" for ages under one hour', () => {
    expect(classifyAge(0)).toBe('fresh');
    expect(classifyAge(30 * 60 * 1000)).toBe('fresh');
    expect(classifyAge(59 * 60 * 1000)).toBe('fresh');
  });

  it('returns "recent" for ages between one hour and one day', () => {
    expect(classifyAge(60 * 60 * 1000)).toBe('recent');
    expect(classifyAge(12 * 60 * 60 * 1000)).toBe('recent');
    expect(classifyAge(23 * 60 * 60 * 1000)).toBe('recent');
  });

  it('returns "stale" for ages of one day or more', () => {
    expect(classifyAge(24 * 60 * 60 * 1000)).toBe('stale');
    expect(classifyAge(7 * 24 * 60 * 60 * 1000)).toBe('stale');
  });

  it('returns "never" for invalid ages', () => {
    expect(classifyAge(NaN)).toBe('never');
    expect(classifyAge(-1)).toBe('never');
  });
});

describe('formatAge', () => {
  it('formats sub-minute ages in seconds', () => {
    expect(formatAge(0)).toBe('1s');
    expect(formatAge(45_000)).toBe('45s');
  });

  it('formats sub-hour ages in minutes', () => {
    expect(formatAge(60_000)).toBe('1m');
    expect(formatAge(15 * 60_000)).toBe('15m');
  });

  it('formats sub-day ages in hours', () => {
    expect(formatAge(60 * 60_000)).toBe('1h');
    expect(formatAge(5 * 60 * 60_000)).toBe('5h');
  });

  it('formats day-plus ages in days', () => {
    expect(formatAge(24 * 60 * 60_000)).toBe('1d');
    expect(formatAge(7 * 24 * 60 * 60_000)).toBe('7d');
  });
});

describe('freshnessAge', () => {
  it('returns the never tone when timestamp is null/undefined/invalid', () => {
    expect(freshnessAge(null, NOW)).toEqual({ tone: 'never', label: '—' });
    expect(freshnessAge(undefined, NOW)).toEqual({ tone: 'never', label: '—' });
    expect(freshnessAge('not-a-date', NOW)).toEqual({ tone: 'never', label: '—' });
  });

  it('returns the fresh tone for recent timestamps', () => {
    const fresh = new Date(NOW.getTime() - 5 * 60_000).toISOString();
    const out = freshnessAge(fresh, NOW);
    expect(out.tone).toBe('fresh');
    expect(out.label).toBe('5m');
  });

  it('returns the recent tone for hour-old timestamps', () => {
    const recent = new Date(NOW.getTime() - 6 * 60 * 60_000).toISOString();
    const out = freshnessAge(recent, NOW);
    expect(out.tone).toBe('recent');
    expect(out.label).toBe('6h');
  });

  it('returns the stale tone for day-old+ timestamps', () => {
    const stale = new Date(NOW.getTime() - 3 * 24 * 60 * 60_000).toISOString();
    const out = freshnessAge(stale, NOW);
    expect(out.tone).toBe('stale');
    expect(out.label).toBe('3d');
  });

  it('clamps future timestamps to fresh / 1s', () => {
    const future = new Date(NOW.getTime() + 60_000).toISOString();
    const out = freshnessAge(future, NOW);
    expect(out.tone).toBe('fresh');
    expect(out.label).toBe('1s');
  });
});
