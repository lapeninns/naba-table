import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { OpsRouteLoading } from '@/components/features/ops-shell/OpsRouteLoading';

describe('OpsRouteLoading', () => {
  it('@smoke @a11y renders a busy route-loading skeleton inside the standard page shell', () => {
    const { container } = render(<OpsRouteLoading />);

    expect(container.querySelector('[aria-busy="true"]')).not.toBeNull();

    const shell = screen.getByTestId('ops-page-shell');
    expect(shell).toHaveAttribute('data-variant', 'standard');
    // Skeleton placeholders render instead of real content.
    expect(container.querySelectorAll('[data-slot="skeleton"], .animate-pulse').length).toBeGreaterThan(0);
  });
});
