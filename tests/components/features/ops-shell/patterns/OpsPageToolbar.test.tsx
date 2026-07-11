import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { OpsPageToolbar } from '@/components/features/ops-shell/patterns/OpsPageToolbar';

describe('OpsPageToolbar', () => {
  it('@smoke renders filters, sort, actions, and search slots', () => {
    render(
      <OpsPageToolbar
        filters={<span>Filters slot</span>}
        sort={<span>Sort slot</span>}
        actions={<button type="button">Export</button>}
        search={<input aria-label="Search bookings" />}
      />,
    );

    expect(screen.getByText('Filters slot')).toBeInTheDocument();
    expect(screen.getByText('Sort slot')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Export' })).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Search bookings' })).toBeInTheDocument();
  });

  it('@smoke renders children content without requiring slot props', () => {
    render(
      <OpsPageToolbar sticky={false}>
        <p>Custom toolbar body</p>
      </OpsPageToolbar>,
    );

    expect(screen.getByText('Custom toolbar body')).toBeInTheDocument();
  });

  it('@smoke renders nothing in the slot grid when no slots or children are provided', () => {
    const { container } = render(<OpsPageToolbar />);

    expect(container.firstElementChild).not.toBeNull();
    expect(container.firstElementChild?.childElementCount).toBe(0);
  });
});
