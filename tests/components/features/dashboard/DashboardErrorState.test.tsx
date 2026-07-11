import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { DashboardErrorState } from '@/components/features/dashboard/DashboardErrorState';

describe('DashboardErrorState', () => {
  it('@contract renders the error copy inside an alert', () => {
    render(<DashboardErrorState />);

    expect(screen.getByRole('alert')).toHaveTextContent('We couldn’t load the dashboard');
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Check your connection and try again. If the issue persists, contact support.',
    );
  });

  it('@contract omits the retry button when no handler is provided', () => {
    render(<DashboardErrorState />);

    expect(screen.queryByRole('button', { name: 'Retry' })).not.toBeInTheDocument();
  });

  it('@contract clicking retry fires onRetry', async () => {
    const onRetry = vi.fn();
    const user = userEvent.setup();
    render(<DashboardErrorState onRetry={onRetry} />);

    await user.click(screen.getByRole('button', { name: 'Retry' }));

    expect(onRetry).toHaveBeenCalledTimes(1);
  });
});
