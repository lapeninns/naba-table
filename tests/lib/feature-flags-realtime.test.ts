import { afterEach, describe, expect, it } from 'vitest';

import { isRealtimeFloorplanEnabled } from '@/lib/feature-flags/realtime';

const originalEnv = process.env.NEXT_PUBLIC_FEATURE_REALTIME_FLOORPLAN;
const originalWindow = (globalThis as { window?: unknown }).window;

function setWindow(value: unknown) {
  (globalThis as { window?: unknown }).window = value;
}

function clearWindow() {
  if ('window' in globalThis) {
    delete (globalThis as { window?: unknown }).window;
  }
}

afterEach(() => {
  process.env.NEXT_PUBLIC_FEATURE_REALTIME_FLOORPLAN = originalEnv;
  if (originalWindow === undefined) {
    clearWindow();
  } else {
    setWindow(originalWindow);
  }
});

describe('isRealtimeFloorplanEnabled', () => {
  it('returns false when window is undefined', () => {
    clearWindow();
    process.env.NEXT_PUBLIC_FEATURE_REALTIME_FLOORPLAN = undefined;
    expect(isRealtimeFloorplanEnabled()).toBe(false);
  });

  it('defaults to true when flag is unset and window is defined', () => {
    setWindow({});
    process.env.NEXT_PUBLIC_FEATURE_REALTIME_FLOORPLAN = undefined;
    expect(isRealtimeFloorplanEnabled()).toBe(true);
  });

  it('returns false when flag is false', () => {
    setWindow({});
    process.env.NEXT_PUBLIC_FEATURE_REALTIME_FLOORPLAN = 'false';
    expect(isRealtimeFloorplanEnabled()).toBe(false);
  });

  it('returns true when flag is true', () => {
    setWindow({});
    process.env.NEXT_PUBLIC_FEATURE_REALTIME_FLOORPLAN = 'true';
    expect(isRealtimeFloorplanEnabled()).toBe(true);
  });
});
