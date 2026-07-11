import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { Table, TableBody } from '@/components/ui/table';
import { DualSyncPendingCandidateRow } from '@/components/features/restaurant-settings/dual-sync/panels/jobs/DualSyncPendingCandidateRow';

import type { DualSyncPendingCandidateRowModel } from '@/components/features/restaurant-settings/dual-sync/panels/jobs/dualSyncPendingCandidatesDomain';

function makeRow(
  over: Partial<DualSyncPendingCandidateRowModel> = {},
): DualSyncPendingCandidateRowModel {
  return {
    id: 'candidate-1',
    fieldKey: 'profile.name',
    sectionKey: 'profile',
    source: 'core_write',
    statusLabel: 'Open',
    statusVariant: 'status-pending',
    baselineHashLabel: '12345678',
    updatedAtLabel: '9 May 2026',
    canCancel: true,
    isCancelling: false,
    ...over,
  } as DualSyncPendingCandidateRowModel;
}

function renderRow(row: DualSyncPendingCandidateRowModel, cancelDisabled = false) {
  const onCancel = vi.fn();
  render(
    <Table>
      <TableBody>
        <DualSyncPendingCandidateRow row={row} cancelDisabled={cancelDisabled} onCancel={onCancel} />
      </TableBody>
    </Table>,
  );
  return onCancel;
}

describe('DualSyncPendingCandidateRow', () => {
  it('@smoke renders the candidate status, field, and metadata', () => {
    renderRow(makeRow());

    expect(screen.getByText('Open')).toBeInTheDocument();
    expect(screen.getByText('profile.name')).toBeInTheDocument();
    expect(screen.getByText('core_write')).toBeInTheDocument();
  });

  it('@contract cancels the candidate through the row action', async () => {
    const user = userEvent.setup();
    const onCancel = renderRow(makeRow());

    await user.click(screen.getByRole('button', { name: /Cancel/ }));

    expect(onCancel).toHaveBeenCalledWith('candidate-1');
  });

  it('@contract hides the cancel action for resolved candidates', () => {
    renderRow(makeRow({ canCancel: false }));

    expect(screen.queryByRole('button', { name: /Cancel/ })).not.toBeInTheDocument();
  });

  it('@contract disables the cancel button while a cancellation is pending', () => {
    renderRow(makeRow({ isCancelling: true }), true);

    expect(screen.getByRole('button', { name: /Cancelling/ })).toBeDisabled();
  });
});
