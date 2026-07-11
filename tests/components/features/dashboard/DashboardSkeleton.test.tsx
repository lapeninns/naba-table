import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { DashboardSkeleton } from '@/components/features/dashboard/DashboardSkeleton';

describe('DashboardSkeleton', () => {
  it('@smoke renders a busy placeholder layout without throwing', () => {
    const { container } = render(<DashboardSkeleton />);

    const busyRoot = container.querySelector('[aria-busy="true"]');
    expect(busyRoot).not.toBeNull();
    // Header + toolbar + four booking-card skeleton rows produce many placeholders.
    expect(container.querySelectorAll('[data-slot="skeleton"]').length).toBeGreaterThanOrEqual(10);
  });
});
