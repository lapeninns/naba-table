import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { DualSyncHeatmapLegend } from '@/components/features/restaurant-settings/dual-sync/DualSyncHeatmapLegend';
import { buildDualSyncHeatmapRenderModel } from '@/components/features/restaurant-settings/dual-sync/dualSyncHeatmapRenderDomain';

describe('DualSyncHeatmapLegend', () => {
  it('@contract renders a chip per active bucket', () => {
    const model = buildDualSyncHeatmapRenderModel({
      total: 4,
      in_sync: 2,
      drift: 1,
      conflict: 1,
      pending: 0,
      failed: 0,
      inactive: 0,
      hasActionableState: true,
    });
    render(<DualSyncHeatmapLegend model={model} />);

    expect(model.legendItems.length).toBeGreaterThan(0);
    for (const item of model.legendItems) {
      // Values can repeat across buckets; assert presence, not uniqueness.
      expect(screen.getAllByText(String(item.value)).length).toBeGreaterThan(0);
      expect(screen.getAllByText(item.shortLabel).length).toBeGreaterThan(0);
    }
  });

  it('@contract collapses to the inactive-only label when only inactive fields exist', () => {
    const model = buildDualSyncHeatmapRenderModel({
      total: 3,
      in_sync: 0,
      drift: 0,
      conflict: 0,
      pending: 0,
      failed: 0,
      inactive: 3,
      hasActionableState: false,
    });
    render(<DualSyncHeatmapLegend model={model} />);

    expect(model.inactiveOnlyLabel).toBeTruthy();
    expect(screen.getByText(model.inactiveOnlyLabel as string)).toBeInTheDocument();
  });
});
