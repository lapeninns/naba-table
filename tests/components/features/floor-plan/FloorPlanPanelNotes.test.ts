import { describe, expect, it } from 'vitest';

import { FLOOR_NOTE_CLASS } from '@/components/features/floor-plan/FloorPlanPanel';

describe('Floor layout side-panel notes', () => {
  it('are neutral muted callouts, never the cyan info hue (RR11)', () => {
    expect(FLOOR_NOTE_CLASS).toContain('bg-muted/40');
    expect(FLOOR_NOTE_CLASS).toContain('[&>svg]:text-muted-foreground');
    expect(FLOOR_NOTE_CLASS).not.toMatch(/info/);
  });
});
