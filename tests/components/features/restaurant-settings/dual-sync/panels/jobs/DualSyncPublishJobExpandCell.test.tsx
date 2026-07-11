import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { Table, TableBody, TableRow } from '@/components/ui/table';
import { DualSyncPublishJobExpandCell } from '@/components/features/restaurant-settings/dual-sync/panels/jobs/DualSyncPublishJobExpandCell';

function renderCell(isSelected: boolean) {
  const onToggle = vi.fn();
  render(
    <Table>
      <TableBody>
        <TableRow>
          <DualSyncPublishJobExpandCell isSelected={isSelected} onToggle={onToggle} />
        </TableRow>
      </TableBody>
    </Table>,
  );
  return onToggle;
}

describe('DualSyncPublishJobExpandCell', () => {
  it('@contract @a11y labels the collapsed state and toggles on click', async () => {
    const user = userEvent.setup();
    const onToggle = renderCell(false);

    await user.click(screen.getByRole('button', { name: 'Show job detail' }));

    expect(onToggle).toHaveBeenCalledTimes(1);
  });

  it('@contract @a11y labels the expanded state for hiding the detail', () => {
    renderCell(true);

    expect(screen.getByRole('button', { name: 'Hide job detail' })).toBeInTheDocument();
  });
});
