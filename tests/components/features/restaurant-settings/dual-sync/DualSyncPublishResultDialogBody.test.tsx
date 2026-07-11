import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { DualSyncPublishResultDialogBody } from '@/components/features/restaurant-settings/dual-sync/DualSyncPublishResultDialogBody';

import type { DualSyncPublishResponse } from '@/services/ops/dual-sync';

const result = {
  succeededCount: 1,
  failedCount: 1,
  skippedCount: 0,
  failures: [
    {
      fieldKey: 'profile.phone',
      failure: { code: 'GBP_WRITE_REJECTED', message: 'Rejected phone format.' },
    },
  ],
  operations: [
    {
      id: 'op-1',
      status: 'succeeded',
      fieldKey: 'profile.name',
      errorCode: null,
      direction: 'export',
      googleUpdateMask: 'title',
      finishedAt: '2026-07-10T18:30:00Z',
    },
  ],
} as unknown as DualSyncPublishResponse;

describe('DualSyncPublishResultDialogBody', () => {
  it('@contract explains when no result is loaded', () => {
    render(<DualSyncPublishResultDialogBody result={null} />);

    expect(screen.getByText('No publish result is loaded.')).toBeInTheDocument();
  });

  it('@contract renders summary badges, failures, and operations from the result', () => {
    render(<DualSyncPublishResultDialogBody result={result} />);

    expect(screen.getByText('1 succeeded')).toBeInTheDocument();
    expect(screen.getByText('Failure codes')).toBeInTheDocument();
    expect(screen.getByText('profile.name')).toBeInTheDocument();
  });
});
