import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { DualSyncPendingCandidatesContent } from '@/components/features/restaurant-settings/dual-sync/panels/jobs/DualSyncPendingCandidatesContent';

import type { DualSyncPendingCandidateRowModel } from '@/components/features/restaurant-settings/dual-sync/panels/jobs/dualSyncPendingCandidatesDomain';

const rows = [
  {
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
  },
  {
    id: 'candidate-2',
    fieldKey: 'profile.phone',
    sectionKey: 'profile',
    source: 'core_write',
    statusLabel: 'Open',
    statusVariant: 'status-pending',
    baselineHashLabel: 'abcdef12',
    updatedAtLabel: '9 May 2026',
    canCancel: false,
    isCancelling: false,
  },
] as unknown as ReadonlyArray<DualSyncPendingCandidateRowModel>;

describe('DualSyncPendingCandidatesContent', () => {
  it('@smoke renders the candidate table with one row per model', () => {
    render(
      <DualSyncPendingCandidatesContent
        cancelDisabled={false}
        candidateRows={rows}
        onCancel={vi.fn()}
      />,
    );

    expect(screen.getByRole('table')).toBeInTheDocument();
    expect(screen.getByText('profile.name')).toBeInTheDocument();
    expect(screen.getByText('profile.phone')).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /Cancel/ })).toHaveLength(1);
  });
});
