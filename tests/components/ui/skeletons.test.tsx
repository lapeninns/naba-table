import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import {
  SkeletonCalendarGrid,
  SkeletonCard,
  SkeletonRow,
  SkeletonTable,
  SkeletonText,
  SkeletonTitle,
} from '@/components/ui/skeletons';

function skeletonCount(container: HTMLElement) {
  return container.querySelectorAll('[data-slot="skeleton"]').length;
}

describe('ui/skeletons', () => {
  it('@smoke renders the single-element presets with their size classes', () => {
    for (const [Preset, expectedClass] of [
      [SkeletonText, 'h-4'],
      [SkeletonTitle, 'h-7'],
      [SkeletonCard, 'h-48'],
      [SkeletonRow, 'h-10'],
    ] as const) {
      const { container, unmount } = render(<Preset />);
      expect(container.querySelector('[data-slot="skeleton"]')).toHaveClass(expectedClass);
      unmount();
    }
  });

  it('@smoke SkeletonText lets callers override the width', () => {
    const { container } = render(<SkeletonText className="w-64" />);

    expect(container.querySelector('[data-slot="skeleton"]')).toHaveClass('w-64');
  });

  it('@contract SkeletonTable renders a header plus the requested row count', () => {
    const { container } = render(<SkeletonTable rows={3} />);

    // 4 header cells + 3 rows x 4 cells
    expect(skeletonCount(container)).toBe(4 + 3 * 4);
  });

  it('@contract SkeletonTable defaults to five rows', () => {
    const { container } = render(<SkeletonTable />);

    expect(skeletonCount(container)).toBe(4 + 5 * 4);
  });

  it('@smoke SkeletonCalendarGrid renders a 35-cell month grid', () => {
    const { container } = render(<SkeletonCalendarGrid />);

    expect(skeletonCount(container)).toBe(35);
  });
});
