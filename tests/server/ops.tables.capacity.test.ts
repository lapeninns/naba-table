import { describe, expect, it } from 'vitest';

import { turnsPerTableForWindow } from '@/server/ops/tables';

describe('turnsPerTableForWindow', () => {
  it('returns zero when the service window is shorter than a turn', () => {
    expect(turnsPerTableForWindow(45, 60, 5, null)).toBe(0);
  });

  it('calculates multiple turns when buffer allows', () => {
    expect(turnsPerTableForWindow(180, 60, 15, null)).toBe(2);
  });

  it('limits turns by reservation interval when spacing is coarse', () => {
    const turns = turnsPerTableForWindow(240, 60, 0, 120);
    expect(turns).toBe(2);
  });
});
