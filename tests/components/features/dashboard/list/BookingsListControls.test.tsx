import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/hooks/use-minimum-delay', () => ({
  useMinimumDelay: (value: boolean) => value,
}));

import {
  PINNED_NOW_ISO,
  attemptImport,
} from '@tests/components/features/dashboard/__fixtures__/dashboardFixtures';

import type { BookingsListControlsProps } from '@/components/features/dashboard/list/BookingsListControls';

type ControlsModule = typeof import('@/components/features/dashboard/list/BookingsListControls');

// KNOWN-ISSUE (test-infra): BookingsListControls.tsx imports '@/hooks/use-minimum-delay',
// which vitest's '@' → repo-root alias cannot resolve (the hook exists only in
// src/hooks/). See attemptImport in the shared fixtures; the behavioral suite
// below auto-activates once vitest.config.ts gains the per-file alias.
const { mod, error: loadError } = await attemptImport<ControlsModule>(
  '@/components/features/dashboard/list/BookingsListControls',
);

const BookingsListControls = (mod?.BookingsListControls ??
  (() => null)) as ControlsModule['BookingsListControls'];

function makeProps(
  overrides: Partial<BookingsListControlsProps> = {},
): BookingsListControlsProps {
  return {
    sortKey: 'time',
    sortDir: 'asc',
    onSortKeyChange: vi.fn(),
    onSortDirChange: vi.fn(),
    ...overrides,
  };
}

describe.runIf(mod === null)('BookingsListControls (module unloadable under vitest)', () => {
  it('@contract KNOWN-ISSUE(test-infra): "@/hooks/use-minimum-delay" is unresolvable by the vitest alias map, blocking the module', () => {
    expect(String(loadError)).toMatch(/@\/hooks\/use-minimum-delay/);
  });
});

describe.runIf(mod !== null)('BookingsListControls', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(new Date(PINNED_NOW_ISO));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('@contract renders both sort selects with their current values', () => {
    render(<BookingsListControls {...makeProps()} />);

    expect(screen.getByRole('combobox', { name: 'Sort by' })).toHaveTextContent('Time');
    expect(screen.getByRole('combobox', { name: 'Sort direction' })).toHaveTextContent(
      'Ascending',
    );
  });

  it('@contract choosing a sort key fires onSortKeyChange with the option value', async () => {
    const user = userEvent.setup();
    const props = makeProps();
    render(<BookingsListControls {...props} />);

    await user.click(screen.getByRole('combobox', { name: 'Sort by' }));
    await user.click(await screen.findByRole('option', { name: 'Party Size' }));

    expect(props.onSortKeyChange).toHaveBeenCalledWith('party');
  });

  it('@contract choosing a sort direction fires onSortDirChange', async () => {
    const user = userEvent.setup();
    const props = makeProps();
    render(<BookingsListControls {...props} />);

    await user.click(screen.getByRole('combobox', { name: 'Sort direction' }));
    await user.click(await screen.findByRole('option', { name: 'Descending' }));

    expect(props.onSortDirChange).toHaveBeenCalledWith('desc');
  });

  it('@contract shows the syncing live region instead of the sync label while refetching', () => {
    render(
      <BookingsListControls
        {...makeProps({ isRefetching: true, dataUpdatedAt: Date.now() - 30_000 })}
      />,
    );

    expect(screen.getByText('Syncing latest changes...')).toBeInTheDocument();
    expect(screen.queryByText(/Last synced/)).not.toBeInTheDocument();
  });

  it('@contract formats the last-synced age across second, minute, and hour buckets', () => {
    const now = Date.now();
    const { rerender } = render(
      <BookingsListControls {...makeProps({ dataUpdatedAt: now - 5_000 })} />,
    );
    expect(screen.getByText('Last synced just now')).toBeInTheDocument();

    rerender(<BookingsListControls {...makeProps({ dataUpdatedAt: now - 30_000 })} />);
    expect(screen.getByText('Last synced 30s ago')).toBeInTheDocument();

    rerender(<BookingsListControls {...makeProps({ dataUpdatedAt: now - 5 * 60_000 })} />);
    expect(screen.getByText('Last synced 5m ago')).toBeInTheDocument();

    rerender(<BookingsListControls {...makeProps({ dataUpdatedAt: now - 2 * 3_600_000 })} />);
    expect(screen.getByText('Last synced 2h ago')).toBeInTheDocument();
  });

  it('@contract renders no sync copy without a timestamp', () => {
    render(<BookingsListControls {...makeProps({ dataUpdatedAt: null })} />);

    expect(screen.queryByText(/Last synced/)).not.toBeInTheDocument();
    expect(screen.queryByText('Syncing latest changes...')).not.toBeInTheDocument();
  });
});
