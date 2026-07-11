import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { DualSyncOperationStatusBadge } from '@/components/features/restaurant-settings/dual-sync/panels/operations/DualSyncOperationStatusBadge';
import { DUAL_SYNC_OPERATION_STATUS_LABEL } from '@/components/features/restaurant-settings/dual-sync/panels/operations/dualSyncOperationsDomain';

describe('DualSyncOperationStatusBadge', () => {
  it('@contract maps each operation status to its label', () => {
    render(
      <>
        <DualSyncOperationStatusBadge status="succeeded" />
        <DualSyncOperationStatusBadge status="failed" />
        <DualSyncOperationStatusBadge status="skipped" />
      </>,
    );

    expect(screen.getByText(DUAL_SYNC_OPERATION_STATUS_LABEL.succeeded)).toBeInTheDocument();
    expect(screen.getByText(DUAL_SYNC_OPERATION_STATUS_LABEL.failed)).toBeInTheDocument();
    expect(screen.getByText(DUAL_SYNC_OPERATION_STATUS_LABEL.skipped)).toBeInTheDocument();
  });
});
