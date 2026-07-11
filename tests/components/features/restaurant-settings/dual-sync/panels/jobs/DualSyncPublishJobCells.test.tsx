import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { Table, TableBody, TableRow } from '@/components/ui/table';
import {
  DualSyncPublishJobCountsCell,
  DualSyncPublishJobIdentityCell,
  DualSyncPublishJobSectionsCell,
  DualSyncPublishJobStatusCell,
} from '@/components/features/restaurant-settings/dual-sync/panels/jobs/DualSyncPublishJobCells';

import type { DualSyncPublishJobRowViewModel } from '@/components/features/restaurant-settings/dual-sync/panels/jobs/dualSyncPublishJobRowDomain';

const viewModel = {
  id: 'publish-job-1',
  shortId: 'publish-',
  status: 'partial',
  hasErrorCodes: true,
  errorCodes: ['QUOTA_LIMITED'],
  hasImportCount: true,
  importCount: 2,
  hasExportCount: true,
  exportCount: 1,
  succeededCount: 2,
  failedCount: 1,
  hasSkippedCount: true,
  skippedCount: 1,
  sectionLabels: [{ key: 'profile', label: 'Profile' }],
  startedAtLabel: '9 May 2026',
  durationLabel: '1s',
} as unknown as DualSyncPublishJobRowViewModel;

function renderCells(children: React.ReactNode) {
  render(
    <Table>
      <TableBody>
        <TableRow>{children}</TableRow>
      </TableBody>
    </Table>,
  );
}

describe('DualSyncPublishJobCells', () => {
  it('@contract status cell renders the badge with error codes', () => {
    renderCells(<DualSyncPublishJobStatusCell viewModel={viewModel} />);

    expect(screen.getByText('Partial')).toBeInTheDocument();
    expect(screen.getByText('QUOTA_LIMITED')).toBeInTheDocument();
  });

  it('@contract identity cell shows the short id with import/export counts', () => {
    renderCells(<DualSyncPublishJobIdentityCell viewModel={viewModel} />);

    expect(screen.getByText('publish-')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
    expect(screen.getByText('1')).toBeInTheDocument();
  });

  it('@contract counts cell shows succeeded, failed, and skipped tallies', () => {
    renderCells(<DualSyncPublishJobCountsCell viewModel={viewModel} />);

    expect(screen.getByText('2✓')).toBeInTheDocument();
    expect(screen.getByText('1✗')).toBeInTheDocument();
  });

  it('@contract sections cell renders one badge per section', () => {
    renderCells(<DualSyncPublishJobSectionsCell viewModel={viewModel} />);

    expect(screen.getByText('Profile')).toBeInTheDocument();
  });
});
