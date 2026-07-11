import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { DualSyncPublishResultSummaryBadges } from '@/components/features/restaurant-settings/dual-sync/DualSyncPublishResultSummaryBadges';

import type { DualSyncPublishResponse } from '@/services/ops/dual-sync';

describe('DualSyncPublishResultSummaryBadges', () => {
  it('@contract summarises succeeded, failed, and skipped counts', () => {
    const result = {
      succeededCount: 4,
      failedCount: 1,
      skippedCount: 2,
    } as unknown as DualSyncPublishResponse;
    render(<DualSyncPublishResultSummaryBadges result={result} />);

    expect(screen.getByText('4 succeeded')).toBeInTheDocument();
    expect(screen.getByText('1 failed')).toBeInTheDocument();
    expect(screen.getByText('2 skipped')).toBeInTheDocument();
  });
});
