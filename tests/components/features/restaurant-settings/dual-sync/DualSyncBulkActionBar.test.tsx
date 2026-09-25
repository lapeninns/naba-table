import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { DualSyncBulkActionBar } from '@/components/features/restaurant-settings/dual-sync/DualSyncBulkActionBar';

import type { DualSyncFieldSummary } from '@/services/ops/dual-sync';

const fields = [
  { fieldKey: 'profile.name' },
  { fieldKey: 'profile.phone' },
] as unknown as ReadonlyArray<DualSyncFieldSummary>;

const bulkSummary = { importable: 2, exportable: 1, ignorable: 2, selected: 1 };

function renderBar(over: Partial<Parameters<typeof DualSyncBulkActionBar>[0]> = {}) {
  const handlers = { onBulkSelectSection: vi.fn(), onClearSection: vi.fn() };
  render(
    <DualSyncBulkActionBar
      fields={fields}
      writeBlocked={false}
      bulkSummary={bulkSummary}
      {...handlers}
      {...over}
    />,
  );
  return handlers;
}

describe('DualSyncBulkActionBar', () => {
  it('@contract renders nothing for an empty section', () => {
    const { container } = render(
      <DualSyncBulkActionBar
        fields={[]}
        writeBlocked={false}
        bulkSummary={bulkSummary}
        onBulkSelectSection={vi.fn()}
        onClearSection={vi.fn()}
      />,
    );

    expect(container).toBeEmptyDOMElement();
  });

  it('@contract offers counted bulk actions and applies a selection', async () => {
    const user = userEvent.setup();
    const { onBulkSelectSection } = renderBar();

    await user.click(screen.getByRole('button', { name: 'Use all Google’s (2)' }));

    expect(onBulkSelectSection).toHaveBeenCalledWith(fields, 'import_from_google');
  });

  it('@contract clears the section selection', async () => {
    const user = userEvent.setup();
    const { onClearSection } = renderBar();

    await user.click(screen.getByRole('button', { name: 'Clear choices (1)' }));

    expect(onClearSection).toHaveBeenCalledWith(fields);
  });

  it('@contract disables every action while writes are blocked', () => {
    renderBar({ writeBlocked: true });

    for (const name of [
      'Use all Google’s (2)',
      'Send all to Google (1)',
      'Ignore all (2)',
      'Clear choices (1)',
    ]) {
      expect(screen.getByRole('button', { name })).toBeDisabled();
    }
  });
});
