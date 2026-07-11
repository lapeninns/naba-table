import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { DualSyncHeatmapBar } from '@/components/features/restaurant-settings/dual-sync/DualSyncHeatmapBar';
import { buildDualSyncHeatmapRenderModel } from '@/components/features/restaurant-settings/dual-sync/dualSyncHeatmapRenderDomain';

const counts = {
  total: 4,
  in_sync: 2,
  drift: 1,
  conflict: 1,
  pending: 0,
  failed: 0,
  inactive: 0,
  hasActionableState: true,
};

describe('DualSyncHeatmapBar', () => {
  it('@contract @a11y renders the proportional segments with an aria label', () => {
    const model = buildDualSyncHeatmapRenderModel(counts);
    render(<DualSyncHeatmapBar model={model} />);

    const bar = screen.getByRole('img');
    expect(bar).toHaveAccessibleName(model.ariaLabel);
    expect(bar.querySelectorAll('[data-bucket]').length).toBe(model.segments.length);
  });
});
