import { afterEach, describe, expect, it, vi } from 'vitest';

import { triggerSubtleHaptic } from '@shared/lib/haptics';

type NavigatorWithVibrate = Navigator & { vibrate?: (pattern: number | number[]) => boolean };

const nav = navigator as NavigatorWithVibrate;
const originalVibrate = nav.vibrate;
const originalAnimate = document.body.animate;

afterEach(() => {
  if (originalVibrate) {
    nav.vibrate = originalVibrate;
  } else {
    delete nav.vibrate;
  }
  if (originalAnimate) {
    document.body.animate = originalAnimate;
  } else {
    delete (document.body as { animate?: unknown }).animate;
  }
  vi.restoreAllMocks();
});

describe('triggerSubtleHaptic', () => {
  it('vibrates with the default pattern when the API exists @contract', () => {
    const vibrate = vi.fn(() => true);
    nav.vibrate = vibrate;

    triggerSubtleHaptic();

    expect(vibrate).toHaveBeenCalledWith(8);
  });

  it('passes custom patterns through @contract', () => {
    const vibrate = vi.fn(() => true);
    nav.vibrate = vibrate;

    triggerSubtleHaptic([10, 20, 10]);

    expect(vibrate).toHaveBeenCalledWith([10, 20, 10]);
  });

  it('falls back to a CSS pulse when vibrate throws @contract', () => {
    nav.vibrate = vi.fn(() => {
      throw new Error('blocked');
    });
    const animate = vi.fn();
    document.body.animate = animate as unknown as typeof document.body.animate;

    expect(() => triggerSubtleHaptic()).not.toThrow();
    expect(animate).toHaveBeenCalledTimes(1);
  });

  it('uses the CSS pulse when vibrate is unavailable @contract', () => {
    delete nav.vibrate;
    const animate = vi.fn();
    document.body.animate = animate as unknown as typeof document.body.animate;

    triggerSubtleHaptic();

    expect(animate).toHaveBeenCalledTimes(1);
  });

  it('stays silent when neither API exists @contract', () => {
    delete nav.vibrate;
    delete (document.body as { animate?: unknown }).animate;

    expect(() => triggerSubtleHaptic()).not.toThrow();
  });
});
