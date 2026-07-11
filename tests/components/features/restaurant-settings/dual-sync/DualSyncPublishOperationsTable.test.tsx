import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { DualSyncPublishOperationsTable } from '@/components/features/restaurant-settings/dual-sync/DualSyncPublishOperationsTable';

import type { DualSyncPublishResponse } from '@/services/ops/dual-sync';

const operations = [
  {
    id: 'op-1',
    status: 'failed',
    fieldKey: 'profile.phone',
    errorCode: 'GBP_WRITE_REJECTED',
    direction: 'export',
    googleUpdateMask: 'phoneNumbers.primaryPhone',
    finishedAt: '2026-07-10T18:30:00Z',
  },
] as unknown as DualSyncPublishResponse['operations'];

describe('DualSyncPublishOperationsTable', () => {
  it('@contract explains when no operation rows were returned', () => {
    render(<DualSyncPublishOperationsTable operations={[] as never} />);

    expect(
      screen.getByText('No operation rows were returned for this publish.'),
    ).toBeInTheDocument();
  });

  it('@contract renders operation rows with status, error code, and mask', () => {
    render(<DualSyncPublishOperationsTable operations={operations} />);

    expect(screen.getByText('failed')).toBeInTheDocument();
    expect(screen.getByText('profile.phone')).toBeInTheDocument();
    expect(screen.getByText('GBP_WRITE_REJECTED')).toBeInTheDocument();
    expect(screen.getByText('phoneNumbers.primaryPhone')).toBeInTheDocument();
  });
});
