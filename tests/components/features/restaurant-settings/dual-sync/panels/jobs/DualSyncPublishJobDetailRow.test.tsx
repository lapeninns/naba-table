import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { Table, TableBody } from '@/components/ui/table';
import { DualSyncPublishJobDetailRow } from '@/components/features/restaurant-settings/dual-sync/panels/jobs/DualSyncPublishJobDetailRow';

describe('DualSyncPublishJobDetailRow', () => {
  it('@smoke spans the table and falls back to the missing-loader detail state', () => {
    render(
      <Table>
        <TableBody>
          <DualSyncPublishJobDetailRow jobId="publish-job-1" colSpan={7} />
        </TableBody>
      </Table>,
    );

    const cell = screen.getByRole('cell');
    expect(cell).toHaveAttribute('colspan', '7');
    expect(screen.getByText('Detail loader not configured.')).toBeInTheDocument();
  });
});
