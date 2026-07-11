import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { DualSyncPublishOperationsTable } from '@/components/features/restaurant-settings/dual-sync/panels/jobs/DualSyncPublishOperationsTable';

import { makeDualSyncPublishOperation } from '../../../testUtils';

import type { DualSyncPublishOperation } from '@/server/dual-sync';

describe('DualSyncPublishOperationsTable (job detail)', () => {
  it('@smoke renders the operations count heading and one row per operation', () => {
    const operations = [
      makeDualSyncPublishOperation(),
      makeDualSyncPublishOperation({
        id: 'op-2',
        fieldKey: 'profile.phone',
        status: 'failed',
        errorCode: 'GBP_WRITE_REJECTED',
        errorMessage: 'Google rejected the write.',
      }),
    ] as unknown as ReadonlyArray<DualSyncPublishOperation>;
    render(<DualSyncPublishOperationsTable operations={operations} />);

    expect(screen.getByText('Operations (2)')).toBeInTheDocument();
    expect(screen.getByText('profile.name')).toBeInTheDocument();
    expect(screen.getByText('GBP_WRITE_REJECTED')).toBeInTheDocument();
  });
});
