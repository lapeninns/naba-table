import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { OpsEmptyState } from '@/components/features/ops-shell/patterns/OpsEmptyState';

describe('OpsEmptyState', () => {
  it('@smoke @a11y renders the title as a heading with description, icon, and action slots', () => {
    render(
      <OpsEmptyState
        title="No bookings yet"
        description="Bookings will appear here once guests reserve."
        icon={<svg data-testid="empty-icon" />}
        action={<button type="button">Create booking</button>}
      />,
    );

    expect(screen.getByRole('heading', { name: 'No bookings yet' })).toBeInTheDocument();
    expect(screen.getByText('Bookings will appear here once guests reserve.')).toBeInTheDocument();
    expect(screen.getByTestId('empty-icon')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Create booking' })).toBeInTheDocument();
  });

  it('@smoke renders with only a title and omits optional slots', () => {
    const { container } = render(<OpsEmptyState title="Nothing here" />);

    expect(screen.getByRole('heading', { name: 'Nothing here' })).toBeInTheDocument();
    expect(container.querySelectorAll('button')).toHaveLength(0);
    expect(container.querySelectorAll('p')).toHaveLength(0);
  });
});
