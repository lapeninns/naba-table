import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { FloorPlanLoadingSkeleton } from '@/components/features/floor-plan/FloorPlanLoadingSkeleton';

describe('FloorPlanLoadingSkeleton', () => {
  it('announces a busy loading region', () => {
    render(<FloorPlanLoadingSkeleton />);
    expect(screen.getByLabelText('Loading floor plan')).toHaveAttribute('aria-busy');
  });

  it('keeps the stat placeholders compact — not the audited ~220px cards', () => {
    render(<FloorPlanLoadingSkeleton />);
    const tiles = within(screen.getByTestId('floor-skeleton-stats')).getAllByTestId(
      'floor-skeleton-stat',
    );
    expect(tiles).toHaveLength(3);
    for (const tile of tiles) {
      expect(tile.className).toContain('h-[88px]');
    }
  });

  it('hides the desktop aside placeholder below lg so mobile is map-first', () => {
    render(<FloorPlanLoadingSkeleton />);
    const aside = screen.getByTestId('floor-skeleton-aside');
    expect(aside.className).toContain('hidden');
    expect(aside.className).toContain('lg:block');
  });
});
