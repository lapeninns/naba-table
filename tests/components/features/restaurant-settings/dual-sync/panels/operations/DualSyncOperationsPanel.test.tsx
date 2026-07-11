import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { DualSyncOperationsPanel } from '@/components/features/restaurant-settings/dual-sync/panels/operations/DualSyncOperationsPanel';

import { makeDualSyncPublishOperation } from '../../../testUtils';

import type { ListDualSyncOperationsResponse } from '@/services/ops/dual-sync';
import type { UseQueryResult } from '@tanstack/react-query';

function makeQuery(over: Record<string, unknown> = {}) {
  return {
    data: undefined,
    error: null,
    isLoading: false,
    isError: false,
    refetch: vi.fn(),
    ...over,
  } as unknown as UseQueryResult<ListDualSyncOperationsResponse, Error>;
}

describe('DualSyncOperationsPanel', () => {
  it('@contract shows the loading state while the query is pending', () => {
    render(<DualSyncOperationsPanel operationsQuery={makeQuery({ isLoading: true })} />);

    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });

  it('@contract shows the error state and retries the query', async () => {
    const user = userEvent.setup();
    const query = makeQuery({ isError: true, error: new Error('Operations fetch failed') });
    render(<DualSyncOperationsPanel operationsQuery={query} />);

    expect(screen.getByText('Operations fetch failed')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Retry/ }));
    expect(query.refetch).toHaveBeenCalledTimes(1);
  });

  it('@contract shows the empty state when the response has no operations', () => {
    render(
      <DualSyncOperationsPanel
        operationsQuery={makeQuery({ data: { operations: [] } })}
      />,
    );

    expect(
      screen.getByText('No publish operations recorded for this restaurant yet.'),
    ).toBeInTheDocument();
  });

  it('@contract renders the operations table when rows exist', () => {
    render(
      <DualSyncOperationsPanel
        operationsQuery={makeQuery({
          data: { operations: [makeDualSyncPublishOperation()] },
        })}
      />,
    );

    expect(screen.getByRole('table')).toBeInTheDocument();
    expect(screen.getByText('profile.name')).toBeInTheDocument();
  });
});
