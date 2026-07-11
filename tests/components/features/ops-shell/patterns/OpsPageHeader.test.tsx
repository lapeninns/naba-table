import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { OpsPageHeader } from '@/components/features/ops-shell/patterns/OpsPageHeader';

describe('OpsPageHeader', () => {
  it('@smoke @a11y renders the title as a level-1 heading inside a banner with subtitle, eyebrow, and meta', () => {
    render(
      <OpsPageHeader
        eyebrow="Operations"
        title="Bookings"
        subtitle="Manage reservations"
        meta={<span>Test Restaurant</span>}
      />,
    );

    expect(screen.getByRole('banner')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1, name: 'Bookings' })).toBeInTheDocument();
    expect(screen.getByText('Operations')).toBeInTheDocument();
    expect(screen.getByText('Manage reservations')).toBeInTheDocument();
    expect(screen.getByText('Test Restaurant')).toBeInTheDocument();
  });

  it('@smoke honors headingLevel and renders primary and secondary actions', () => {
    render(
      <OpsPageHeader
        title="Sub section"
        headingLevel="h3"
        primaryAction={<button type="button">Save</button>}
        secondaryActions={<button type="button">Discard</button>}
      />,
    );

    expect(screen.getByRole('heading', { level: 3, name: 'Sub section' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Discard' })).toBeInTheDocument();
  });

  it('@smoke omits optional slots when not provided', () => {
    const { container } = render(<OpsPageHeader title="Bare" />);

    expect(screen.getByRole('heading', { name: 'Bare' })).toBeInTheDocument();
    expect(container.querySelectorAll('button')).toHaveLength(0);
  });
});
