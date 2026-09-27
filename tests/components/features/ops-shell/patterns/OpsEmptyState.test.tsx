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

  it('@contract compact size keeps the title below a card title (text-sm medium) with no min height', () => {
    const { container } = render(
      <OpsEmptyState
        size="compact"
        title="No categories yet"
        description="Add your main category."
      />,
    );

    const heading = screen.getByRole('heading', { name: 'No categories yet' });
    expect(heading).toHaveClass('text-sm', 'font-medium');
    expect(heading.className).not.toContain('text-[length:var(--pg-text-title)]');
    expect(heading).not.toHaveClass('font-semibold');
    expect(screen.getByText('Add your main category.')).toHaveClass(
      'text-sm',
      'text-muted-foreground',
    );
    const root = container.querySelector('[data-slot="ops-empty-state"]');
    expect(root).toHaveAttribute('data-size', 'compact');
    expect(root).not.toHaveClass('min-h-[240px]');
  });

  it('@contract default size is unchanged for page-level empty states', () => {
    const { container } = render(<OpsEmptyState title="No bookings yet" />);

    expect(container.querySelector('[data-slot="ops-empty-state"]')).toHaveClass('min-h-[240px]');
    expect(screen.getByRole('heading', { name: 'No bookings yet' })).not.toHaveClass('text-sm');
  });
});
