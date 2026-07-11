import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { Table, TableBody } from '@/components/ui/table';
import { DualSyncOperationRow } from '@/components/features/restaurant-settings/dual-sync/panels/operations/DualSyncOperationRow';

import { makeDualSyncPublishOperation } from '../../../testUtils';

import type { DualSyncPublishOperation } from '@/server/dual-sync';

function renderRow(over: Record<string, unknown> = {}) {
  render(
    <Table>
      <TableBody>
        <DualSyncOperationRow
          operation={makeDualSyncPublishOperation(over) as unknown as DualSyncPublishOperation}
        />
      </TableBody>
    </Table>,
  );
}

describe('DualSyncOperationRow', () => {
  it('@smoke renders the field key, direction, and timing for a success', () => {
    renderRow();

    expect(screen.getByText('profile.name')).toBeInTheDocument();
    expect(screen.getByText(/Export/i)).toBeInTheDocument();
    // 2s duration between startedAt and finishedAt, formatted as "2.00s".
    expect(screen.getByText('2.00s')).toBeInTheDocument();
  });

  it('@contract surfaces error code and message on failed operations', () => {
    renderRow({
      status: 'failed',
      errorCode: 'GBP_WRITE_REJECTED',
      errorMessage: 'Google rejected the write.',
    });

    expect(screen.getByText('GBP_WRITE_REJECTED')).toBeInTheDocument();
    expect(screen.getByText('Google rejected the write.')).toBeInTheDocument();
  });
});
