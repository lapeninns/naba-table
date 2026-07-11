import { describe, expect, it } from 'vitest';

import {
  toneClasses,
  type StatusTone,
} from '@/components/features/booking/ui/bookingUiTone';

const ALL_TONES: StatusTone[] = ['default', 'success', 'warning', 'danger', 'info'];

describe('bookingUiTone', () => {
  it('@contract provides badge, text, and icon classes for every status tone', () => {
    expect(Object.keys(toneClasses).sort()).toEqual([...ALL_TONES].sort());

    for (const tone of ALL_TONES) {
      const palette = toneClasses[tone];
      expect(palette.badge.trim().length, `${tone}.badge`).toBeGreaterThan(0);
      expect(palette.text.trim().length, `${tone}.text`).toBeGreaterThan(0);
      expect(palette.icon.trim().length, `${tone}.icon`).toBeGreaterThan(0);
    }
  });

  it('@contract keeps the danger tone visually distinct from the neutral default tone', () => {
    expect(toneClasses.danger.badge).not.toEqual(toneClasses.default.badge);
    expect(toneClasses.danger.text).not.toEqual(toneClasses.default.text);
  });
});
